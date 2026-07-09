import React from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { useAudioRecording } from "../state/audioRecordingBus";
import AudioPlayer from "./AudioPlayer";
import { useTranslation } from "../../../i18n/i18n";

const AudioRecordingDebug: React.FC<{ busId?: string }> = ({ busId = "main" }) => {
    const { t } = useTranslation();
    const recording = useAudioRecording(busId);
    const [url, setUrl] = React.useState<string>("");

    React.useEffect(() => {
        if (url) URL.revokeObjectURL(url);
        if (recording?.blob) {
            setUrl(URL.createObjectURL(recording.blob));
        } else {
            setUrl("");
        }
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [recording?.blob]);


    if (!recording) {
        return <Typography variant="body2">{t("experiments.audioAnalysis.components.audioRecordingDebug.noRecording", "No recording yet.")}</Typography>;
    }

    return (
        <Stack spacing={1}>
            <Typography variant="subtitle1">{t("experiments.audioAnalysis.components.audioRecordingDebug.title", "Recording info")}</Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
                <Typography variant="body2">{t("experiments.audioAnalysis.components.audioRecordingDebug.duration", "Duration")}: {recording.duration.toFixed(2)} s</Typography>
                <Typography variant="body2">{t("experiments.audioAnalysis.components.audioRecordingDebug.sampleRate", "Sample rate")}: {recording.sampleRate} Hz</Typography>
                <Typography variant="body2">{t("experiments.audioAnalysis.components.audioRecordingDebug.samples", "Samples")}: {recording.samples.length}</Typography>
            </Box>
            <Divider />
            {url && <AudioPlayer url={url} busId={busId} />}
        </Stack>
    );
};

export default AudioRecordingDebug;
