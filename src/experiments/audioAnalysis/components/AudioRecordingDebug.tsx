import React from "react";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import { useAudioRecording } from "../state/audioRecordingBus";

const AudioRecordingDebug: React.FC = () => {
    const recording = useAudioRecording();
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
        return <Typography variant="body2">No recording yet.</Typography>;
    }

    return (
        <Stack spacing={1}>
            <Typography variant="subtitle1">Recording info</Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
                <Typography variant="body2">Duration: {recording.duration.toFixed(2)} s</Typography>
                <Typography variant="body2">Sample rate: {recording.sampleRate} Hz</Typography>
                <Typography variant="body2">Samples: {recording.samples.length}</Typography>
            </Box>
            <Divider />
            {url && (
                <Stack direction="row" spacing={1} alignItems="center">
                    <audio controls src={url} />
                    <Button size="small" variant="outlined" href={url} download="recording.wav">
                        Download
                    </Button>
                </Stack>
            )}
        </Stack>
    );
};

export default AudioRecordingDebug;

