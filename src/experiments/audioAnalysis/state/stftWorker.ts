// Runs entirely off the main thread.
import FFT from "fft.js";

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

self.onmessage = (e: MessageEvent<{ busId: string; samples: Float32Array; sampleRate: number }>) => {
    const { busId, samples, sampleRate } = e.data;

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

    const hop = Math.max(1024, size >> 2);
    const numFrames = Math.max(1, Math.floor((samples.length - size) / hop) + 1);
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
        timeBins[fi] = (start + size / 2) / sampleRate;
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
    // frameSize=8192 gives ~5.4 Hz/bin; hop=512 gives ~11.6 ms/frame at 44.1 kHz.
    // BAR_HZ_W must match BAR_HZ in AudioAnalysisGraph.tsx.
    const BAR_HZ_W = 10;
    const rawBarFrame = Math.min(samples.length, 8192);
    const barFrameSize = 1 << Math.floor(Math.log2(Math.max(4, rawBarFrame)));
    let barData = new Float32Array(0);
    let barTimeBins = new Float32Array(0);
    let barNumBars = 0;
    let barNumFrames = 0;

    if (samples.length >= barFrameSize) {
        const BAR_HOP = 512;
        barNumBars = Math.floor((sampleRate / 2) / BAR_HZ_W);
        barNumFrames = Math.max(1, Math.floor((samples.length - barFrameSize) / BAR_HOP) + 1);
        barData = new Float32Array(barNumFrames * barNumBars);
        barTimeBins = new Float32Array(barNumFrames);

        const barFft = getFft(barFrameSize);
        const barSpectrum = barFft.createComplexArray();
        const barBuffer = new Float32Array(barFrameSize);
        const barHannWin = getHann(barFrameSize);

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
            const barBins = barFrameSize / 2;
            for (let b = 0; b <= barBins; b++) {
                const re = barSpectrum[2 * b], im = barSpectrum[2 * b + 1];
                const mag = Math.sqrt(re * re + im * im) * barNorm;
                const scaledMag = mag < EPS ? EPS : mag;
                const barIdx = Math.floor((b * sampleRate) / (barFrameSize * BAR_HZ_W));
                if (barIdx >= 0 && barIdx < barNumBars) {
                    const slot = fi * barNumBars + barIdx;
                    if (scaledMag > barData[slot]) barData[slot] = scaledMag;
                }
            }
        }
    }

    (self as unknown as Worker).postMessage(
        { busId, numFrames, numBins: bins, frameSize: size, hopSize: hop, sampleRate, timeBins, frequencies, stftData, spikeData, barData, barTimeBins, barNumBars, barNumFrames },
        [timeBins.buffer, frequencies.buffer, stftData.buffer, spikeData.buffer, barData.buffer, barTimeBins.buffer],
    );
};
