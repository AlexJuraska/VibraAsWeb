type FrequencyCommand = { frequency: number };
type Listener = (cmd: FrequencyCommand) => void;

const listeners = new Set<Listener>();

export const audioFrequencyCommandBus = {
    send(cmd: FrequencyCommand) {
        listeners.forEach((l) => l(cmd));
    },
    subscribe(listener: Listener): () => void {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },
};
