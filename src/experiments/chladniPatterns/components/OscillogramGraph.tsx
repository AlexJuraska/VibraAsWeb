import React from "react";
import Graph from "../../../components/Graph";
import type { ChartOptions } from "chart.js";
import type { ChartDataProps, Dataset, Point } from "../../../components/Graph";
import { audioSignalBus } from "../state/audioSignalBus";
import { startStopBus } from "../state/startStopBus";
import { FIXED_TIME_WINDOW_S } from "./SoundToGraphConvertor";

// rAF-driven offset that freezes when speed === 0 and resumes smoothly
const useRafOffset = (windowSec: number, speed: number) => {
    const [offset, setOffset] = React.useState(0);
    const start = React.useRef<number | undefined>(undefined);
    const rafRef = React.useRef<number | null>(null);
    const offsetRef = React.useRef(0);

    React.useEffect(() => { offsetRef.current = offset; }, [offset]);

    React.useEffect(() => {
        if (speed <= 0) {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }
        const now = performance.now();
        start.current = now - (offsetRef.current / Math.max(speed, 1e-9)) * 1000;

        const loop = (t: number) => {
            const s = start.current ?? t;
            const elapsedSec = (t - s) / 1000;
            const o = ((elapsedSec * speed) % windowSec + windowSec) % windowSec;
            setOffset(o);
            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [windowSec, speed]);

    return offset;
};

type Props = { scrollSpeed?: number };

const OscillogramGraph: React.FC<Props> = ({ scrollSpeed = 0.005 }) => {
    const [rawData, setRawData] = React.useState<ChartDataProps | undefined>(() => audioSignalBus.get());
    React.useEffect(() => {
        const unsubscribe = audioSignalBus.subscribe(setRawData);
        return () => { unsubscribe(); };
    }, []);

    const [playing, setPlaying] = React.useState<boolean>(() => startStopBus.get().playing);
    React.useEffect(() => {
        const unsubscribe = startStopBus.subscribe((s) => setPlaying(s.playing));
        return () => { unsubscribe(); }; // ensure the effect cleanup returns void
    }, []);

    const effectiveSpeed = playing ? scrollSpeed : 0;
    const offset = useRafOffset(FIXED_TIME_WINDOW_S, effectiveSpeed);

    const scrolledData = React.useMemo<ChartDataProps | undefined>(() => {
        if (!rawData || rawData.datasets.length === 0) return undefined;

        const W = FIXED_TIME_WINDOW_S;
        const out: Dataset[] = [];

        for (const ds of rawData.datasets) {
            const left: Point[] = [];
            const right: Point[] = [];
            for (const p of ds.data) {
                const shiftedX = p.x - offset;
                if (shiftedX < 0) right.push({ x: shiftedX + W, y: p.y });
                else left.push({ x: shiftedX, y: p.y });
            }
            out.push({ ...ds, data: left });
            out.push({ ...ds, label: "", data: right });
        }
        return { datasets: out };
    }, [rawData, offset]);

    const options = React.useMemo<ChartOptions<"line">>(() => ({
        animation: false,
        animations: { colors: { duration: 0 }, x: { duration: 0 }, y: { duration: 0 } },
        plugins: { legend: { display: false } },
        scales: {
            x: { type: "linear" as const, min: 0, max: FIXED_TIME_WINDOW_S, title: { display: true, text: "Time (s)" } },
            y: { type: "linear" as const, min: -1, max: 1, title: { display: true, text: "Amplitude" } }
        }
    }), []);

    return <Graph data={scrolledData} options={options} style={{ width: "100%", height: "100%" }} />;
};

export default OscillogramGraph;