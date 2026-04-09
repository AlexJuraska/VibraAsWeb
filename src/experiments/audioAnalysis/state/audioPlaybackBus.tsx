export type AudioPlayback = {
    currentTime: number;
    duration?: number;
    playing?: boolean;
};

type Listener = (state: AudioPlayback | undefined) => void;

const playbackByBus = new Map<string, AudioPlayback | undefined>();
const listenersByBus = new Map<string, Set<Listener>>();

function getListeners(busId: string): Set<Listener> {
    const existing = listenersByBus.get(busId);
    if (existing) return existing;
    const set = new Set<Listener>();
    listenersByBus.set(busId, set);
    return set;
}

function getState(busId: string): AudioPlayback | undefined {
    return playbackByBus.get(busId);
}

export const audioPlaybackBus = {
    publish(state: AudioPlayback | undefined, busId = "main") {
        playbackByBus.set(busId, state);
        getListeners(busId).forEach((l) => l(state));
    },
    get(busId = "main") {
        return getState(busId);
    },
    subscribe(listener: Listener, busId = "main") {
        const listeners = getListeners(busId);
        listeners.add(listener);
        listener(getState(busId));
        return () => {
            listeners.delete(listener);
        };
    },
};

export function useAudioPlayback(busId = "main"): AudioPlayback | undefined {
    const [state, setState] = useState<AudioPlayback | undefined>(() => getState(busId));
    useEffect(() => {
        return audioPlaybackBus.subscribe(setState, busId);
    }, [busId]);
    return state;
}

import { useEffect, useState } from "react";

