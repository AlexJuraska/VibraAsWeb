import type { ChartDataProps } from "../../../components/Graph";

type Listener = (data: ChartDataProps | undefined) => void;

let current: ChartDataProps | undefined = undefined;
const listeners = new Set<Listener>();

export const audioSignalBus = {
    publish(data: ChartDataProps | undefined) {
        current = data;
        for (const l of Array.from(listeners)) l(current);
    },
    subscribe(listener: Listener): () => void {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
    get() {
        return current;
    }
};