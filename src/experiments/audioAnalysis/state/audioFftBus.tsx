import { useEffect, useState } from "react";
import FFT from "fft.js";
import { audioRecordingBus, type AudioRecording } from "./audioRecordingBus";
import { audioPlaybackBus, type AudioPlayback } from "./audioPlaybackBus";

export type AudioFftFrame = {
    magnitudes: Float32Array;
    frequencies: Float32Array;
    fftSize: number;
    sampleRate: number;
};

type Listener = (frame: AudioFftFrame | undefined, peak?: number) => void;

const frames = new Map<string, AudioFftFrame | undefined>();
const peaks = new Map<string, number | undefined>();
const listenersByBus = new Map<string, Set<Listener>>();
const recordingSubscriptions = new Map<string, () => void>();
const recordingCache = new Map<string, AudioRecording | undefined>();
const playbackCache = new Map<string, AudioPlayback | undefined>();
const rafHandles = new Map<string, number>();
const lastFrameState = new Map<string, { lastTime: number; lastTs: number }>();
const EPS = 1e-12;
const DEFAULT_FFT_SIZE = 2048;
const PLAYBACK_FPS_MS = 33;

function getListeners(busId: string): Set<Listener> {
    const existing = listenersByBus.get(busId);
    if (existing) return existing;
    const set = new Set<Listener>();
    listenersByBus.set(busId, set);
    return set;
}

function publish(frame: AudioFftFrame | undefined, busId = "main") {
    frames.set(busId, frame);
    getListeners(busId).forEach((l) => l(frame, peaks.get(busId)));
}

function computeFftAtTime(rec: AudioRecording, timeSec = 0, fftSize = 2048): AudioFftFrame | undefined {
    if (!rec.samples || rec.samples.length === 0 || rec.sampleRate <= 0) return undefined;

    const size = Math.max(2, nextPowerOfTwo(Math.min(rec.samples.length, fftSize)));
    if (size < 2) return undefined;

    const half = Math.floor(size / 2);
    const centerSample = Math.min(Math.max(0, Math.floor(timeSec * rec.sampleRate)), rec.samples.length - 1);
    let start = Math.max(0, centerSample - half);
    if (start + size > rec.samples.length) start = Math.max(0, rec.samples.length - size);

    const input = new Float32Array(size);
    const available = Math.max(0, Math.min(size, rec.samples.length - start));
    if (available > 0) input.set(rec.samples.subarray(start, start + available));
    const windowGain = applyHannWindow(input);

    const fft = new FFT(size);
    const spectrum = fft.createComplexArray();
    fft.realTransform(spectrum, input);
    fft.completeSpectrum(spectrum);

    const bins = size / 2;
    const magnitudes = new Float32Array(bins + 1);
    const frequencies = new Float32Array(bins + 1);

    for (let i = 0; i <= bins; i++) {
        const real = spectrum[2 * i];
        const imag = spectrum[2 * i + 1];
        const mag = Math.sqrt(real * real + imag * imag);
        const scaled = (2 * mag) / (size * windowGain);
        magnitudes[i] = scaled < EPS ? EPS : scaled;
        frequencies[i] = (i * rec.sampleRate) / size;
    }

    return { magnitudes, frequencies, fftSize: size, sampleRate: rec.sampleRate };
}

function applyHannWindow(buffer: Float32Array): number {
    const len = buffer.length;
    let sum = 0;
    for (let i = 0; i < len; i++) {
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (len - 1)));
        buffer[i] *= w;
        sum += w;
    }
    return sum / len;
}

function cancelRaf(busId: string) {
    const handle = rafHandles.get(busId);
    if (handle !== undefined) {
        cancelAnimationFrame(handle);
        rafHandles.delete(busId);
    }
}

function startRaf(busId: string) {
    if (rafHandles.has(busId)) return;
    const loop = (ts: number) => {
        const rec = recordingCache.get(busId);
        if (!rec || !rec.blob) {
            publish(undefined, busId);
            cancelRaf(busId);
            return;
        }
        const playback = playbackCache.get(busId);
        const duration = rec.duration ?? rec.samples.length / rec.sampleRate;
        const prev = lastFrameState.get(busId) ?? { lastTime: playback?.currentTime ?? 0, lastTs: ts };
        if (!lastFrameState.has(busId)) {
            lastFrameState.set(busId, prev);
        }
        if (ts - prev.lastTs < PLAYBACK_FPS_MS) {
            const handle = requestAnimationFrame(loop);
            rafHandles.set(busId, handle);
            return;
        }

        const hasCurrent = playback?.currentTime != null && !Number.isNaN(playback.currentTime);
        let targetTime = hasCurrent ? playback!.currentTime : prev.lastTime;
        if (playback?.playing) {
            targetTime = Math.min(Math.max(0, targetTime), duration ?? targetTime);
        }

        lastFrameState.set(busId, { lastTime: targetTime, lastTs: ts });

        const frame = rec ? computeFftAtTime(rec, targetTime) : undefined;
        publish(frame, busId);

        if (playback?.playing) {
            const handle = requestAnimationFrame(loop);
            rafHandles.set(busId, handle);
        } else {
            rafHandles.delete(busId);
        }
    };
    const handle = requestAnimationFrame(loop);
    rafHandles.set(busId, handle);
}

function nextPowerOfTwo(n: number): number {
    return 1 << Math.floor(Math.log2(Math.max(2, n)));
}

function computeFftPeak(rec: AudioRecording, fftSize = DEFAULT_FFT_SIZE, hop = fftSize / 2): number | undefined {
    if (!rec.samples || rec.samples.length === 0 || rec.sampleRate <= 0) return undefined;
    const size = Math.max(2, nextPowerOfTwo(Math.min(rec.samples.length, fftSize)));
    const fft = new FFT(size);
    const spectrum = fft.createComplexArray();
    const buffer = new Float32Array(size);
    let max = 0;
    for (let start = 0; start < rec.samples.length; start += hop) {
        buffer.fill(0);
        const available = Math.min(size, rec.samples.length - start);
        if (available > 0) buffer.set(rec.samples.subarray(start, start + available));
        const windowGain = applyHannWindow(buffer);
        fft.realTransform(spectrum, buffer);
        fft.completeSpectrum(spectrum);
        const bins = size / 2;
        for (let i = 0; i <= bins; i++) {
            const real = spectrum[2 * i];
            const imag = spectrum[2 * i + 1];
            const mag = Math.sqrt(real * real + imag * imag);
            const scaled = (2 * mag) / (size * windowGain);
            if (scaled > max) max = scaled;
        }
    }
    return max > 0 ? max : undefined;
}

function ensureRecordingSubscription(busId: string) {
    if (recordingSubscriptions.has(busId)) return;
    const unsub = audioRecordingBus.subscribe((rec) => {
        recordingCache.set(busId, rec);
        const isFinalizedRecording = !!rec?.blob;
        if (isFinalizedRecording && rec) {
            const peak = computeFftPeak(rec);
            peaks.set(busId, peak);
        } else if (!rec) {
            peaks.set(busId, undefined);
        }
        lastFrameState.delete(busId);
        cancelRaf(busId);
        if (!rec) {
            recompute(busId);
            return;
        }

        if (isFinalizedRecording) {
            recompute(busId);
            return;
        }
        peaks.set(busId, undefined);
        publish(undefined, busId);
    }, busId);
    recordingSubscriptions.set(busId, unsub);
    ensurePlaybackSubscription(busId);
}

function ensurePlaybackSubscription(busId: string) {
    if (playbackCache.has(`${busId}__subscribed`)) return;
    playbackCache.set(`${busId}__subscribed`, undefined);
    audioPlaybackBus.subscribe((state) => {
        playbackCache.set(busId, state);
        if (state?.playing) {
            startRaf(busId);
        } else {
            cancelRaf(busId);
            recompute(busId);
        }
    }, busId);
}

function recompute(busId: string) {
    const rec = recordingCache.get(busId);
    if (!rec || !rec.blob) {
        publish(undefined, busId);
        return;
    }
    const playback = playbackCache.get(busId);
    const time = playback?.currentTime ?? 0;
    const frame = rec ? computeFftAtTime(rec, time) : undefined;
    publish(frame, busId);
}

export const audioFftBus = {
    publish,
    get(busId = "main") {
        return frames.get(busId);
    },
    getPeak(busId = "main") {
        return peaks.get(busId);
    },
    subscribe(listener: Listener, busId = "main") {
        const listeners = getListeners(busId);
        listeners.add(listener);
        listener(frames.get(busId), peaks.get(busId));
        return () => {
            listeners.delete(listener);
        };
    },
};

export function useAudioFft(busId = "main"): AudioFftFrame | undefined {
    const [frame, setFrame] = useState<AudioFftFrame | undefined>(() => frames.get(busId));

    useEffect(() => {
        ensureRecordingSubscription(busId);
        return audioFftBus.subscribe((f) => setFrame(f), busId);
    }, [busId]);

    return frame;
}

export function useAudioFftPeak(busId = "main"): number | undefined {
    const [peak, setPeak] = useState<number | undefined>(() => peaks.get(busId));

    useEffect(() => {
        ensureRecordingSubscription(busId);
        return audioFftBus.subscribe((_, p) => setPeak(p), busId);
    }, [busId]);

    return peak;
}
