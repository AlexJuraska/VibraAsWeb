export type AudioOutputSubscriber = (audio: HTMLAudioElement | null) => void;

let currentAudio: HTMLAudioElement | null = null;
const subscribers = new Set<AudioOutputSubscriber>();

export const publishAudioElement = (audio: HTMLAudioElement | null) => {
    currentAudio = audio;
    for (const s of subscribers) s(currentAudio);
};

export const subscribeAudioElement = (cb: AudioOutputSubscriber) => {
    subscribers.add(cb);
    cb(currentAudio);
    return () => {
        subscribers.delete(cb);
    };
};
