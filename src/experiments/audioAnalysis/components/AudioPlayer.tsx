import React from "react";
import { IconButton, Slider, Stack, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { audioPlaybackBus } from "../state/audioPlaybackBus";

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
                                                     disabled = false
                                                 }) => {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [isPlaying, setIsPlaying] = React.useState(false);

    const isSeeking = React.useRef(false);
    const rafRef = React.useRef<number | null>(null);
    const lastUiUpdateRef = React.useRef(0);

    React.useEffect(() => {
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        lastUiUpdateRef.current = 0;

        audioPlaybackBus.publish(
            { currentTime: 0, duration: 0, playing: false },
            busId
        );

        const el = audioRef.current;
        if (el) {
            el.pause();
        }
    }, [busId, url]);

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
                const t = el.currentTime;

                audioPlaybackBus.publish(
                    {
                        currentTime: t,
                        duration: el.duration,
                        playing: !el.paused
                    },
                    busId
                );

                const now = performance.now();
                if (now - lastUiUpdateRef.current > 16) {
                    lastUiUpdateRef.current = now;
                    setCurrentTime(t);
                }
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
    }, [isPlaying, busId]);

    const handlePlayPause = () => {
        const el = audioRef.current;
        if (!el) return;

        if (el.paused) {
            const playPromise = el.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {});
            }
        } else {
            el.pause();
        }
    };

    const handleSliderChange = (_: Event, value: number | number[]) => {
        const t = Array.isArray(value) ? value[0] : value;

        isSeeking.current = true;
        setCurrentTime(t);

        audioPlaybackBus.publish(
            { currentTime: t, duration, playing: isPlaying },
            busId
        );
    };

    const handleSliderChangeCommitted = (
        _: React.SyntheticEvent | Event,
        value: number | number[]
    ) => {
        const t = Array.isArray(value) ? value[0] : value;
        const el = audioRef.current;

        if (el) {
            el.currentTime = t;
            setCurrentTime(t);
            isSeeking.current = false;

            audioPlaybackBus.publish(
                {
                    currentTime: t,
                    duration: el.duration,
                    playing: !el.paused
                },
                busId
            );
        }
    };

    return (
        <Stack
            spacing={0.5}
            sx={{
                opacity: disabled ? 0.5 : 1,
                pointerEvents: disabled ? "none" : "auto"
            }}
        >
            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                src={url || undefined}
                onLoadedMetadata={(e) =>
                    setDuration(e.currentTarget.duration)
                }
                onPlay={() => {
                    setIsPlaying(true);
                    audioPlaybackBus.publish(
                        {
                            currentTime:
                                audioRef.current?.currentTime || 0,
                            duration:
                                audioRef.current?.duration || 0,
                            playing: true
                        },
                        busId
                    );
                }}
                onPause={() => {
                    setIsPlaying(false);
                    audioPlaybackBus.publish(
                        {
                            currentTime:
                                audioRef.current?.currentTime || 0,
                            duration:
                                audioRef.current?.duration || 0,
                            playing: false
                        },
                        busId
                    );
                }}
                onEnded={() => {
                    setIsPlaying(false);
                    const el = audioRef.current;

                    audioPlaybackBus.publish(
                        {
                            currentTime: el?.duration || currentTime,
                            duration: el?.duration || duration,
                            playing: false
                        },
                        busId
                    );
                }}
            />

            <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                    size="small"
                    onClick={handlePlayPause}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    disabled={disabled}
                >
                    {isPlaying ? (
                        <PauseIcon fontSize="small" />
                    ) : (
                        <PlayArrowIcon fontSize="small" />
                    )}
                </IconButton>

                <Typography
                    variant="body2"
                    sx={{
                        fontFamily: "monospace",
                        minWidth: 74,
                        userSelect: "none"
                    }}
                >
                    {formatTime(currentTime)}
                </Typography>

                <Slider
                    size="small"
                    min={0}
                    max={duration || 1}
                    step={0.001}
                    value={Number.isFinite(currentTime) ? currentTime : 0}
                    onChange={handleSliderChange}
                    onChangeCommitted={handleSliderChangeCommitted}
                    disabled={disabled}
                    sx={{ flex: 1 }}
                />

                <Typography
                    variant="body2"
                    sx={{
                        fontFamily: "monospace",
                        minWidth: 74,
                        textAlign: "right",
                        userSelect: "none"
                    }}
                >
                    {formatTime(duration)}
                </Typography>
            </Stack>
        </Stack>
    );
};

export default AudioPlayer;