let currentGain = 0.5;
const listeners = new Set<(g: number) => void>();

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

export function getGain(): number {
    return currentGain;
}

export function publishGain(next: number): void {
    const g = clamp01(next);
    currentGain = g;
    listeners.forEach((fn) => {
        try { fn(g); } catch {}
    });
}

export function subscribeGain(listener: (g: number) => void, emitCurrent = true): () => void {
    listeners.add(listener);
    if (emitCurrent) {
        try { listener(currentGain); } catch {}
    }
    return () => {
        listeners.delete(listener);
    };
}
