import React from "react";
import {
    Box,
    Button,
    CircularProgress,
    FormControl,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useTranslation } from "../../../i18n/i18n";
import { useAudioInputDevice } from "../../audioAnalysis/state/audioInputDeviceBus";
import { audioRecordingBus } from "../../audioAnalysis/state/audioRecordingBus";
import { encodeWav } from "../../../utils/encodeWav";

const MIN_FREQ = 40;
const MAX_FREQ = 10000;
const MIN_DURATION = 1;
const MAX_DURATION = 120;
const DEFAULT_START_FREQ = 200;
const DEFAULT_END_FREQ = 1000;
const DEFAULT_DURATION = 10;
const OUTPUT_GAIN = 0.2;
const STORAGE_KEY = "automaticAudioAnalysis.sinkId";

const clampFreq = (v: number) => Math.max(MIN_FREQ, Math.min(MAX_FREQ, v));
const clampDuration = (v: number) => Math.max(MIN_DURATION, Math.min(MAX_DURATION, v));

const supportsCtxSinkId =
    typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype;

type OutputDevice = { deviceId: string; label: string };

type Status = "idle" | "recording" | "processing";

type Props = {
    onRecordingComplete?: () => void;
    busId?: string;
};

const LIVE_WINDOW_SECONDS = 4;
const PUBLISH_INTERVAL_MS = 50;

const WORKLET_CODE = `
class RecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._chunks = [];
        this._totalLength = 0;
        this._batchSamples = 2048;
    }
    process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (channel && channel.length > 0) {
            this._chunks.push(new Float32Array(channel));
            this._totalLength += channel.length;
            if (this._totalLength >= this._batchSamples) {
                const batch = new Float32Array(this._totalLength);
                let offset = 0;
                for (let i = 0; i < this._chunks.length; i++) {
                    batch.set(this._chunks[i], offset);
                    offset += this._chunks[i].length;
                }
                this.port.postMessage(batch, [batch.buffer]);
                this._chunks = [];
                this._totalLength = 0;
            }
        }
        return true;
    }
}
registerProcessor('recorder-processor', RecorderProcessor);
`;

const AutoSweepRecordButton: React.FC<Props> = ({ onRecordingComplete, busId = "main" }) => {
    const { t } = useTranslation();
    const inputDeviceId = useAudioInputDevice();

    const [startFreq, setStartFreq] = React.useState(DEFAULT_START_FREQ);
    const [endFreq, setEndFreq] = React.useState(DEFAULT_END_FREQ);
    const [durationSec, setDurationSec] = React.useState(DEFAULT_DURATION);
    const [startFreqInput, setStartFreqInput] = React.useState(String(DEFAULT_START_FREQ));
    const [endFreqInput, setEndFreqInput] = React.useState(String(DEFAULT_END_FREQ));
    const [durationInput, setDurationInput] = React.useState(String(DEFAULT_DURATION));

    const [status, setStatus] = React.useState<Status>("idle");
    const [error, setError] = React.useState<string | null>(null);
    const statusRef = React.useRef<Status>("idle");

    const [sinkId, setSinkId] = React.useState(
        () => localStorage.getItem(STORAGE_KEY) ?? "default",
    );
    const [devices, setDevices] = React.useState<OutputDevice[]>([]);

    const audioCtxRef = React.useRef<AudioContext | null>(null);
    const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
    const workletNodeRef = React.useRef<AudioWorkletNode | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const isRecordingRef = React.useRef<boolean>(false);

    const accumBufferRef = React.useRef<Float32Array>(new Float32Array(0));
    const totalSamplesRef = React.useRef<number>(0);
    const lastPublishRef = React.useRef<number>(0);

    const toneCtxRef = React.useRef<AudioContext | null>(null);
    const oscRef = React.useRef<OscillatorNode | null>(null);
    const gainRef = React.useRef<GainNode | null>(null);
    const sweepStartRef = React.useRef<number | null>(null);
    const sweepRafRef = React.useRef<number | null>(null);
    const sweepTimerRef = React.useRef<number | null>(null);
    const lastStepRef = React.useRef<number>(-1);
    const stoppingRef = React.useRef<boolean>(false);
    const sinkIdRef = React.useRef<string>(sinkId);

    React.useEffect(() => {
        statusRef.current = status;
    }, [status]);

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
                    label: d.label || (d.deviceId === "default" ? "System default" : `Device …${d.deviceId.slice(-4)}`),
                }));
            if (!outs.some((d) => d.deviceId === "default")) {
                outs.unshift({ deviceId: "default", label: "System default" });
            }
            setDevices(outs);
        }).catch(() => undefined);

        const refresh = () => {
            navigator.mediaDevices?.enumerateDevices().then((list) => {
                const outs: OutputDevice[] = list
                    .filter((d) => d.kind === "audiooutput")
                    .map((d) => ({
                        deviceId: d.deviceId,
                        label: d.label || (d.deviceId === "default" ? "System default" : `Device …${d.deviceId.slice(-4)}`),
                    }));
                if (!outs.some((d) => d.deviceId === "default")) {
                    outs.unshift({ deviceId: "default", label: "System default" });
                }
                setDevices(outs);
            }).catch(() => undefined);
        };
        navigator.mediaDevices?.addEventListener("devicechange", refresh);
        return () => navigator.mediaDevices?.removeEventListener("devicechange", refresh);
    }, []);

    React.useEffect(() => {
        const ctx = toneCtxRef.current;
        if (!ctx || !supportsCtxSinkId) return;
        void (ctx as any).setSinkId(sinkId === "default" ? "" : sinkId).catch(() => undefined);
    }, [sinkId]);

    const getToneCtx = React.useCallback(async () => {
        let ctx = toneCtxRef.current;
        if (!ctx) {
            ctx = new AudioContext();
            toneCtxRef.current = ctx;
            if (supportsCtxSinkId) {
                const id = sinkIdRef.current;
                await (ctx as any).setSinkId(id === "default" ? "" : id).catch(() => undefined);
            }
        }
        if (ctx.state === "suspended") await ctx.resume();
        return ctx;
    }, []);

    const cleanupRecording = () => {
        isRecordingRef.current = false;
        if (workletNodeRef.current) {
            workletNodeRef.current.port.onmessage = null;
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        sourceRef.current?.disconnect();
        sourceRef.current = null;
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => undefined);
            audioCtxRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        accumBufferRef.current = new Float32Array(0);
        totalSamplesRef.current = 0;
        lastPublishRef.current = 0;
    };

    const cleanupSweep = () => {
        if (sweepRafRef.current != null) cancelAnimationFrame(sweepRafRef.current);
        if (sweepTimerRef.current != null) window.clearTimeout(sweepTimerRef.current);
        sweepRafRef.current = null;
        sweepTimerRef.current = null;
        sweepStartRef.current = null;
        lastStepRef.current = -1;
    };

    const stopTone = React.useCallback(() => {
        cleanupSweep();
        const osc = oscRef.current;
        const gain = gainRef.current;
        const ctx = toneCtxRef.current;
        oscRef.current = null;
        gainRef.current = null;
        toneCtxRef.current = null;
        if (osc && gain && ctx) {
            const now = ctx.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.setTargetAtTime(0, now, 0.02);
            osc.stop(now + 0.1);
            osc.addEventListener("ended", () => {
                try { osc.disconnect(); } catch { /* already disconnected */ }
                try { gain.disconnect(); } catch { /* already disconnected */ }
            });
            ctx.close().catch(() => undefined);
        } else if (ctx) {
            ctx.close().catch(() => undefined);
        }
    }, []);

    const publishLive = (sampleRate: number) => {
        const total = totalSamplesRef.current;
        if (total === 0) return;
        const windowSamples = Math.floor(sampleRate * LIVE_WINDOW_SECONDS);
        const start = Math.max(0, total - windowSamples);
        const samples = accumBufferRef.current.slice(start, total);
        const duration = samples.length / sampleRate;
        audioRecordingBus.publish({ samples, sampleRate, duration }, busId);
    };

    const startRecordingInternal = async (): Promise<boolean> => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError(t("experiments.audioAnalysis.components.audioRecorder.permissionError", "Microphone access is not available."));
            return false;
        }

        try {
            setError(null);
            setStatus("recording");
            isRecordingRef.current = true;
            accumBufferRef.current = new Float32Array(0);
            totalSamplesRef.current = 0;
            lastPublishRef.current = performance.now();

            const audioConstraints: MediaTrackConstraints = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            };
            if (inputDeviceId && inputDeviceId !== "default") {
                audioConstraints.deviceId = { exact: inputDeviceId };
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            streamRef.current = stream;

            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;

            const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
            const workletUrl = URL.createObjectURL(blob);
            await audioCtx.audioWorklet.addModule(workletUrl);
            URL.revokeObjectURL(workletUrl);

            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;

            const workletNode = new AudioWorkletNode(audioCtx, "recorder-processor");
            workletNodeRef.current = workletNode;

            workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
                if (!isRecordingRef.current) return;
                const chunk = event.data;

                const needed = totalSamplesRef.current + chunk.length;
                let buf = accumBufferRef.current;
                if (needed > buf.length) {
                    const nextSize = Math.max(needed, buf.length * 2 || chunk.length * 2);
                    const expanded = new Float32Array(nextSize);
                    expanded.set(buf.subarray(0, totalSamplesRef.current));
                    buf = expanded;
                    accumBufferRef.current = buf;
                }
                buf.set(chunk, totalSamplesRef.current);
                totalSamplesRef.current = needed;

                const now = performance.now();
                if (now - lastPublishRef.current >= PUBLISH_INTERVAL_MS) {
                    lastPublishRef.current = now;
                    publishLive(audioCtx.sampleRate);
                }
            };

            source.connect(workletNode);
            const silentOut = audioCtx.createGain();
            silentOut.gain.value = 0;
            workletNode.connect(silentOut);
            silentOut.connect(audioCtx.destination);
            return true;
        } catch (err: any) {
            console.error(err);
            isRecordingRef.current = false;
            if (err?.name === "NotAllowedError") {
                setError(t("experiments.audioAnalysis.components.audioRecorder.permissionDenied", "Microphone permission denied."));
            } else if (err?.name === "NotFoundError") {
                setError(t("experiments.audioAnalysis.components.audioRecorder.deviceNotFound", "Selected input device not found."));
            } else {
                setError(t("experiments.audioAnalysis.components.audioRecorder.startError", "Could not start recording."));
            }
            setStatus("idle");
            cleanupRecording();
            return false;
        }
    };

    const stopRecordingInternal = React.useCallback(() => {
        if (statusRef.current !== "recording") return;
        setStatus("processing");
        isRecordingRef.current = false;

        if (workletNodeRef.current) {
            workletNodeRef.current.port.onmessage = null;
            workletNodeRef.current.disconnect();
        }
        sourceRef.current?.disconnect();
        streamRef.current?.getTracks().forEach((t) => t.stop());

        const audioCtx = audioCtxRef.current;
        const sampleRate = audioCtx?.sampleRate;
        const totalSamples = totalSamplesRef.current;

        if (sampleRate && totalSamples > 0) {
            const samplesView = accumBufferRef.current.subarray(0, totalSamples);
            const samples = new Float32Array(samplesView.length);
            samples.set(samplesView);
            const duration = samples.length / sampleRate;
            const wavBlob = encodeWav(samples, sampleRate);
            audioRecordingBus.publish({ samples, sampleRate, duration, blob: wavBlob }, busId);
            onRecordingComplete?.();
        }

        cleanupRecording();
        setStatus("idle");
        stoppingRef.current = false;
    }, [busId, onRecordingComplete]);

    const startSweepTone = React.useCallback(async (start: number, end: number, duration: number) => {
        if (oscRef.current) return true;
        const ctx = await getToneCtx();
        if (!ctx) return false;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(start, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(OUTPUT_GAIN, ctx.currentTime + 0.02);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;

        const totalSteps = Math.max(1, Math.abs(end - start));
        const stepDurationMs = (duration * 1000) / totalSteps;
        const direction = end >= start ? 1 : -1;
        lastStepRef.current = -1;
        sweepStartRef.current = performance.now();

        const update = () => {
            if (!sweepStartRef.current || !oscRef.current || !toneCtxRef.current) return;
            const elapsedMs = performance.now() - sweepStartRef.current;
            const stepsElapsed = Math.min(totalSteps, Math.floor(elapsedMs / stepDurationMs));
            if (stepsElapsed !== lastStepRef.current) {
                lastStepRef.current = stepsElapsed;
                const nextFreq = clampFreq(start + direction * stepsElapsed);
                oscRef.current.frequency.setTargetAtTime(nextFreq, toneCtxRef.current.currentTime, 0.01);
            }
            if (stepsElapsed >= totalSteps) {
                stopAll();
                return;
            }
            sweepRafRef.current = requestAnimationFrame(update);
        };

        sweepRafRef.current = requestAnimationFrame(update);
        sweepTimerRef.current = window.setTimeout(() => {
            stopAll();
        }, duration * 1000 + 50);

        return true;
    }, [getToneCtx]);

    const stopAll = React.useCallback(() => {
        if (stoppingRef.current || statusRef.current !== "recording") return;
        stoppingRef.current = true;
        stopTone();
        stopRecordingInternal();
    }, [stopRecordingInternal, stopTone]);

    const startAutoSweep = async () => {
        if (statusRef.current !== "idle") return;
        const safeDuration = clampDuration(durationSec);
        if (safeDuration <= 0) {
            setError(t("experiments.automaticAudioAnalysis.components.autoSweep.invalidRange", "Invalid sweep settings."));
            return;
        }

        const recStarted = await startRecordingInternal();
        if (!recStarted) return;

        const sweepStarted = await startSweepTone(
            clampFreq(startFreq),
            clampFreq(endFreq),
            safeDuration,
        );
        if (!sweepStarted) {
            stopRecordingInternal();
        }
    };

    React.useEffect(() => {
        return () => {
            cleanupSweep();
            stopTone();
            cleanupRecording();
        };
    }, [stopTone]);

    const safeSelected = devices.some((d) => d.deviceId === sinkId) ? sinkId : "default";
    const isBusy = status === "processing";
    const isRecording = status === "recording";

    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                    {t("experiments.automaticAudioAnalysis.components.autoSweep.title", "Auto Sweep Recording")}
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

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <TextField
                        label={t("experiments.automaticAudioAnalysis.components.autoSweep.startFrequency", "Start Frequency")}
                        type="number"
                        size="small"
                        value={startFreqInput}
                        onChange={(e) => setStartFreqInput(e.target.value)}
                        onBlur={(e) => {
                            const v = Number(e.target.value);
                            const next = Number.isFinite(v) && v > 0 ? clampFreq(v) : startFreq;
                            setStartFreq(next);
                            setStartFreqInput(String(Math.round(next)));
                        }}
                        disabled={isRecording || isBusy}
                        slotProps={{
                            input: {
                                endAdornment: <InputAdornment position="end">Hz</InputAdornment>,
                                inputProps: { min: MIN_FREQ, max: MAX_FREQ, step: 1, inputMode: "numeric" },
                            },
                        }}
                        sx={{ minWidth: 160 }}
                    />
                    <TextField
                        label={t("experiments.automaticAudioAnalysis.components.autoSweep.endFrequency", "End Frequency")}
                        type="number"
                        size="small"
                        value={endFreqInput}
                        onChange={(e) => setEndFreqInput(e.target.value)}
                        onBlur={(e) => {
                            const v = Number(e.target.value);
                            const next = Number.isFinite(v) && v > 0 ? clampFreq(v) : endFreq;
                            setEndFreq(next);
                            setEndFreqInput(String(Math.round(next)));
                        }}
                        disabled={isRecording || isBusy}
                        slotProps={{
                            input: {
                                endAdornment: <InputAdornment position="end">Hz</InputAdornment>,
                                inputProps: { min: MIN_FREQ, max: MAX_FREQ, step: 1, inputMode: "numeric" },
                            },
                        }}
                        sx={{ minWidth: 160 }}
                    />
                    <TextField
                        label={t("experiments.automaticAudioAnalysis.components.autoSweep.duration", "Duration")}
                        type="number"
                        size="small"
                        value={durationInput}
                        onChange={(e) => setDurationInput(e.target.value)}
                        onBlur={(e) => {
                            const v = Number(e.target.value);
                            const next = Number.isFinite(v) && v > 0 ? clampDuration(v) : durationSec;
                            setDurationSec(next);
                            setDurationInput(String(Math.round(next)));
                        }}
                        disabled={isRecording || isBusy}
                        slotProps={{
                            input: {
                                endAdornment: <InputAdornment position="end">s</InputAdornment>,
                                inputProps: { min: MIN_DURATION, max: MAX_DURATION, step: 1, inputMode: "numeric" },
                            },
                        }}
                        sx={{ minWidth: 140 }}
                    />
                </Stack>

                <Stack spacing={1} alignItems="flex-start">
                    <Button
                        variant={isRecording ? "contained" : "outlined"}
                        color={isRecording ? "error" : "primary"}
                        onClick={() => {
                            if (isRecording) stopAll();
                            else void startAutoSweep();
                        }}
                        disabled={isBusy}
                    >
                        {isBusy ? <CircularProgress size={20} /> : isRecording
                            ? t("experiments.automaticAudioAnalysis.components.autoSweep.stop", "Stop Recording")
                            : t("experiments.automaticAudioAnalysis.components.autoSweep.start", "Record Sweep")}
                    </Button>
                    {error && <Typography variant="body2" color="error">{error}</Typography>}
                </Stack>
            </Stack>
        </Box>
    );
};

export default AutoSweepRecordButton;

