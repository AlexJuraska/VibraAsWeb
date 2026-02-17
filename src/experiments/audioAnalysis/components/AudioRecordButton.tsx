import React from "react";
import { Button, CircularProgress, Stack, Typography } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import StopIcon from "@mui/icons-material/Stop";
import { useTranslation } from "../../../i18n/i18n";
import { useAudioInputDevice } from "../state/audioInputDeviceBus";
import { audioRecordingBus } from "../state/audioRecordingBus";

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const dataSize = samples.length * 2; // 16-bit PCM
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // format PCM
    view.setUint16(22, 1, true); // channels
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
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
};

const AudioRecordButton: React.FC<Props> = ({ onRecordingComplete }) => {
    const { t } = useTranslation();
    const deviceId = useAudioInputDevice();

    const [status, setStatus] = React.useState<Status>("idle");
    const [error, setError] = React.useState<string | null>(null);

    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const chunksRef = React.useRef<Blob[]>([]);

    const resetStreams = () => {
        mediaRecorderRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
        streamRef.current = null;
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError(t("experiments.audioAnalysis.components.audioRecorder.permissionError", "Microphone access is not available."));
            return;
        }
        if (typeof MediaRecorder === "undefined") {
            setError(t("experiments.audioAnalysis.components.audioRecorder.unsupported", "MediaRecorder is not supported in this browser."));
            return;
        }

        try {
            setError(null);
            setStatus("recording");
            chunksRef.current = [];

            const constraints: MediaStreamConstraints = {
                audio: deviceId && deviceId !== "default" ? { deviceId: { exact: deviceId } } : true,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onerror = (e) => {
                console.error("MediaRecorder error", e);
                setError(t("experiments.audioAnalysis.components.audioRecorder.recordingError", "Recording failed."));
                setStatus("idle");
                resetStreams();
            };

            recorder.onstop = async () => {
                try {
                    setStatus("processing");
                    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioCtx = new AudioContext();
                    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
                    const channel = decoded.getChannelData(0);
                    const copy = new Float32Array(channel.length);
                    copy.set(channel);

                    const wavBlob = encodeWav(copy, decoded.sampleRate);
                    audioRecordingBus.publish({ samples: copy, sampleRate: decoded.sampleRate, duration: decoded.duration, blob: wavBlob });
                     onRecordingComplete?.();
                     setStatus("idle");
                } catch (err) {
                    console.error(err);
                    setError(t("experiments.audioAnalysis.components.audioRecorder.decodeError", "Could not decode the recording."));
                    setStatus("idle");
                } finally {
                    resetStreams();
                }
            };

            recorder.start();
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
            resetStreams();
        }
    };

    const stopRecording = () => {
        if (status !== "recording") return;
        setStatus("processing");
        mediaRecorderRef.current?.stop();
        resetStreams();
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

