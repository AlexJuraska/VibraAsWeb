import React from "react";
import { Button, CircularProgress, Stack, Typography, Tooltip } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import StopIcon from "@mui/icons-material/Stop";
import { useTranslation } from "../../../i18n/i18n";
import { useAudioInputDevice } from "../state/audioInputDeviceBus";
import { audioRecordingBus } from "../state/audioRecordingBus";
import { encodeWav } from "../../../utils/encodeWav";

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

type Status = "idle" | "recording" | "processing";

type Props = {
    onRecordingComplete?: () => void;
    busId?: string;
};

const AudioRecordButton: React.FC<Props> = ({ onRecordingComplete, busId = "main" }) => {
    const { t } = useTranslation();
    const deviceId = useAudioInputDevice();

    const [status, setStatus] = React.useState<Status>("idle");
    const [error, setError] = React.useState<string | null>(null);

    const audioCtxRef = React.useRef<AudioContext | null>(null);
    const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
    const workletNodeRef = React.useRef<AudioWorkletNode | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const isRecordingRef = React.useRef<boolean>(false);

    const accumBufferRef = React.useRef<Float32Array>(new Float32Array(0));
    const totalSamplesRef = React.useRef<number>(0);
    const lastPublishRef = React.useRef<number>(0);

    const cleanup = () => {
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

    const publishLive = (sampleRate: number) => {
        const total = totalSamplesRef.current;
        if (total === 0) return;
        const windowSamples = Math.floor(sampleRate * LIVE_WINDOW_SECONDS);
        const start = Math.max(0, total - windowSamples);
        const samples = accumBufferRef.current.subarray(start, total);
        const duration = total / sampleRate;  // total elapsed, not window length
        audioRecordingBus.publish({ samples, sampleRate, duration }, busId);
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError(t("experiments.audioAnalysis.components.audioRecorder.permissionError", "Microphone access is not available."));
            return;
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
            if (deviceId && deviceId !== "default") {
                audioConstraints.deviceId = { exact: deviceId };
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
            cleanup();
        }
    };

    const stopRecording = () => {
        if (status !== "recording") return;
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

        cleanup();
        setStatus("idle");
    };

    const isBusy = status === "processing";

    const tooltipTitle = isBusy
        ? t("experiments.audioAnalysis.components.audioRecorder.tooltip.processing", "Processing recording…")
        : status === "recording"
        ? t("experiments.audioAnalysis.components.audioRecorder.tooltip.stop", "Stop and save recording")
        : t("experiments.audioAnalysis.components.audioRecorder.tooltip.start", "Record audio from the selected microphone");

    return (
        <Stack spacing={1} alignItems="flex-start">
            <Tooltip title={tooltipTitle}>
                <span>
                    <Button
                        variant={status === "recording" ? "contained" : "outlined"}
                        color={status === "recording" ? "error" : "primary"}
                        onClick={() => {
                            if (status === "recording") stopRecording();
                            else void startRecording();
                        }}
                        startIcon={status === "recording" ? <StopIcon /> : <FiberManualRecordIcon />}
                        disabled={isBusy}
                    >
                        {isBusy ? <CircularProgress size={20} /> : status === "recording"
                            ? t("experiments.audioAnalysis.components.audioRecorder.stop", "Stop Recording")
                            : t("experiments.audioAnalysis.components.audioRecorder.start", "Record")}
                    </Button>
                </span>
            </Tooltip>
            {error && <Typography variant="body2" color="error">{error}</Typography>}
        </Stack>
    );
};

export default AudioRecordButton;
