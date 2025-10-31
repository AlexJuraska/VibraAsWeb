export type TransportState = { playing: boolean };

type Subscriber<T> = (value: T) => void;

const createBus = <T,>(initial: T) => {
    let current = initial;
    const subs = new Set<Subscriber<T>>();
    return {
        get: () => current,
        set: (value: T) => {
            current = value;
            subs.forEach((fn) => fn(current));
        },
        subscribe: (fn: Subscriber<T>) => {
            subs.add(fn);
            return () => subs.delete(fn);
        }
    };
};

export const startStopBus = createBus<TransportState>({ playing: false });

export const play = () => startStopBus.set({ playing: true });
export const pause = () => startStopBus.set({ playing: false });