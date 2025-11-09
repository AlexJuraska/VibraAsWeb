type Listener = (running: boolean) => void;

let running = false;
const subscribers = new Set<Listener>();

const notify = () => {
    subscribers.forEach((s) => {
        try {
            s(running);
        } catch {}
    });
};

export const play = () => {
    if (!running) {
        running = true;
        notify();
    }
};

export const pause = () => {
    if (running) {
        running = false;
        notify();
    }
};

export const getRunning = () => running;

export const subscribe = (fn: Listener) => {
    subscribers.add(fn);
    try {
        fn(running);
    } catch {}
    return () => {
        subscribers.delete(fn);
    };
};

export const startStopBus = {
    play,
    pause,
    getRunning: () => running,
    subscribe,
};