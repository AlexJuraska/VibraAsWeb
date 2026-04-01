import React from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { useAudioRecording } from "../state/audioRecordingBus";
import { audioPlaybackBus } from "../state/audioPlaybackBus";

const AudioRecordingDebug: React.FC<{ busId?: string }> = ({ busId = "main" }) => {
    const recording = useAudioRecording(busId);
    const [url, setUrl] = React.useState<string>("");const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const rafRef = React.useRef<number | null>(null);

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

    React.useEffect(() => {
        audioPlaybackBus.publish(recording ? { currentTime: 0, duration: recording.duration, playing: false } : undefined, busId);
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, [busId, recording]);

    const onTimeUpdate: React.ReactEventHandler<HTMLAudioElement> = (e) => {
        const el = e.currentTarget;
        audioPlaybackBus.publish({ currentTime: el.currentTime, duration: el.duration, playing: !el.paused }, busId);
    };

    const stopRaf = () => {
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    const tick = () => {
        const el = audioRef.current;
        if (!el) return;
        audioPlaybackBus.publish({ currentTime: el.currentTime, duration: el.duration, playing: !el.paused }, busId);
        if (!el.paused) {
            rafRef.current = requestAnimationFrame(tick);
        } else {
            stopRaf();
        }
    };

    const onPlayPause = (playing: boolean, el?: HTMLAudioElement) => {
        const target = el ?? audioRef.current;
        audioPlaybackBus.publish({ currentTime: target?.currentTime ?? 0, duration: target?.duration, playing }, busId);
        stopRaf();
        if (playing) {
            rafRef.current = requestAnimationFrame(tick);
        }
    };

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
                    <audio
                        ref={audioRef}
                        controls
                        src={url}
                        onTimeUpdate={onTimeUpdate}
                        onPlay={(e) => onPlayPause(true, e.currentTarget)}
                        onPause={(e) => onPlayPause(false, e.currentTarget)}
                        onLoadedMetadata={(e) => onPlayPause(!e.currentTarget.paused, e.currentTarget)}
                        onEnded={(e) => onPlayPause(false, e.currentTarget)}
                    />
                    {/*<Button size="small" variant="outlined" href={url} download="recording.wav">*/}
                    {/*    Download*/}
                    {/*</Button>*/}
                </Stack>
            )}
        </Stack>
    );
};

export default AudioRecordingDebug;

