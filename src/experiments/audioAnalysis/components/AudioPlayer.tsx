import React from "react";
import { IconButton, Stack, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { styled } from "@mui/material/styles";
import { audioPlaybackBus } from "../state/audioPlaybackBus";
import type { AudioPlayback } from "../state/audioPlaybackBus";
import { useAudioRecording } from "../state/audioRecordingBus";
import { useTranslation } from "../../../i18n/i18n";

// Styled to match the MUI Slider theme overrides (height, thumb size, primary colour).
// --pct is kept up-to-date via direct DOM writes so the filled track portion stays
// in sync without going through React state.
const RangeInput = styled("input")(({ theme }) => ({
    WebkitAppearance: "none",
    MozAppearance: "none",
    appearance: "none",
    width: "100%",
    background: "transparent",
    cursor: "pointer",
    margin: 0,
    outline: "none",

    // ── WebKit track ──────────────────────────────────────────────────────────
    "&::-webkit-slider-runnable-track": {
        height: "clamp(6px, 2vw, 8px)",
        borderRadius: 4,
        // Filled portion driven by --pct (0-100), updated imperatively in setDisplay.
        background: `linear-gradient(
            to right,
            ${theme.palette.primary.main} calc(var(--pct,0) * 1%),
            ${theme.palette.divider}     calc(var(--pct,0) * 1%)
        )`,
        [theme.breakpoints.up("lg")]: {
            height: "clamp(4px, 0.8vw, 6px)",
        },
    },

    // ── WebKit thumb ──────────────────────────────────────────────────────────
    "&::-webkit-slider-thumb": {
        WebkitAppearance: "none",
        appearance: "none",
        width: "clamp(24px, 6vw, 32px)",
        height: "clamp(24px, 6vw, 32px)",
        borderRadius: "50%",
        background: theme.palette.primary.main,
        // Centre the thumb on the (thinner) track.
        marginTop: "calc((clamp(6px, 2vw, 8px) - clamp(24px, 6vw, 32px)) / 2)",
        boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
        transition: "box-shadow 0.15s",
        [theme.breakpoints.up("lg")]: {
            width: "clamp(18px, 1.8vw, 22px)",
            height: "clamp(18px, 1.8vw, 22px)",
            marginTop: "calc((clamp(4px, 0.8vw, 6px) - clamp(18px, 1.8vw, 22px)) / 2)",
        },
    },
    "&:hover::-webkit-slider-thumb": {
        boxShadow: `0 0 0 8px ${theme.palette.primary.main}28`,
    },
    "&:focus-visible::-webkit-slider-thumb": {
        boxShadow: `0 0 0 4px ${theme.palette.primary.main}55`,
    },

    // ── Firefox track ─────────────────────────────────────────────────────────
    "&::-moz-range-track": {
        height: "clamp(6px, 2vw, 8px)",
        borderRadius: 4,
        background: theme.palette.divider,
        [theme.breakpoints.up("lg")]: {
            height: "clamp(4px, 0.8vw, 6px)",
        },
    },
    "&::-moz-range-progress": {
        height: "clamp(6px, 2vw, 8px)",
        borderRadius: "4px 0 0 4px",
        background: theme.palette.primary.main,
        [theme.breakpoints.up("lg")]: {
            height: "clamp(4px, 0.8vw, 6px)",
        },
    },

    // ── Firefox thumb ─────────────────────────────────────────────────────────
    "&::-moz-range-thumb": {
        width: "clamp(24px, 6vw, 32px)",
        height: "clamp(24px, 6vw, 32px)",
        borderRadius: "50%",
        background: theme.palette.primary.main,
        border: "none",
        boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
        [theme.breakpoints.up("lg")]: {
            width: "clamp(18px, 1.8vw, 22px)",
            height: "clamp(18px, 1.8vw, 22px)",
        },
    },

    "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
}));

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
    const { t } = useTranslation();
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    // Uncontrolled slider and time label — updated via direct DOM writes so the
    // RAF loop never races with pointer events in React 18 concurrent mode.
    const sliderRef = React.useRef<HTMLInputElement | null>(null);
    const timeDisplayRef = React.useRef<HTMLSpanElement | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const isOurPublishRef = React.useRef(false);
    const isDraggingRef = React.useRef(false);
    const wasPlayingRef = React.useRef(false);
    const durationRef = React.useRef(0);

    // React state only for the play/pause icon and the duration label.
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [elDuration, setElDuration] = React.useState(0);

    const recording = useAudioRecording(busId);

    const effectiveDuration = React.useMemo(() => {
        if (elDuration > 0) return elDuration;
        if (recording && recording.sampleRate > 0 && recording.samples.length > 0)
            return recording.samples.length / recording.sampleRate;
        return 0;
    }, [elDuration, recording]);

    React.useEffect(() => {
        durationRef.current = effectiveDuration;
        if (sliderRef.current) {
            sliderRef.current.max = String(effectiveDuration || 1);
            // Recompute fill percentage for the new duration.
            const t = parseFloat(sliderRef.current.value) || 0;
            const pct = effectiveDuration > 0 ? (t / effectiveDuration) * 100 : 0;
            sliderRef.current.style.setProperty("--pct", String(pct));
        }
    }, [effectiveDuration]);

    const publish = React.useCallback((state: AudioPlayback) => {
        isOurPublishRef.current = true;
        audioPlaybackBus.publish(state, busId);
        isOurPublishRef.current = false;
    }, [busId]);

    const stopRaf = React.useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    // Single function for all real-time display updates — no React renders.
    const setDisplay = React.useCallback((t: number) => {
        if (sliderRef.current) {
            sliderRef.current.value = String(t);
            const pct = durationRef.current > 0 ? (t / durationRef.current) * 100 : 0;
            sliderRef.current.style.setProperty("--pct", String(pct));
        }
        if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(t);
    }, []);

    // External seeks from graph or heatmap clicks.
    React.useEffect(() => {
        return audioPlaybackBus.subscribe((state) => {
            if (isOurPublishRef.current || state?.currentTime == null) return;
            const el = audioRef.current;
            if (el) el.currentTime = state.currentTime;
            setDisplay(state.currentTime);
        }, busId);
    }, [busId, setDisplay]);

    // Reset on url/busId change.
    React.useEffect(() => {
        stopRaf();
        setIsPlaying(false);
        setElDuration(0);
        isDraggingRef.current = false;
        wasPlayingRef.current = false;
        setDisplay(0);
        publish({ currentTime: 0, duration: 0, playing: false });
        audioRef.current?.pause();
    }, [busId, url, stopRaf, publish, setDisplay]);

    // Cancel RAF on unmount.
    React.useEffect(() => () => stopRaf(), [stopRaf]);

    const handlePlayPause = () => {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) el.play().catch(() => {});
        else el.pause();
    };

    const handleSliderPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
        const el = audioRef.current;
        isDraggingRef.current = true;
        wasPlayingRef.current = !!el && !el.paused;
        if (wasPlayingRef.current) el!.pause();
        stopRaf();

        // Document-level handler catches release even when pointer leaves the window.
        const onPointerUp = () => {
            if (!isDraggingRef.current) return;
            const t = sliderRef.current ? parseFloat(sliderRef.current.value) : 0;
            isDraggingRef.current = false;
            const audio = audioRef.current;
            if (audio) audio.currentTime = t;
            publish({ currentTime: t, duration: durationRef.current, playing: false });
            if (wasPlayingRef.current) {
                wasPlayingRef.current = false;
                audio?.play().catch(() => {});
            }
        };
        document.addEventListener("pointerup", onPointerUp, { once: true });
    };

    // Fires on every thumb movement — update fill and time label, notify bus.
    const handleSliderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const t = parseFloat(e.target.value);
        const pct = durationRef.current > 0 ? (t / durationRef.current) * 100 : 0;
        e.target.style.setProperty("--pct", String(pct));
        if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(t);
        publish({ currentTime: t, duration: durationRef.current, playing: false });
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
                    stopRaf();
                    const loop = () => {
                        const el = audioRef.current;
                        if (!el || el.paused) { rafRef.current = null; return; }
                        const ct = el.currentTime;
                        setDisplay(ct);
                        publish({ currentTime: ct, duration: el.duration, playing: true });
                        rafRef.current = requestAnimationFrame(loop);
                    };
                    rafRef.current = requestAnimationFrame(loop);
                    publish({
                        currentTime: audioRef.current?.currentTime ?? 0,
                        duration: audioRef.current?.duration ?? 0,
                        playing: true,
                    });
                }}
                onPause={() => {
                    setIsPlaying(false);
                    stopRaf();
                    const ct = audioRef.current?.currentTime ?? 0;
                    setDisplay(ct);
                    publish({
                        currentTime: ct,
                        duration: audioRef.current?.duration ?? 0,
                        playing: false,
                    });
                }}
                onEnded={() => {
                    const el = audioRef.current;
                    const endTime = el?.duration ?? durationRef.current;
                    setIsPlaying(false);
                    stopRaf();
                    setDisplay(endTime);
                    publish({ currentTime: endTime, duration: endTime, playing: false });
                }}
            />

            <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                    size="small"
                    onClick={handlePlayPause}
                    aria-label={isPlaying
                        ? t("experiments.audioAnalysis.components.audioPlayer.pause", "Pause")
                        : t("experiments.audioAnalysis.components.audioPlayer.play", "Play")}
                    disabled={disabled}
                >
                    {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>

                <Typography
                    component="span"
                    variant="body2"
                    sx={{ fontFamily: "monospace", minWidth: 74, userSelect: "none" }}
                >
                    <span ref={timeDisplayRef}>{formatTime(0)}</span>
                </Typography>

                <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
                    <RangeInput
                        ref={sliderRef}
                        type="range"
                        min={0}
                        max={effectiveDuration || 1}
                        step={0.001}
                        defaultValue={0}
                        onPointerDown={handleSliderPointerDown}
                        onChange={handleSliderInput}
                        disabled={disabled}
                    />
                </Box>

                <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", minWidth: 74, textAlign: "right", userSelect: "none" }}
                >
                    {formatTime(effectiveDuration)}
                </Typography>
            </Stack>
        </Stack>
    );
};

export default AudioPlayer;
