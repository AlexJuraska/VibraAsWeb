export type AudioRecording = {
    samples: Float32Array;
    sampleRate: number;
    duration: number;
    blob?: Blob;
};

type Listener = (rec: AudioRecording | undefined) => void;

let current: AudioRecording | undefined;
const listeners = new Set<Listener>();

export const audioRecordingBus = {
    publish(rec: AudioRecording | undefined) {
        current = rec;
        listeners.forEach((l) => l(rec));
    },
    get() {
        return current;
    },
    subscribe(listener: Listener) {
        listeners.add(listener);
        listener(current);
        return () => {
            listeners.delete(listener);
        };
    },
};

export function useAudioRecording(): AudioRecording | undefined {
    const [value, setValue] = useState<AudioRecording | undefined>(() => current);
    useEffect(() => {
        return audioRecordingBus.subscribe(setValue);
    }, []);
    return value;
}

import {useEffect, useState} from "react";
