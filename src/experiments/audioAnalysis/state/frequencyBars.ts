export function getFrequencyBarCount(maxFrequencyHz: number, barWidthHz: number): number {
    if (!Number.isFinite(maxFrequencyHz) || !Number.isFinite(barWidthHz) || maxFrequencyHz <= 0 || barWidthHz <= 0) {
        return 0;
    }
    return Math.floor(maxFrequencyHz / barWidthHz);
}

/**
 * Fills `out` with per-bar maxima for a linear frequency axis.
 *
 * Each FFT bin is treated as spanning the interval halfway to its neighboring bins,
 * so a bin contributes to every bar interval it overlaps. This avoids deterministic
 * empty buckets when the FFT bin spacing is close to or larger than the bar width.
 */
export function fillFrequencyBars(
    out: Float32Array,
    magnitudes: ArrayLike<number>,
    frequencies: ArrayLike<number>,
    barWidthHz: number,
): Float32Array {
    out.fill(0);

    const barCount = out.length;
    const binCount = Math.min(magnitudes.length, frequencies.length);
    if (barCount === 0 || binCount === 0 || !Number.isFinite(barWidthHz) || barWidthHz <= 0) {
        return out;
    }

    const binSpacing = binCount > 1
        ? Math.max(0, Number(frequencies[1]) - Number(frequencies[0]))
        : barWidthHz;
    const halfBin = binSpacing / 2;

    let binStart = 0;
    for (let bar = 0; bar < barCount; bar++) {
        const barStart = bar * barWidthHz;
        const barEnd = barStart + barWidthHz;

        while (binStart < binCount && (Number(frequencies[binStart]) + halfBin) <= barStart) {
            binStart++;
        }

        let maxMag = 0;
        for (let bin = binStart; bin < binCount; bin++) {
            const left = bin === 0 ? 0 : Number(frequencies[bin]) - halfBin;
            if (left >= barEnd) break;
            const mag = Number(magnitudes[bin]);
            if (mag > maxMag) maxMag = mag;
        }
        out[bar] = maxMag;
    }

    return out;
}

export function buildFrequencyBars(
    magnitudes: ArrayLike<number>,
    frequencies: ArrayLike<number>,
    maxFrequencyHz: number,
    barWidthHz: number,
): Float32Array {
    const out = new Float32Array(getFrequencyBarCount(maxFrequencyHz, barWidthHz));
    return fillFrequencyBars(out, magnitudes, frequencies, barWidthHz);
}

