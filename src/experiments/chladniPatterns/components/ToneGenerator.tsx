import React from "react";
import FrequencySlider from "./FrequencySlider";
import {frequencyToOscillogramData} from "./SoundToGraphConvertor";
import type {ChartDataProps} from "../../../components/Graph";
import {pause, play, subscribe} from "../state/startStopBus";
import {publishAudioElement} from "../state/audioOutputBus";
import {getGain, subscribeGain} from "../state/gainBus";

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
                                            gain,
                                            min = 80,
                                            max = 2000,
                                            step = 1,
                                            onStart,
                                            onStop,
                                            onOscillogram,
                                        }) => {
    const audioCtxRef = React.useRef<AudioContext | null>(null);
    const destRef = React.useRef<MediaStreamAudioDestinationNode | null>(null);
    const audioElRef = React.useRef<HTMLAudioElement | null>(null);
    const oscRef = React.useRef<OscillatorNode | null>(null);
    const gainRef = React.useRef<GainNode | null>(null);

    const [running, setRunning] = React.useState(false);
    const [freq, setFreq] = React.useState<number>(frequency);
    const [busGain, setBusGain] = React.useState<number>(() => getGain());

    React.useEffect(() => {
        return subscribeGain(setBusGain);
    }, []);

    const effectiveGain = typeof gain === "number" ? gain : busGain;

    const ensureContext = React.useCallback(async (): Promise<AudioContext> => {
        if (!audioCtxRef.current) {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current!;
        if (ctx.state === "suspended") {
            await ctx.resume();
        }
        if (!destRef.current) {
            destRef.current = ctx.createMediaStreamDestination();
        }
        if (!audioElRef.current) {
            const audio = document.createElement("audio");
            audio.style.position = "fixed";
            audio.style.left = "-9999px";
            audio.autoplay = true;
            audio.muted = false;
            audio.srcObject = destRef.current.stream;
            void audio.play().catch(() => {});
            document.body.appendChild(audio);
            audioElRef.current = audio;
            publishAudioElement(audio);
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
        g.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, effectiveGain)), ctx.currentTime + 0.03);

        const dest = destRef.current || ctx.createMediaStreamDestination();
        destRef.current = dest;
        osc.connect(g).connect(dest);

        if (audioElRef.current && audioElRef.current.srcObject !== dest.stream) {
            audioElRef.current.srcObject = dest.stream;
            void audioElRef.current.play().catch(() => {});
            publishAudioElement(audioElRef.current);
        }

        osc.start();

        oscRef.current = osc;
        gainRef.current = g;
        setRunning(true);

        onStart?.(freq);
        emitOscillogram(freq);
    }, [ensureContext, freq, type, effectiveGain, onStart, emitOscillogram]);

    const stop = React.useCallback(() => {
        const ctx = audioCtxRef.current;
        const osc = oscRef.current;
        const g = gainRef.current;
        if (!ctx || !osc || !g) return;

        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0, now, 0.02);

        setRunning(false);

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
            onStop?.();
        }, 80);
    }, [onStop]);

    React.useEffect(() => {
        return subscribe((r) => {
            if (r) {
                void start();
            } else {
                stop();
            }
        });
    }, [start, stop]);

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

    React.useEffect(() => {
        const ctx = audioCtxRef.current;
        const gNode = gainRef.current;
        if (!gNode || !ctx) return;

        const target = Math.max(0, Math.min(1, effectiveGain));
        const now = ctx.currentTime;

        gNode.gain.cancelScheduledValues(now);

        if (running) {
            try {
                gNode.gain.setValueAtTime(gNode.gain.value ?? 0, now);
            } catch {}
            gNode.gain.linearRampToValueAtTime(target, now + 0.02);
        } else {
            gNode.gain.setValueAtTime(target, now);
        }
    }, [effectiveGain, running]);

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
            if (audioElRef.current) {
                try {
                    if (audioElRef.current.parentNode)
                        audioElRef.current.parentNode.removeChild(audioElRef.current);
                } catch {}
                audioElRef.current = null;
                publishAudioElement(null);
            }
            destRef.current = null;
        };
    }, [stop]);

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

    return (
        <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 12 }}>
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
        </div>
    );
};

export default ToneGenerator;