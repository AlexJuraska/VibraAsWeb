import React from "react";
import { Box, FormControl, InputLabel, MenuItem, Select, Slider, Stack, TextField, InputAdornment, Button, Typography } from "@mui/material";
import { useTranslation } from "../../../i18n/i18n";
import { audioFrequencyCommandBus } from "../state/audioFrequencyCommandBus";

const MIN_FREQ = 40;
const MAX_FREQ = 10000;
const DEFAULT_FREQ = 440;
const OUTPUT_GAIN = 0.2;
const STORAGE_KEY = "audioAnalysis.sinkId";

const clampFreq = (v: number) => Math.max(MIN_FREQ, Math.min(MAX_FREQ, v));

const supportsCtxSinkId =
    typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype;

type OutputDevice = { deviceId: string; label: string };

const AudioFrequencyGenerator: React.FC = () => {
    const { t } = useTranslation();

    const [frequency, setFrequency] = React.useState(DEFAULT_FREQ);
    const [inputValue, setInputValue] = React.useState(String(DEFAULT_FREQ));
    const [running, setRunning] = React.useState(false);
    const [sinkId, setSinkId] = React.useState(
        () => localStorage.getItem(STORAGE_KEY) ?? "default",
    );
    const [devices, setDevices] = React.useState<OutputDevice[]>([]);

    const ctxRef = React.useRef<AudioContext | null>(null);
    const oscRef = React.useRef<OscillatorNode | null>(null);
    const gainRef = React.useRef<GainNode | null>(null);
    const freqRef = React.useRef(DEFAULT_FREQ);
    const sinkIdRef = React.useRef(sinkId);
    const rafRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        sinkIdRef.current = sinkId;
    }, [sinkId]);

    React.useEffect(() => {
        if (!supportsCtxSinkId) return;
        navigator.mediaDevices?.enumerateDevices().then((list) => {
            const outs: OutputDevice[] = list
                .filter((d) => d.kind === "audiooutput")
                .map((d) => ({
                    deviceId: d.deviceId,
                    label: d.label || (d.deviceId === "default" ? t("experiments.audioAnalysis.components.frequencyGenerator.systemDefault", "System default") : `Device …${d.deviceId.slice(-4)}`),
                }));
            if (!outs.some((d) => d.deviceId === "default")) {
                outs.unshift({ deviceId: "default", label: "System default" });
            }
            setDevices(outs);
        }).catch(() => {});

        const refresh = () => {
            navigator.mediaDevices?.enumerateDevices().then((list) => {
                const outs: OutputDevice[] = list
                    .filter((d) => d.kind === "audiooutput")
                    .map((d) => ({
                        deviceId: d.deviceId,
                        label: d.label || (d.deviceId === "default" ? t("experiments.audioAnalysis.components.frequencyGenerator.systemDefault", "System default") : `Device …${d.deviceId.slice(-4)}`),
                    }));
                if (!outs.some((d) => d.deviceId === "default")) {
                    outs.unshift({ deviceId: "default", label: "System default" });
                }
                setDevices(outs);
            }).catch(() => {});
        };
        navigator.mediaDevices?.addEventListener("devicechange", refresh);
        return () => navigator.mediaDevices?.removeEventListener("devicechange", refresh);
    }, []);

    React.useEffect(() => {
        const ctx = ctxRef.current;
        if (!ctx || !supportsCtxSinkId) return;
        void (ctx as any).setSinkId(sinkId === "default" ? "" : sinkId).catch(() => {});
    }, [sinkId]);

    const getCtx = React.useCallback(async () => {
        let ctx = ctxRef.current;
        if (!ctx) {
            ctx = new AudioContext();
            ctxRef.current = ctx;
            if (supportsCtxSinkId) {
                const id = sinkIdRef.current;
                await (ctx as any).setSinkId(id === "default" ? "" : id).catch(() => {});
            }
        }
        if (ctx.state === "suspended") await ctx.resume();
        return ctx;
    }, []);

    const applyFrequency = React.useCallback(() => {
        rafRef.current = null;
        const osc = oscRef.current;
        const ctx = ctxRef.current;
        if (!osc || !ctx) return;
        osc.frequency.setTargetAtTime(freqRef.current, ctx.currentTime, 0.01);
    }, []);

    const scheduleFreq = React.useCallback(() => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(applyFrequency);
    }, [applyFrequency]);

    const startTone = React.useCallback(async () => {
        if (oscRef.current) return;
        const ctx = await getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freqRef.current, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(OUTPUT_GAIN, ctx.currentTime + 0.02);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;
        setRunning(true);
    }, [getCtx]);

    const stopTone = React.useCallback(() => {
        const osc = oscRef.current;
        const gain = gainRef.current;
        const ctx = ctxRef.current;
        oscRef.current = null;
        gainRef.current = null;
        setRunning(false);
        if (!osc || !gain || !ctx) return;
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.02);
        osc.stop(now + 0.1);
        osc.addEventListener("ended", () => {
            try { osc.disconnect(); } catch { /* already disconnected */ }
            try { gain.disconnect(); } catch { /* already disconnected */ }
        });
    }, []);

    // External command: set frequency and start tone (or smoothly retune if already playing).
    React.useEffect(() => {
        return audioFrequencyCommandBus.subscribe(({ frequency }) => {
            const clamped = clampFreq(frequency);
            freqRef.current = clamped;
            setFrequency(clamped);
            setInputValue(String(Math.round(clamped)));
            scheduleFreq();
            void startTone(); // no-op if oscillator already running; retune handled by scheduleFreq
        });
    }, [scheduleFreq, startTone]);

    React.useEffect(() => {
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
            const osc = oscRef.current;
            const gain = gainRef.current;
            const ctx = ctxRef.current;
            oscRef.current = null;
            gainRef.current = null;
            ctxRef.current = null;
            if (osc) { try { osc.stop(); } catch {} try { osc.disconnect(); } catch {} }
            if (gain) { try { gain.disconnect(); } catch {} }
            if (ctx) void ctx.close().catch(() => {});
        };
    }, []);

    const handleFreqChange = (v: number) => {
        const next = clampFreq(v);
        freqRef.current = next;
        setFrequency(next);
        setInputValue(String(Math.round(next)));
        scheduleFreq();
    };

    const safeSelected = devices.some((d) => d.deviceId === sinkId) ? sinkId : "default";

    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                    {t("experiments.audioAnalysis.components.frequencyGenerator.title", "Frequency Generator")}
                </Typography>

                {supportsCtxSinkId && devices.length > 0 && (
                    <FormControl size="small" fullWidth>
                        <InputLabel>
                            {t("experiments.chladni.components.audioOutputSelector.label", "Audio Output Device")}
                        </InputLabel>
                        <Select
                            value={safeSelected}
                            label={t("experiments.chladni.components.audioOutputSelector.label", "Audio Output Device")}
                            onChange={(e) => {
                                const id = e.target.value as string;
                                setSinkId(id);
                                localStorage.setItem(STORAGE_KEY, id);
                            }}
                        >
                            {devices.map((d) => (
                                <MenuItem key={d.deviceId} value={d.deviceId}>
                                    {d.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}

                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        label={t("experiments.audioAnalysis.components.frequencyGenerator.frequency", "Frequency")}
                        type="number"
                        size="small"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && v >= MIN_FREQ && v <= MAX_FREQ) {
                                freqRef.current = v;
                                scheduleFreq();
                            }
                        }}
                        onBlur={(e) => {
                            const v = Number(e.target.value);
                            const next = Number.isFinite(v) && v > 0 ? clampFreq(v) : frequency;
                            freqRef.current = next;
                            setFrequency(next);
                            setInputValue(String(Math.round(next)));
                            scheduleFreq();
                        }}
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
                        onClick={() => (running ? stopTone() : void startTone())}
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
                    onChange={(_, v) => handleFreqChange(Array.isArray(v) ? v[0] : v)}
                    aria-label={t("experiments.audioAnalysis.components.frequencyGenerator.frequency", "Frequency")}
                />
            </Stack>
        </Box>
    );
};

export default AudioFrequencyGenerator;
