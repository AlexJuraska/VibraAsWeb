let savedFrequencies: number[] = [];

const listeners = new Set<(freqs: number[]) => void>();

export function getSavedFrequencies(): number[] {
    return savedFrequencies.slice();
}

export function addSavedFrequency(freq: number) {
    if (!Number.isFinite(freq)) return;
    if (savedFrequencies.includes(freq)) return;
    savedFrequencies = [...savedFrequencies, freq];
    emit();
}

export function setSavedFrequencies(next: number[]) {
    const unique = Array.from(new Set(next.filter((v) => Number.isFinite(v))));
    savedFrequencies = unique;
    emit();
}

export function clearSavedFrequencies() {
    savedFrequencies = [];
    emit();
}

export function subscribeSavedFrequencies(cb: (freqs: number[]) => void): () => void {
    listeners.add(cb);
    cb(savedFrequencies.slice());
    return () => {
        listeners.delete(cb);
    };
}

function emit() {
    const snapshot = savedFrequencies.slice();
    listeners.forEach((cb) => cb(snapshot));
}