// Runs entirely off the main thread.
import FFT from "fft.js";
import { fillFrequencyBars } from "./frequencyBars";

const EPS = 1e-12;
const TARGET_BIN_HZ = 2;

function frameAndHopFor(sampleRate: number): { frameSize: number; hopSize: number } {
    let frameSize = 4;
    while (sampleRate / frameSize > TARGET_BIN_HZ) frameSize <<= 1;
    return { frameSize, hopSize: Math.max(1024, frameSize >> 2) };
}

function nextPow2(n: number): number {
    return 1 << Math.floor(Math.log2(Math.max(2, n)));
}

const hannCache = new Map<number, Float32Array>();
function getHann(size: number): Float32Array {
    let w = hannCache.get(size);
    if (!w) {
        w = new Float32Array(size);
        for (let i = 0; i < size; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
        hannCache.set(size, w);
    }
    return w;
}

const fftCache = new Map<number, FFT>();
function getFft(size: number): FFT {
    let f = fftCache.get(size);
    if (!f) { f = new FFT(size); fftCache.set(size, f); }
    return f;
}

self.onmessage = (e: MessageEvent<{
    busId: string;
    samples: Float32Array;
    sampleRate: number;
    sweepStartFreq?: number;
    sweepEndFreq?: number;
    sweepDurationSec?: number;
    sweepStartSec?: number;
}>) => {
    const { busId, samples, sampleRate, sweepStartFreq, sweepEndFreq, sweepDurationSec, sweepStartSec } = e.data;

    if (!samples || samples.length < 4 || sampleRate <= 0) {
        (self as unknown as Worker).postMessage({ busId, error: "invalid" });
        return;
    }

    const { frameSize: defaultFrame } = frameAndHopFor(sampleRate);
    const size = Math.max(4, nextPow2(Math.min(samples.length, defaultFrame)));
    if (samples.length < size) {
        (self as unknown as Worker).postMessage({ busId, error: "too short" });
        return;
    }

    // Cap STFT memory at ~256 MB (64 M floats). For long recordings, double the hop
    // until the matrix fits — trades time resolution for memory.
    const MAX_STFT_FLOATS = 64 * 1024 * 1024;
    let hop = Math.max(1024, size >> 2);
    while ((size / 2 + 1) * Math.ceil(samples.length / hop) > MAX_STFT_FLOATS) hop *= 2;
    // Extend to cover the full signal: last frame may be a zero-padded partial window.
    const numFrames = Math.max(1, Math.ceil(samples.length / hop));
    const bins = size / 2;

    const fft = getFft(size);
    const spectrum = fft.createComplexArray();
    const buffer = new Float32Array(size);
    const hannWin = getHann(size);

    // stftData[binIdx * numFrames + frameIdx] = magnitude  (bin-major layout)
    const stftData = new Float32Array((bins + 1) * numFrames);
    const timeBins = new Float32Array(numFrames);
    const frequencies = new Float32Array(bins + 1);
    for (let i = 0; i <= bins; i++) frequencies[i] = (i * sampleRate) / size;

    for (let fi = 0; fi < numFrames; fi++) {
        const start = fi * hop;
        timeBins[fi] = start / sampleRate;
        buffer.fill(0);
        const avail = Math.min(size, samples.length - start);
        if (avail > 0) buffer.set(samples.subarray(start, start + avail));

        // Apply Hann window and compute gain
        let winSum = 0;
        for (let i = 0; i < size; i++) { buffer[i] *= hannWin[i]; winSum += hannWin[i]; }
        const gain = winSum / size;

        fft.realTransform(spectrum, buffer);
        fft.completeSpectrum(spectrum);

        const norm = 2 / (size * gain);
        for (let b = 0; b <= bins; b++) {
            const re = spectrum[2 * b], im = spectrum[2 * b + 1];
            const mag = Math.sqrt(re * re + im * im) * norm;
            stftData[b * numFrames + fi] = mag < EPS ? EPS : mag;
        }
    }

    // Spike detection — packed as flat [binIdx, frameIdx, timeSec, magnitude, ...]
    const spikeEntries: number[] = [];
    for (let b = 0; b <= bins; b++) {
        const offset = b * numFrames;
        let sum = 0, sumSq = 0;
        for (let fi = 0; fi < numFrames; fi++) {
            const v = stftData[offset + fi];
            sum += v; sumSq += v * v;
        }
        const mean = sum / numFrames;
        const stdDev = Math.sqrt(Math.max(0, sumSq / numFrames - mean * mean));
        const cv = mean > 0 ? stdDev / mean : 0;
        if (cv < 0.5) continue;
        const thr = Math.max(mean + 3 * stdDev, mean * 2);
        for (let fi = 0; fi < numFrames; fi++) {
            const v = stftData[offset + fi];
            if (v > thr) spikeEntries.push(b, fi, timeBins[fi], v);
        }
    }

    const spikeData = new Float32Array(spikeEntries);

    // Fine-resolution bar STFT for smooth bar-chart playback.
    // BAR_HZ_W controls display bar width (must match BAR_HZ in AudioAnalysisGraph.tsx).
    // barFrameSize is kept small for temporal responsiveness — fillFrequencyBars handles
    // upsampling wider FFT bins into display bars without aliasing.
    const BAR_HZ_W = 5;
    const barFrameSize = 1 << Math.floor(Math.log2(Math.max(4, Math.min(samples.length, 8192))));
    let barData = new Float32Array(0);
    let barTimeBins = new Float32Array(0);
    let barNumBars = 0;
    let barNumFrames = 0;

    // Cap barData at ~64 MB (16 M floats). Skip entirely if it would exceed the budget
    // even with the minimum sensible hop — heatmap uses envData, bar chart falls back to live FFT.
    const MAX_BAR_FLOATS = 16 * 1024 * 1024;
    const BAR_HOP = 1024;
    const tentativeBarNumBars = Math.floor((sampleRate / 2) / BAR_HZ_W);
    const tentativeBarNumFrames = Math.max(1, Math.ceil(samples.length / BAR_HOP));
    const barFits = samples.length >= barFrameSize &&
        tentativeBarNumFrames * tentativeBarNumBars <= MAX_BAR_FLOATS;

    if (barFits) {
        barNumBars = tentativeBarNumBars;
        barNumFrames = tentativeBarNumFrames;
        barData = new Float32Array(barNumFrames * barNumBars);
        barTimeBins = new Float32Array(barNumFrames);

        const barFft = getFft(barFrameSize);
        const barSpectrum = barFft.createComplexArray();
        const barBuffer = new Float32Array(barFrameSize);
        const barHannWin = getHann(barFrameSize);
        const barBins = barFrameSize / 2;
        const barFrequencies = new Float32Array(barBins + 1);
        const barMagnitudes = new Float32Array(barBins + 1);
        for (let b = 0; b <= barBins; b++) barFrequencies[b] = (b * sampleRate) / barFrameSize;

        for (let fi = 0; fi < barNumFrames; fi++) {
            const start = fi * BAR_HOP;
            barTimeBins[fi] = (start + barFrameSize / 2) / sampleRate;
            barBuffer.fill(0);
            const avail = Math.min(barFrameSize, samples.length - start);
            if (avail > 0) barBuffer.set(samples.subarray(start, start + avail));

            let winSum = 0;
            for (let i = 0; i < barFrameSize; i++) { barBuffer[i] *= barHannWin[i]; winSum += barHannWin[i]; }
            const barGain = winSum / barFrameSize;

            barFft.realTransform(barSpectrum, barBuffer);
            barFft.completeSpectrum(barSpectrum);

            const barNorm = 2 / (barFrameSize * barGain);
            for (let b = 0; b <= barBins; b++) {
                const re = barSpectrum[2 * b], im = barSpectrum[2 * b + 1];
                const mag = Math.sqrt(re * re + im * im) * barNorm;
                barMagnitudes[b] = mag < EPS ? EPS : mag;
            }

            const frameBars = barData.subarray(fi * barNumBars, fi * barNumBars + barNumBars);
            fillFrequencyBars(frameBars, barMagnitudes, barFrequencies, BAR_HZ_W);
        }
    }

    // Amplitude envelope at 0.001 s per frame — peak-abs of raw samples, no FFT needed.
    const envHop = Math.max(1, Math.round(sampleRate / 1000));
    const numEnvFrames = Math.max(1, Math.floor(samples.length / envHop));
    const envData = new Float32Array(numEnvFrames);
    const envTimeBins = new Float32Array(numEnvFrames);
    for (let fi = 0; fi < numEnvFrames; fi++) {
        const start = fi * envHop;
        const end = Math.min(start + envHop, samples.length);
        envTimeBins[fi] = (start + (end - start) * 0.5) / sampleRate;
        let maxAbs = 0;
        for (let i = start; i < end; i++) {
            const abs = Math.abs(samples[i]);
            if (abs > maxAbs) maxAbs = abs;
        }
        envData[fi] = maxAbs;
    }

    // ── Resonance detection ──
    // Two modes: sweep-based (accurate for speaker-under-plate recordings) and
    // STFT spectral (fallback for generic recordings without sweep metadata).
    const resEntries: number[] = [];

    const hasSweep = sweepStartFreq !== undefined && sweepEndFreq !== undefined &&
        sweepDurationSec !== undefined && sweepDurationSec > 0 && sweepStartFreq !== sweepEndFreq;

    if (hasSweep) {
        // Map the amplitude envelope to the frequency axis using the linear sweep schedule:
        //   f(t) = sweepStartFreq + (sweepEndFreq - sweepStartFreq) * (t / sweepDurationSec)
        // This gives a direct frequency-response curve — peaks = resonances.
        const sf = sweepStartFreq!;
        const ef = sweepEndFreq!;
        const dur = sweepDurationSec!;
        const freqRange = ef - sf;
        const freqMin = Math.min(sf, ef);
        const numFreqBins = Math.round(Math.abs(freqRange)) + 1;

        const offset = sweepStartSec ?? 0;
        const ampByFreq = new Float32Array(numFreqBins);
        const peakFiByFreq = new Int32Array(numFreqBins).fill(-1);
        for (let fi = 0; fi < numEnvFrames; fi++) {
            const tSweep = envTimeBins[fi] - offset;
            if (tSweep < 0 || tSweep > dur) continue;
            const freq = sf + freqRange * (tSweep / dur);
            const idx = Math.round(freq - freqMin);
            if (idx >= 0 && idx < numFreqBins && envData[fi] > ampByFreq[idx]) {
                ampByFreq[idx] = envData[fi];
                peakFiByFreq[idx] = fi;
            }
        }

        // ±5-bin moving average to smooth noise-floor ripple.
        const SMOOTH_W = 5;
        const smoothedFreq = new Float32Array(numFreqBins);
        for (let i = 0; i < numFreqBins; i++) {
            let s = 0, c = 0;
            for (let k = Math.max(0, i - SMOOTH_W); k <= Math.min(numFreqBins - 1, i + SMOOTH_W); k++) {
                s += ampByFreq[k]; c++;
            }
            smoothedFreq[i] = c > 0 ? s / c : 0;
        }

        let globalPeakFreq = 0;
        for (let i = 0; i < numFreqBins; i++) if (smoothedFreq[i] > globalPeakFreq) globalPeakFreq = smoothedFreq[i];
        const minPromFreq = globalPeakFreq * 0.05;

        const hzPerBin = sampleRate / size;
        for (let i = 1; i < numFreqBins - 1; i++) {
            const freq = freqMin + i;
            if (freq < 20) continue;
            if (smoothedFreq[i] <= smoothedFreq[i - 1] || smoothedFreq[i] <= smoothedFreq[i + 1]) continue;

            let leftMin = Infinity;
            for (let k = i - 1; k >= 0; k--) {
                if (smoothedFreq[k] >= smoothedFreq[i]) break;
                if (smoothedFreq[k] < leftMin) leftMin = smoothedFreq[k];
            }
            let rightMin = Infinity;
            for (let k = i + 1; k < numFreqBins; k++) {
                if (smoothedFreq[k] >= smoothedFreq[i]) break;
                if (smoothedFreq[k] < rightMin) rightMin = smoothedFreq[k];
            }

            const prom = smoothedFreq[i] - Math.max(
                isFinite(leftMin) ? leftMin : 0,
                isFinite(rightMin) ? rightMin : 0,
            );
            if (prom < minPromFreq) continue;

            // Refine frequency using the STFT spectrum at the amplitude-envelope peak time.
            // The envelope peaks after the sweep has passed the resonance (ring-up delay), so
            // the sweep-schedule frequency is biased. At peak-amplitude time the structure is
            // ringing at its natural frequency, so the spectral peak gives the true resonance.
            const peakFi = peakFiByFreq[i];
            const peakTimeSec = peakFi >= 0 ? envTimeBins[peakFi] : offset + (freq - sf) / freqRange * dur;
            const stftFi = Math.max(0, Math.min(numFrames - 1, Math.round(peakTimeSec * sampleRate / hop)));
            const centerBin = Math.round(freq / hzPerBin);
            const radius = Math.round(20 / hzPerBin);
            const bStart = Math.max(1, centerBin - radius);
            const bEnd = Math.min(bins - 1, centerBin + radius);
            let maxMag = -1, maxBin = centerBin;
            for (let b = bStart; b <= bEnd; b++) {
                const mag = stftData[b * numFrames + stftFi];
                if (mag > maxMag) { maxMag = mag; maxBin = b; }
            }
            // Parabolic interpolation for sub-bin frequency accuracy.
            let refinedFreq = frequencies[maxBin];
            const pα = stftData[(maxBin - 1) * numFrames + stftFi];
            const pβ = stftData[maxBin * numFrames + stftFi];
            const pγ = stftData[(maxBin + 1) * numFrames + stftFi];
            const pDenom = pα - 2 * pβ + pγ;
            if (pDenom < 0) refinedFreq += 0.5 * (pα - pγ) / pDenom * hzPerBin;

            // Seek time = when the sweep was at this frequency (scheduled, not amplitude peak).
            const timeSec = offset + Math.max(0, Math.min(dur, (freq - sf) / freqRange * dur));
            resEntries.push(refinedFreq, smoothedFreq[i], prom, smoothedFreq[i] / globalPeakFreq, timeSec);
        }
    } else {
        // Fallback: prominence-based peak picking on the time-averaged STFT spectrum.
        const meanSpec = new Float32Array(bins + 1);
        const stdSpec  = new Float32Array(bins + 1);
        for (let b = 0; b <= bins; b++) {
            const off = b * numFrames;
            let s = 0, s2 = 0;
            for (let fi = 0; fi < numFrames; fi++) { const v = stftData[off + fi]; s += v; s2 += v * v; }
            const m = s / numFrames;
            meanSpec[b] = m;
            stdSpec[b]  = Math.sqrt(Math.max(0, s2 / numFrames - m * m));
        }

        const smoothed = new Float32Array(bins + 1);
        for (let b = 0; b <= bins; b++) {
            let s = 0, c = 0;
            for (let k = Math.max(0, b - 3); k <= Math.min(bins, b + 3); k++) { s += meanSpec[k]; c++; }
            smoothed[b] = s / c;
        }

        let smoothedPeak = 0;
        for (let b = 0; b <= bins; b++) if (smoothed[b] > smoothedPeak) smoothedPeak = smoothed[b];
        const minProm = smoothedPeak * 0.05;

        for (let b = 1; b < bins; b++) {
            if (frequencies[b] < 20) continue;
            if (smoothed[b] <= smoothed[b - 1] || smoothed[b] <= smoothed[b + 1]) continue;

            let leftMin = Infinity;
            for (let i = b - 1; i >= 0; i--) {
                if (smoothed[i] >= smoothed[b]) break;
                if (smoothed[i] < leftMin) leftMin = smoothed[i];
            }
            let rightMin = Infinity;
            for (let i = b + 1; i <= bins; i++) {
                if (smoothed[i] >= smoothed[b]) break;
                if (smoothed[i] < rightMin) rightMin = smoothed[i];
            }

            const prom = smoothed[b] - Math.max(isFinite(leftMin) ? leftMin : 0, isFinite(rightMin) ? rightMin : 0);
            if (prom < minProm) continue;

            const consistency = meanSpec[b] / (1 + stdSpec[b]);
            let peakFi = 0, peakMag = -1;
            for (let fi = 0; fi < numFrames; fi++) {
                const v = stftData[b * numFrames + fi];
                if (v > peakMag) { peakMag = v; peakFi = fi; }
            }
            // Center of the peak frame, not its start edge.
            const timeSec = timeBins[peakFi] + size / (2 * sampleRate);
            // Parabolic interpolation for sub-bin frequency accuracy.
            const sα = smoothed[b - 1], sβ = smoothed[b], sγ = smoothed[b + 1];
            const sDenom = sα - 2 * sβ + sγ;
            const refinedFreq = sDenom < 0
                ? frequencies[b] + 0.5 * (sα - sγ) / sDenom * (sampleRate / size)
                : frequencies[b];
            resEntries.push(refinedFreq, meanSpec[b], prom, consistency, timeSec);
        }
    }

    // Sort by prominence desc, suppress peaks within 10 Hz of a stronger one, keep top 10.
    // Output: [freq, mag, prominence, consistency, timeSec, ...].
    const numRes = resEntries.length / 5;
    const resIdx = Array.from({ length: numRes }, (_, i) => i);
    resIdx.sort((a, b) => resEntries[b * 5 + 2] - resEntries[a * 5 + 2]);
    const MERGE_HZ = 10;
    const keptIdx: number[] = [];
    for (const idx of resIdx) {
        const freq = resEntries[idx * 5];
        if (keptIdx.every(k => Math.abs(resEntries[k * 5] - freq) > MERGE_HZ)) {
            keptIdx.push(idx);
            if (keptIdx.length >= 10) break;
        }
    }
    const topN = keptIdx.length;
    const resonanceData = new Float32Array(topN * 5);
    for (let i = 0; i < topN; i++) {
        const s = keptIdx[i] * 5, d = i * 5;
        resonanceData[d] = resEntries[s]; resonanceData[d+1] = resEntries[s+1];
        resonanceData[d+2] = resEntries[s+2]; resonanceData[d+3] = resEntries[s+3];
        resonanceData[d+4] = resEntries[s+4];
    }

    (self as unknown as Worker).postMessage(
        { busId, numFrames, numBins: bins, frameSize: size, hopSize: hop, sampleRate, timeBins, frequencies, stftData, spikeData, barData, barTimeBins, barNumBars, barNumFrames, envData, envTimeBins, numEnvFrames, resonanceData },
        [timeBins.buffer, frequencies.buffer, stftData.buffer, spikeData.buffer, barData.buffer, barTimeBins.buffer, envData.buffer, envTimeBins.buffer, resonanceData.buffer],
    );
};
