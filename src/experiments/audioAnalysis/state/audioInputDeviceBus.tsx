type Listener = (deviceId: string) => void;

const listeners = new Set<Listener>();
let currentDeviceId = "default";

export const audioInputDeviceBus = {
    publish(deviceId: string) {
        currentDeviceId = deviceId;
        listeners.forEach((l) => l(deviceId));
    },
    get() {
        return currentDeviceId;
    },
    subscribe(listener: Listener) {
        listeners.add(listener);
        listener(currentDeviceId);
        return () => {
            listeners.delete(listener);
        };
    },
};

export function useAudioInputDevice(): string {
    const [deviceId, setDeviceId] = useState<string>(() => audioInputDeviceBus.get());

    useEffect(() => {
        return audioInputDeviceBus.subscribe(setDeviceId);
    }, []);

    return deviceId;
}

import {useEffect, useState} from "react";
