import { useEffect, useState } from "react";
import FFT from "fft.js";
import { audioRecordingBus, type AudioRecording } from "./audioRecordingBus";

export type SpikeEntry = {
    timeIdx: number;
    timeSec: number;
    magnitude: number;
};

export type AudioStftFrame = {
    stftMatrix: Map<number, Float32Array>; // freqBinIdx → magnitudes across time
    frequencies: Float32Array;
    timeBins: Float32Array;
    spikeMap: Map<number, SpikeEntry[]>;
    frameSize: number;
    hopSize: number;
    sampleRate: number;
    // Fine-resolution pre-computed bar data for smooth bar-chart playback.
    // Layout: barData[frameIdx * barNumBars + barIdx] = max magnitude.
    barData?: Float32Array;
    barTimeBins?: Float32Array;
    barNumBars?: number;
    barNumFrames?: number;
    // Amplitude envelope at 0.001 s resolution for heatmap rendering.
    envData?: Float32Array;
    envTimeBins?: Float32Array;
    numEnvFrames?: number;
};

type Listener = (frame: AudioStftFrame | undefined) => void;

const EPS = 1e-12;
const TARGET_BIN_HZ = 2;

// Compute the smallest power-of-2 frame size that gives ≤ TARGET_BIN_HZ resolution.
function frameAndHopFor(sampleRate: number): { frameSize: number; hopSize: number } {
    let frameSize = 4;
    while (sampleRate / frameSize > TARGET_BIN_HZ) frameSize <<= 1;
    // Hop = frameSize/4 for good time resolution, minimum 1024.
    const hopSize = Math.max(1024, frameSize >> 2);
    return { frameSize, hopSize };
}

const fftInstances = new Map<number, FFT>();
function getFft(size: number): FFT {
    let inst = fftInstances.get(size);
    if (!inst) { inst = new FFT(size); fftInstances.set(size, inst); }
    return inst;
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

function nextPowerOfTwo(n: number): number {
    return 1 << Math.floor(Math.log2(Math.max(2, n)));
}

function detectSpikes(
    stftMatrix: Map<number, Float32Array>,
    timeBins: Float32Array,
): Map<number, SpikeEntry[]> {
    const spikeMap = new Map<number, SpikeEntry[]>();
    for (const [freqBinIdx, magnitudes] of stftMatrix) {
        let sum = 0;
        let sumSq = 0;
        for (let i = 0; i < magnitudes.length; i++) {
            sum += magnitudes[i];
            sumSq += magnitudes[i] * magnitudes[i];
        }
        const mean = sum / magnitudes.length;
        const variance = (sumSq / magnitudes.length) - (mean * mean);
        const stdDev = Math.sqrt(Math.max(0, variance));

        // Skip bins with little temporal variation — catches noise-floor bins where
        // minuscule floating-point differences would otherwise exceed the threshold.
        const cv = mean > 0 ? stdDev / mean : 0;
        if (cv < 0.5) continue;

        // Spike must exceed 3σ above the mean AND be at least 2× the mean.
        const threshold = Math.max(mean + 3 * stdDev, mean * 2);
        const peaks: SpikeEntry[] = [];
        for (let timeIdx = 0; timeIdx < magnitudes.length; timeIdx++) {
            if (magnitudes[timeIdx] > threshold) {
                peaks.push({ timeIdx, timeSec: timeBins[timeIdx], magnitude: magnitudes[timeIdx] });
            }
        }
        if (peaks.length > 0) spikeMap.set(freqBinIdx, peaks);
    }
    return spikeMap;
}

export function computeStftFull(
    rec: AudioRecording,
    frameSize?: number,
    hopSize?: number,
): AudioStftFrame | undefined {
    if (!rec.samples || rec.samples.length < 4 || rec.sampleRate <= 0) return undefined;
    const defaults = frameAndHopFor(rec.sampleRate);
    const size = Math.max(4, nextPowerOfTwo(Math.min(rec.samples.length, frameSize ?? defaults.frameSize)));
    if (rec.samples.length < size) return undefined;
    const hop = Math.max(1, hopSize ?? defaults.hopSize);
    const numFrames = Math.max(1, Math.floor((rec.samples.length - size) / hop) + 1);
    const bins = size / 2;

    const fft = getFft(size);
    const spectrum = fft.createComplexArray();
    const buffer = new Float32Array(size);

    const stftMatrix = new Map<number, Float32Array>();
    for (let b = 0; b <= bins; b++) {
        stftMatrix.set(b, new Float32Array(numFrames));
    }

    const timeBins = new Float32Array(numFrames);
    const frequencies = new Float32Array(bins + 1);
    for (let i = 0; i <= bins; i++) {
        frequencies[i] = (i * rec.sampleRate) / size;
    }

    for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
        const start = frameIdx * hop;
        timeBins[frameIdx] = (start + size / 2) / rec.sampleRate;
        buffer.fill(0);
        const available = Math.min(size, rec.samples.length - start);
        if (available > 0) buffer.set(rec.samples.subarray(start, start + available));
        const windowGain = applyHannWindow(buffer);
        fft.realTransform(spectrum, buffer);
        fft.completeSpectrum(spectrum);
        for (let b = 0; b <= bins; b++) {
            const real = spectrum[2 * b];
            const imag = spectrum[2 * b + 1];
            const mag = Math.sqrt(real * real + imag * imag);
            const scaled = (2 * mag) / (size * windowGain);
            stftMatrix.get(b)![frameIdx] = scaled < EPS ? EPS : scaled;
        }
    }

    const spikeMap = detectSpikes(stftMatrix, timeBins);
    return { stftMatrix, frequencies, timeBins, spikeMap, frameSize: size, hopSize: hop, sampleRate: rec.sampleRate };
}

/**
 * Returns the highest frequency bin (Hz) whose peak magnitude across all STFT
 * frames is at least 5% of the global STFT peak.  That relative threshold
 * keeps EPS-level noise-floor bins from expanding the axis while still
 * capturing low-amplitude harmonics that are genuinely present in the signal.
 */
export function deriveMaxFrequency(frame: AudioStftFrame): number | undefined {
    const { stftMatrix, frequencies } = frame;
    let globalPeak = 0;
    const binPeaks = new Float32Array(frequencies.length);

    for (const [binIdx, magnitudes] of stftMatrix) {
        if (binIdx >= frequencies.length) continue;
        let peak = 0;
        for (let i = 0; i < magnitudes.length; i++) {
            if (magnitudes[i] > peak) peak = magnitudes[i];
        }
        binPeaks[binIdx] = peak;
        if (peak > globalPeak) globalPeak = peak;
    }

    if (globalPeak <= 0) return undefined;
    const threshold = globalPeak * 0.05;

    for (let b = frequencies.length - 1; b >= 0; b--) {
        if (binPeaks[b] >= threshold) return frequencies[b];
    }
    return undefined;
}

// --- Bus state ---

const stftFrames = new Map<string, AudioStftFrame | undefined>();
const listenersByBus = new Map<string, Set<Listener>>();
const recordingSubscriptions = new Map<string, () => void>();

function getListeners(busId: string): Set<Listener> {
    const existing = listenersByBus.get(busId);
    if (existing) return existing;
    const set = new Set<Listener>();
    listenersByBus.set(busId, set);
    return set;
}

function publish(frame: AudioStftFrame | undefined, busId = "main") {
    stftFrames.set(busId, frame);
    getListeners(busId).forEach((l) => l(frame));
}

// --- Web Worker for off-thread STFT computation ---

let worker: Worker | null = null;
// Map from busId → callback waiting for the worker result.
// Only one computation per busId at a time; a new recording supersedes the previous one.
const pendingByBus = new Map<string, (frame: AudioStftFrame | undefined) => void>();

function getWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(new URL("./stftWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent) => {
        const { busId, error, numFrames, numBins, frameSize, hopSize, sampleRate, timeBins, frequencies, stftData, spikeData, barData, barTimeBins, barNumBars, barNumFrames, envData, envTimeBins, numEnvFrames } = e.data;
        const cb = pendingByBus.get(busId);
        pendingByBus.delete(busId);
        if (!cb) return;
        if (error) { cb(undefined); return; }

        // Reconstruct stftMatrix as views into the transferred flat buffer (zero-copy).
        const stftMatrix = new Map<number, Float32Array>();
        for (let b = 0; b <= numBins; b++) {
            stftMatrix.set(b, (stftData as Float32Array).subarray(b * numFrames, (b + 1) * numFrames));
        }

        // Reconstruct spike map from packed [binIdx, frameIdx, timeSec, magnitude, ...].
        const spikeMap = new Map<number, SpikeEntry[]>();
        for (let i = 0; i < (spikeData as Float32Array).length; i += 4) {
            const binIdx = Math.round(spikeData[i]);
            const timeIdx = Math.round(spikeData[i + 1]);
            const timeSec = spikeData[i + 2];
            const magnitude = spikeData[i + 3];
            let entries = spikeMap.get(binIdx);
            if (!entries) { entries = []; spikeMap.set(binIdx, entries); }
            entries.push({ timeIdx, timeSec, magnitude });
        }

        cb({ stftMatrix, frequencies, timeBins, spikeMap, frameSize, hopSize, sampleRate, barData, barTimeBins, barNumBars, barNumFrames, envData, envTimeBins, numEnvFrames });
    };
    worker.onerror = (e) => {
        console.error("STFT worker error:", e);
        for (const cb of pendingByBus.values()) cb(undefined);
        pendingByBus.clear();
    };
    return worker;
}

function computeStftAsync(rec: AudioRecording, busId: string) {
    // Register callback; any previously pending result for this busId is superseded.
    pendingByBus.set(busId, (frame) => publish(frame, busId));
    // Copy samples so the worker can take ownership via transfer (the original stays intact).
    const copy = new Float32Array(rec.samples);
    getWorker().postMessage({ busId, samples: copy, sampleRate: rec.sampleRate }, [copy.buffer]);
}

function ensureSubscription(busId: string) {
    if (recordingSubscriptions.has(busId)) return;
    const unsub = audioRecordingBus.subscribe((rec) => {
        if (rec?.blob) {
            computeStftAsync(rec, busId);
        } else {
            // Cancel any in-flight computation for this bus.
            pendingByBus.delete(busId);
            publish(undefined, busId);
        }
    }, busId);
    recordingSubscriptions.set(busId, unsub);
}

export const audioStftBus = {
    publish,
    get(busId = "main") {
        return stftFrames.get(busId);
    },
    subscribe(listener: Listener, busId = "main") {
        const listeners = getListeners(busId);
        listeners.add(listener);
        listener(stftFrames.get(busId));
        return () => { listeners.delete(listener); };
    },
};

export function useAudioStft(busId = "main"): AudioStftFrame | undefined {
    const [frame, setFrame] = useState<AudioStftFrame | undefined>(() => stftFrames.get(busId));
    useEffect(() => {
        ensureSubscription(busId);
        return audioStftBus.subscribe(setFrame, busId);
    }, [busId]);
    return frame;
}

export function useAudioStftSpikes(busId = "main"): Map<number, SpikeEntry[]> | undefined {
    const [spikes, setSpikes] = useState<Map<number, SpikeEntry[]> | undefined>(
        () => stftFrames.get(busId)?.spikeMap,
    );
    useEffect(() => {
        ensureSubscription(busId);
        return audioStftBus.subscribe((f) => setSpikes(f?.spikeMap), busId);
    }, [busId]);
    return spikes;
}

export function useAudioStftPeak(busId = "main"): number | undefined {
    const [peak, setPeak] = useState<number | undefined>(() => {
        const frame = stftFrames.get(busId);
        if (!frame) return undefined;
        let p = 0;
        for (const spikes of frame.spikeMap.values()) {
            for (const { magnitude } of spikes) { if (magnitude > p) p = magnitude; }
        }
        return p > 0 ? p : undefined;
    });
    useEffect(() => {
        ensureSubscription(busId);
        return audioStftBus.subscribe((f) => {
            if (!f) { setPeak(undefined); return; }
            let p = 0;
            for (const spikes of f.spikeMap.values()) {
                for (const { magnitude } of spikes) { if (magnitude > p) p = magnitude; }
            }
            setPeak(p > 0 ? p : undefined);
        }, busId);
    }, [busId]);
    return peak;
}
