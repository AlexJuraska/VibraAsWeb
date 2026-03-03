export type AudioRecording = {
    samples: Float32Array;
    sampleRate: number;
    duration: number;
    blob?: Blob;
};

// Listener for recording updates.
type Listener = (rec: AudioRecording | undefined) => void;

// Track recordings by bus id so multiple graphs can have independent datasets.
const recordings = new Map<string, AudioRecording | undefined>();
const listenersByBus = new Map<string, Set<Listener>>();

function getListeners(busId: string): Set<Listener> {
    const existing = listenersByBus.get(busId);
    if (existing) return existing;
    const set = new Set<Listener>();
    listenersByBus.set(busId, set);
    return set;
}

function getRecording(busId: string): AudioRecording | undefined {
    return recordings.get(busId);
}

export const audioRecordingBus = {
    publish(rec: AudioRecording | undefined, busId = "main") {
        recordings.set(busId, rec);
        getListeners(busId).forEach((l) => l(rec));
    },
    get(busId = "main") {
        return getRecording(busId);
    },
    subscribe(listener: Listener, busId = "main") {
        const listeners = getListeners(busId);
        listeners.add(listener);
        listener(getRecording(busId));
        return () => {
            listeners.delete(listener);
        };
    },
};

export function useAudioRecording(busId = "main"): AudioRecording | undefined {
    const [value, setValue] = useState<AudioRecording | undefined>(() => getRecording(busId));
    useEffect(() => {
        return audioRecordingBus.subscribe(setValue, busId);
    }, [busId]);
    return value;
}

import {useEffect, useState} from "react";
