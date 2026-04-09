import React from "react";
import { Box, Stack, Slider, TextField, InputAdornment, Button, Typography } from "@mui/material";
import AudioOutputDeviceSelector from "../../chladniPatterns/components/AudioOutputDeviceSelector";
import { useTranslation } from "../../../i18n/i18n";

const MIN_FREQ = 40;
const MAX_FREQ = 4000;
const DEFAULT_FREQ = 440;
const OUTPUT_GAIN = 0.2;

const clampFrequency = (value: number) => Math.max(MIN_FREQ, Math.min(MAX_FREQ, value));

const AudioFrequencyGenerator: React.FC = () => {
    const { t } = useTranslation();

    const [frequency, setFrequency] = React.useState<number>(DEFAULT_FREQ);
    const [running, setRunning] = React.useState<boolean>(false);

    const audioContextRef = React.useRef<AudioContext | null>(null);
    const destinationRef = React.useRef<MediaStreamAudioDestinationNode | null>(null);
    const oscillatorRef = React.useRef<OscillatorNode | null>(null);
    const gainRef = React.useRef<GainNode | null>(null);
    const stopTimeoutRef = React.useRef<number | null>(null);
    const frequencyRafRef = React.useRef<number | null>(null);
    const frequencyRef = React.useRef<number>(DEFAULT_FREQ);
    const audioElementRef = React.useRef<HTMLAudioElement | null>(null);

    const applyFrequencyToOscillator = React.useCallback(() => {
        frequencyRafRef.current = null;
        const ctx = audioContextRef.current;
        const osc = oscillatorRef.current;
        if (!ctx || !osc) return;

        const now = ctx.currentTime;
        // Apply target at frame cadence to keep dragging fluid without overwhelming AudioParam scheduling.
        osc.frequency.setTargetAtTime(frequencyRef.current, now, 0.01);
    }, []);

    const scheduleFrequencyApply = React.useCallback(() => {
        if (!oscillatorRef.current) return;
        if (frequencyRafRef.current != null) return;
        frequencyRafRef.current = window.requestAnimationFrame(() => {
            applyFrequencyToOscillator();
        });
    }, [applyFrequencyToOscillator]);

    const ensureAudioContext = React.useCallback(async () => {
        if (!audioContextRef.current) {
            const Ctx = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
                || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctx) {
                throw new Error("AudioContext is not supported in this browser.");
            }
            audioContextRef.current = new Ctx();
        }

        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
            await ctx.resume();
        }

        if (!destinationRef.current) {
            destinationRef.current = ctx.createMediaStreamDestination();
        }

        if (!audioElementRef.current) {
            const audio = document.createElement("audio");
            audio.autoplay = true;
            audio.muted = false;
            audio.style.position = "fixed";
            audio.style.left = "-9999px";
            document.body.appendChild(audio);
            audioElementRef.current = audio;
        }

        if (audioElementRef.current.srcObject !== destinationRef.current.stream) {
            audioElementRef.current.srcObject = destinationRef.current.stream;
            await audioElementRef.current.play().catch(() => undefined);
        }

        return ctx;
    }, []);

    const stopTone = React.useCallback(() => {
        const ctx = audioContextRef.current;
        const osc = oscillatorRef.current;
        const gain = gainRef.current;

        if (!ctx || !osc || !gain) {
            setRunning(false);
            return;
        }

        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.02);

        if (stopTimeoutRef.current != null) {
            window.clearTimeout(stopTimeoutRef.current);
            stopTimeoutRef.current = null;
        }

        stopTimeoutRef.current = window.setTimeout(() => {
            try {
                osc.stop();
            } catch {
                // Oscillator may already be stopped.
            }
            try {
                osc.disconnect();
                gain.disconnect();
            } catch {
                // Audio nodes may already be disconnected.
            }
            oscillatorRef.current = null;
            gainRef.current = null;
            setRunning(false);
        }, 90);
    }, []);

    const startTone = React.useCallback(async () => {
        if (oscillatorRef.current) return;

        const ctx = await ensureAudioContext();
        const destination = destinationRef.current;
        if (!destination) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequencyRef.current, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(OUTPUT_GAIN, ctx.currentTime + 0.03);

        osc.connect(gain).connect(destination);
        osc.start();

        oscillatorRef.current = osc;
        gainRef.current = gain;
        setRunning(true);
    }, [ensureAudioContext]);

    React.useEffect(() => {
        return () => {
            stopTone();
            if (stopTimeoutRef.current != null) {
                window.clearTimeout(stopTimeoutRef.current);
                stopTimeoutRef.current = null;
            }
            if (frequencyRafRef.current != null) {
                window.cancelAnimationFrame(frequencyRafRef.current);
                frequencyRafRef.current = null;
            }
            if (audioContextRef.current) {
                void audioContextRef.current.close().catch(() => undefined);
                audioContextRef.current = null;
            }
            destinationRef.current = null;
            if (audioElementRef.current) {
                if (audioElementRef.current.parentElement) {
                    audioElementRef.current.parentElement.removeChild(audioElementRef.current);
                }
                audioElementRef.current = null;
            }
        };
    }, [stopTone]);

    const handleFrequencyInput = (value: string) => {
        if (value === "") return;
        const next = Number(value);
        if (!Number.isFinite(next)) return;
        const clamped = clampFrequency(next);
        frequencyRef.current = clamped;
        setFrequency(clamped);
        scheduleFrequencyApply();
    };

    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                    {t("experiments.audioAnalysis.components.frequencyGenerator.title", "Frequency Generator")}
                </Typography>

                <AudioOutputDeviceSelector
                    audioRef={audioElementRef as React.RefObject<HTMLAudioElement>}
                    storageKey="audioAnalysis.sinkId"
                    fullWidth={true}
                />

                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        label={t("experiments.audioAnalysis.components.frequencyGenerator.frequency", "Frequency")}
                        type="number"
                        size="small"
                        value={Math.round(frequency)}
                        onChange={(e) => handleFrequencyInput(e.target.value)}
                        slotProps={{
                            input: {
                                endAdornment: <InputAdornment position="end">Hz</InputAdornment>,
                                inputProps: { min: MIN_FREQ, max: MAX_FREQ, step: 1, inputMode: "numeric" },
                            },
                        }}
                        sx={{ minWidth: 140 }}
                    />

                    <Button
                        variant="contained"
                        color={running ? "error" : "primary"}
                        onClick={() => {
                            if (running) {
                                stopTone();
                            } else {
                                void startTone();
                            }
                        }}
                    >
                        {running
                            ? t("experiments.audioAnalysis.components.frequencyGenerator.stop", "Stop Sound")
                            : t("experiments.audioAnalysis.components.frequencyGenerator.start", "Start Sound")}
                    </Button>
                </Stack>

                <Slider
                    value={frequency}
                    min={MIN_FREQ}
                    max={MAX_FREQ}
                    step={1}
                    onChange={(_, value) => {
                        const next = clampFrequency(Array.isArray(value) ? value[0] : value);
                        frequencyRef.current = next;
                        setFrequency(next);
                        scheduleFrequencyApply();
                    }}
                    aria-label={t("experiments.audioAnalysis.components.frequencyGenerator.frequency", "Frequency")}
                />
            </Stack>
        </Box>
    );
};

export default AudioFrequencyGenerator;


