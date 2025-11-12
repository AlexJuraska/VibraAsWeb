import React from "react";

type FrequencyListener = (v: number) => void;

let currentFrequency = 440;
const listeners = new Set<FrequencyListener>();

export function publishFrequency(v: number) {
    if (!Number.isFinite(v)) return;
    currentFrequency = v;
    listeners.forEach((l) => l(v));
}

export function getCurrentFrequency() {
    return currentFrequency;
}

export function subscribeCurrentFrequency(listener: FrequencyListener) {
    listeners.add(listener);
    listener(currentFrequency);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * React hook: keeps component synced to the current frequency bus.
 */
export function useCurrentFrequency() {
    const [value, setValue] = React.useState<number>(() => currentFrequency);
    React.useEffect(() => {
        const unsub = subscribeCurrentFrequency(setValue);
        return unsub;
    }, []);
    return value;
}
