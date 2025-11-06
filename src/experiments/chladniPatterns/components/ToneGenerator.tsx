import React from "react";
import FrequencySlider from "./FrequencySlider";
import { frequencyToOscillogramData } from "./SoundToGraphConvertor";
import type { ChartDataProps } from "../../../components/Graph";
import { play, pause } from "../state/startStopBus";
import Button from "@mui/material/Button";
import {Box} from "@mui/material";

type Props = {
    frequency?: number;
    type?: OscillatorType;
    gain?: number;
    label?: string;
    min?: number;
    max?: number;
    step?: number;

    onStart?: (frequency: number) => void;
    onStop?: () => void;
    onOscillogram?: (data: ChartDataProps) => void;
};

const ToneGenerator: React.FC<Props> = ({
                                            frequency = 440,
                                            type = "sine",
                                            gain = 0.05,
                                            min = 80,
                                            max = 2000,
                                            step = 1,
                                            onStart,
                                            onStop,
                                            onOscillogram,
                                        }) => {
    const audioCtxRef = React.useRef<AudioContext | null>(null);
    const oscRef = React.useRef<OscillatorNode | null>(null);
    const gainRef = React.useRef<GainNode | null>(null);
    const [running, setRunning] = React.useState(false);
    const [freq, setFreq] = React.useState<number>(frequency);

    const ensureContext = React.useCallback(async (): Promise<AudioContext> => {
        if (!audioCtxRef.current) {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current!;
        if (ctx.state === "suspended") {
            await ctx.resume();
        }
        return ctx;
    }, []);

    const emitOscillogram = React.useCallback(
        (f: number) => {
            const data = frequencyToOscillogramData(f);
            onOscillogram?.(data);
        },
        [onOscillogram]
    );

    const start = React.useCallback(async () => {
        if (oscRef.current) return;
        const ctx = await ensureContext();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, gain)), ctx.currentTime + 0.03);

        osc.connect(g).connect(ctx.destination);
        osc.start();

        oscRef.current = osc;
        gainRef.current = g;
        setRunning(true);
        play();

        onStart?.(freq);
        emitOscillogram(freq);
    }, [ensureContext, freq, type, gain, onStart, emitOscillogram]);

    const stop = React.useCallback(() => {
        const ctx = audioCtxRef.current;
        const osc = oscRef.current;
        const g = gainRef.current;
        if (!ctx || !osc || !g) return;

        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0, now, 0.02);

        const to = setTimeout(() => {
            try {
                osc.stop();
            } catch {}
            try {
                osc.disconnect();
                g.disconnect();
            } catch {}
            oscRef.current = null;
            gainRef.current = null;
            setRunning(false);
            pause();
            clearTimeout(to);
            onStop?.();
        }, 80);
    }, [onStop]);

    React.useEffect(() => {
        setFreq(frequency);
        const ctx = audioCtxRef.current;
        const osc = oscRef.current;
        if (osc && ctx) {
            const now = ctx.currentTime;
            osc.frequency.cancelScheduledValues(now);
            osc.frequency.linearRampToValueAtTime(frequency, now + 0.015);
            emitOscillogram(frequency);
        }
    }, [frequency, emitOscillogram]);

    const onFreqChange = (next: number) => {
        setFreq(next);
        const ctx = audioCtxRef.current;
        const osc = oscRef.current;
        if (osc && ctx) {
            const now = ctx.currentTime;
            osc.frequency.cancelScheduledValues(now);
            osc.frequency.linearRampToValueAtTime(next, now + 0.01);
            if (running) emitOscillogram(next);
        }
    };

    React.useEffect(() => {
        return () => {
            try {
                stop();
            } catch {}
            const ctx = audioCtxRef.current;
            if (ctx) {
                ctx.close().catch(() => {});
                audioCtxRef.current = null;
            }
        };
    }, [stop]);

    return (
        <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <FrequencySlider
                value={freq}
                min={min}
                max={max}
                step={step}
                label="Frequency"
                onChange={onFreqChange}
                disabled={false}
                format={(v) => `${Math.round(v)} Hz`}
                color={running ? "error" : "primary"}
            />
            <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <Button
                    id="startStopBtn"
                    variant="contained"
                    color={running ? "error" : "primary"}
                    onClick={running ? stop : start}
                    sx={{ width: "33%" }}
                >
                    {running ? "Stop Sound" : "Start Sound"}
                </Button>
            </Box>
        </div>
    );
};

export default ToneGenerator;
