import React from "react";
import { Button, Stack, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useTranslation } from "../../../i18n/i18n";
import { audioRecordingBus } from "../state/audioRecordingBus";

const AudioFileUploader: React.FC = () => {
    const { t } = useTranslation();
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);

    const handleFile = async (file: File) => {
        setLoading(true);
        setError(null);
        try {
            const lower = file.name.toLowerCase();
            const isWav = lower.endsWith(".wav") || file.type === "audio/wav" || file.type === "audio/wave";
            if (!isWav) {
                setError(t("experiments.audioAnalysis.components.audioFileUploader.onlyWav", "Please select a .wav file."));
                return;
            }

            const arrayBuffer = await file.arrayBuffer();
            const audioCtx = new AudioContext();
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            const channelData = decoded.numberOfChannels > 0 ? decoded.getChannelData(0) : new Float32Array();
            const samples = new Float32Array(channelData.length);
            samples.set(channelData);

            audioRecordingBus.publish({
                samples,
                sampleRate: decoded.sampleRate,
                duration: decoded.duration,
                blob: file,
            });
        } catch (err) {
            console.error(err);
            setError(t("experiments.audioAnalysis.components.audioFileUploader.decodeError", "Could not read the audio file."));
        } finally {
            setLoading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
    };

    return (
        <Stack spacing={1} alignItems="flex-start">
            <input
                ref={inputRef}
                type="file"
                accept=".wav,audio/wav"
                style={{ display: "none" }}
                onChange={onChange}
            />
            <Button
                variant="outlined"
                onClick={() => inputRef.current?.click()}
                startIcon={<UploadFileIcon />}
                disabled={loading}
            >
                {loading
                    ? t("experiments.audioAnalysis.components.audioFileUploader.loading", "Loading…")
                    : t("experiments.audioAnalysis.components.audioFileUploader.button", "Upload WAV")}
            </Button>
            {error && <Typography variant="body2" color="error">{error}</Typography>}
        </Stack>
    );
};

export default AudioFileUploader;

