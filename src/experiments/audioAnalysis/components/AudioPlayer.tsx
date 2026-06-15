import React from "react";
import { IconButton, Slider, Stack, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { audioPlaybackBus } from "../state/audioPlaybackBus";
import type { AudioPlayback } from "../state/audioPlaybackBus";
import { useAudioRecording } from "../state/audioRecordingBus";

const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return `${m}:${sec.toFixed(3).padStart(6, "0")}`;
};

interface AudioPlayerProps {
    url?: string | null;
    busId?: string;
    disabled?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
    url = null,
    busId = "main",
    disabled = false,
}) => {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [seekTime, setSeekTime] = React.useState<number | null>(null);
    const [elDuration, setElDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);
    const isSeeking = React.useRef(false);
    const rafRef = React.useRef<number | null>(null);
    // Prevents the external-seek subscription from reacting to our own publishes.
    const isOurPublishRef = React.useRef(false);

    const recording = useAudioRecording(busId);

    // Prefer the actual audio file duration once metadata is loaded; fall back to PCM calculation.
    const duration = React.useMemo(() => {
        if (elDuration > 0) return elDuration;
        if (recording && recording.sampleRate > 0 && recording.samples.length > 0) {
            return recording.samples.length / recording.sampleRate;
        }
        return 0;
    }, [recording, elDuration]);

    const displayTime = seekTime ?? currentTime;

    // Wraps every bus publish so the subscription below can tell which updates originated here.
    const publishPlayback = React.useCallback((state: AudioPlayback) => {
        isOurPublishRef.current = true;
        audioPlaybackBus.publish(state, busId);
        isOurPublishRef.current = false;
    }, [busId]);

    // React to external seeks (graph or heatmap clicks) by actually moving the audio element.
    React.useEffect(() => {
        return audioPlaybackBus.subscribe((state) => {
            if (isOurPublishRef.current) return;
            if (state?.currentTime == null) return;
            const el = audioRef.current;
            if (el) el.currentTime = state.currentTime;
            setCurrentTime(state.currentTime);
        }, busId);
    }, [busId]);

    React.useEffect(() => {
        setIsPlaying(false);
        setSeekTime(null);
        setElDuration(0);
        setCurrentTime(0);
        isSeeking.current = false;
        publishPlayback({ currentTime: 0, duration: 0, playing: false });
        audioRef.current?.pause();
    }, [busId, url, publishPlayback]);

    React.useEffect(() => {
        if (!isPlaying) {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }

        const tick = () => {
            const el = audioRef.current;
            if (!el) return;
            if (!isSeeking.current) {
                const ct = el.currentTime;
                setCurrentTime(ct);
                publishPlayback({ currentTime: ct, duration: el.duration, playing: !el.paused });
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [isPlaying, busId, publishPlayback]);

    const handlePlayPause = () => {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) {
            el.play().catch(() => {});
        } else {
            el.pause();
        }
    };

    const handleSliderChange = (_: Event, value: number | number[]) => {
        const t = Array.isArray(value) ? value[0] : value;
        isSeeking.current = true;
        setSeekTime(t);
        publishPlayback({ currentTime: t, duration, playing: isPlaying });
    };

    const handleSliderChangeCommitted = (_: React.SyntheticEvent | Event, value: number | number[]) => {
        const t = Array.isArray(value) ? value[0] : value;
        const el = audioRef.current;
        if (el) el.currentTime = t;
        isSeeking.current = false;
        setCurrentTime(t);
        setSeekTime(null);
        publishPlayback({ currentTime: t, duration: el?.duration ?? duration, playing: !el?.paused });
    };

    return (
        <Stack
            spacing={0.5}
            sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
        >
            <audio
                ref={audioRef}
                src={url || undefined}
                onLoadedMetadata={(e) => setElDuration(e.currentTarget.duration)}
                onPlay={() => {
                    setIsPlaying(true);
                    publishPlayback({
                        currentTime: audioRef.current?.currentTime ?? 0,
                        duration: audioRef.current?.duration ?? 0,
                        playing: true,
                    });
                }}
                onPause={() => {
                    setIsPlaying(false);
                    publishPlayback({
                        currentTime: audioRef.current?.currentTime ?? 0,
                        duration: audioRef.current?.duration ?? 0,
                        playing: false,
                    });
                }}
                onEnded={() => {
                    const el = audioRef.current;
                    const endTime = el?.duration ?? duration;
                    setIsPlaying(false);
                    setCurrentTime(endTime);
                    publishPlayback({ currentTime: endTime, duration: endTime, playing: false });
                }}
            />

            <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                    size="small"
                    onClick={handlePlayPause}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    disabled={disabled}
                >
                    {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>

                <Typography variant="body2" sx={{ fontFamily: "monospace", minWidth: 74, userSelect: "none" }}>
                    {formatTime(displayTime)}
                </Typography>

                <Slider
                    size="small"
                    min={0}
                    max={duration || 1}
                    step={0.001}
                    value={Number.isFinite(displayTime) ? Math.min(displayTime, duration || 1) : 0}
                    onChange={handleSliderChange}
                    onChangeCommitted={handleSliderChangeCommitted}
                    disabled={disabled}
                    sx={{ flex: 1 }}
                />

                <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", minWidth: 74, textAlign: "right", userSelect: "none" }}
                >
                    {formatTime(duration)}
                </Typography>
            </Stack>
        </Stack>
    );
};

export default AudioPlayer;
