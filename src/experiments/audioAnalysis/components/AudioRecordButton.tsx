import React from "react";
import { Button, CircularProgress, Stack, Typography } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import StopIcon from "@mui/icons-material/Stop";
import { useTranslation } from "../../../i18n/i18n";
import { useAudioInputDevice } from "../state/audioInputDeviceBus";
import { audioRecordingBus } from "../state/audioRecordingBus";

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const dataSize = samples.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([buffer], { type: "audio/wav" });
}

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
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const sinkRef = React.useRef<GainNode | null>(null);

    const accumBufferRef = React.useRef<Float32Array>(new Float32Array(0));
    const totalSamplesRef = React.useRef<number>(0);
    const publishIntervalMs = 120;
    const maxPreviewSamples = 12000;
    const lastPublishRef = React.useRef<number>(0);

    const buildPreview = React.useCallback((view: Float32Array, originalSampleRate: number) => {
        if (view.length <= maxPreviewSamples) {
            return { samples: new Float32Array(view), sampleRate: originalSampleRate };
        }
        const step = Math.max(1, Math.ceil(view.length / maxPreviewSamples));
        const outLen = Math.ceil(view.length / step);
        const preview = new Float32Array(outLen);
        let w = 0;
        for (let i = 0; i < view.length; i += step) {
            preview[w++] = view[i];
        }
        const trimmed = w === outLen ? preview : preview.subarray(0, w);
        const sampleRate = originalSampleRate / step;
        return { samples: new Float32Array(trimmed), sampleRate };
    }, []);

    const cleanup = () => {
        processorRef.current?.disconnect();
        sinkRef.current?.disconnect();
        sourceRef.current?.disconnect();
        processorRef.current = null;
        sourceRef.current = null;
        sinkRef.current = null;
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => undefined);
            audioCtxRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
        streamRef.current = null;
        accumBufferRef.current = new Float32Array(0);
        totalSamplesRef.current = 0;
        lastPublishRef.current = 0;
    };

    const publishLive = (sampleRate: number) => {
        if (totalSamplesRef.current === 0) return;
        const samplesView = accumBufferRef.current.subarray(0, totalSamplesRef.current);
        const preview = buildPreview(samplesView, sampleRate);
        const duration = totalSamplesRef.current / sampleRate;
        audioRecordingBus.publish({ samples: preview.samples, sampleRate: preview.sampleRate, duration }, busId);
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError(t("experiments.audioAnalysis.components.audioRecorder.permissionError", "Microphone access is not available."));
            return;
        }

        try {
            setError(null);
            setStatus("recording");
            accumBufferRef.current = new Float32Array(0);
            totalSamplesRef.current = 0;
            lastPublishRef.current = performance.now();

            const audioConstraints: MediaTrackConstraints = {
                echoCancellation: false,
            };
            if (deviceId && deviceId !== "default") {
                audioConstraints.deviceId = { exact: deviceId };
            }

            const constraints: MediaStreamConstraints = {
                audio: audioConstraints,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            const processor = audioCtx.createScriptProcessor(2048, 1, 1);
            processorRef.current = processor;
            const sink = audioCtx.createGain();
            sink.gain.value = 0;
            sinkRef.current = sink;

            processor.onaudioprocess = (event) => {
                const input = event.inputBuffer.getChannelData(0);
                const needed = totalSamplesRef.current + input.length;
                let buf = accumBufferRef.current;
                if (needed > buf.length) {
                    const nextSize = Math.max(needed, buf.length * 2 || input.length * 2);
                    const expanded = new Float32Array(nextSize);
                    expanded.set(buf.subarray(0, totalSamplesRef.current));
                    buf = expanded;
                    accumBufferRef.current = buf;
                }
                buf.set(input, totalSamplesRef.current);
                totalSamplesRef.current = needed;

                const now = performance.now();
                if (now - lastPublishRef.current >= publishIntervalMs) {
                    lastPublishRef.current = now;
                    publishLive(audioCtx.sampleRate);
                }
            };

            source.connect(processor);
            processor.connect(sink);
            sink.connect(audioCtx.destination);
        } catch (err: any) {
            console.error(err);
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

        processorRef.current?.disconnect();
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

    return (
        <Stack spacing={1} alignItems="flex-start">
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
            {error && <Typography variant="body2" color="error">{error}</Typography>}
        </Stack>
    );
};

export default AudioRecordButton;

