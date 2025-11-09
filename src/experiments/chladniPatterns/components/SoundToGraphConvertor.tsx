import type { ChartDataProps, Point } from '../../../components/Graph';

export const FIXED_TIME_WINDOW_S = 0.05;

const POINTS_PER_CYCLE = 64;
const MAX_POINTS = 3000;
const Y_MAX = 1;
const Y_MIN = -1;

export function frequencyToOscillogramData(
    frequency: number,
    amplitude = 1,
    phase = 0
): ChartDataProps {
    if (!Number.isFinite(frequency) || frequency <= 0) {
        return { datasets: [{ label: 'Invalid frequency', data: [] }] };
    }

    const period = 1 / frequency;

    const desiredStep = period / POINTS_PER_CYCLE;
    const minStepToRespectCap = FIXED_TIME_WINDOW_S / MAX_POINTS;
    const step = Math.max(desiredStep, minStepToRespectCap);

    const samples = Math.min(Math.floor(FIXED_TIME_WINDOW_S / step) + 1, MAX_POINTS + 1);
    const points: Point[] = [];

    for (let i = 0; i < samples; i++) {
        const t = i * step;
        const y = Math.sin(2 * Math.PI * frequency * t + phase) * amplitude;
        const clamped = Math.max(Y_MIN, Math.min(Y_MAX, y));
        points.push({ x: Number(t.toFixed(6)), y: Number(clamped.toFixed(6)) });
    }

    return {
        datasets: [
            {
                label: `${frequency} Hz`,
                type: 'line',
                pointRadius: 0,
                data: points
            }
        ]
    };
}