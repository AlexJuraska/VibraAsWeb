import React from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useAudioStft } from "../state/audioStftBus";
import type { ResonanceEntry } from "../state/audioStftBus";
import { audioPlaybackBus } from "../state/audioPlaybackBus";
import { audioFrequencyCommandBus } from "../state/audioFrequencyCommandBus";
import { useTranslation } from "../../../i18n/i18n";

const formatFreq = (hz: number): string =>
    hz >= 1000 ? `${(hz / 1000).toFixed(3)} kHz` : `${hz.toFixed(1)} Hz`;

interface Props {
    busId?: string;
}

const ResonantFrequencyList: React.FC<Props> = ({ busId = "main" }) => {
    const { t } = useTranslation();
    const stftFrame = useAudioStft(busId);
    const resonances = stftFrame?.resonances;

    if (!resonances || resonances.length === 0) return null;

    const sorted = [...resonances].sort((a, b) => a.frequency - b.frequency);
    const maxProm = Math.max(...resonances.map((r) => r.prominence));

    const handleSeek = (r: ResonanceEntry) => {
        const duration = audioPlaybackBus.get(busId)?.duration ?? 0;
        audioPlaybackBus.publish({ currentTime: r.timeSec, duration, playing: false }, busId);
    };

    const handlePlay = (e: React.MouseEvent, r: ResonanceEntry) => {
        e.stopPropagation();
        audioFrequencyCommandBus.send({ frequency: r.frequency });
    };

    return (
        <Box sx={{ px: 1.5, py: 1 }}>
            <Typography
                variant="overline"
                sx={{ color: "text.secondary", display: "block", mb: 0.75, lineHeight: 1 }}
            >
                {t("experiments.audioAnalysis.components.resonantFrequencyList.title", "Resonant Frequencies")}
            </Typography>

            <Stack spacing={0.4}>
                {sorted.map((r: ResonanceEntry, i: number) => (
                    <Stack
                        key={i}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        onClick={() => handleSeek(r)}
                        sx={{
                            cursor: "pointer",
                            borderRadius: 1,
                            px: 0.5,
                            py: 0.25,
                            "&:hover": { bgcolor: "action.hover" },
                            "&:hover .play-btn": { opacity: 1 },
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                fontFamily: "monospace",
                                minWidth: 82,
                                fontSize: "0.78rem",
                                color: "text.primary",
                                userSelect: "none",
                                flexShrink: 0,
                            }}
                        >
                            {formatFreq(r.frequency)}
                        </Typography>

                        <Box
                            sx={{
                                flex: 1,
                                height: 5,
                                bgcolor: "divider",
                                borderRadius: 3,
                                overflow: "hidden",
                            }}
                        >
                            <Box
                                sx={{
                                    height: "100%",
                                    width: `${(r.prominence / maxProm) * 100}%`,
                                    bgcolor: "primary.main",
                                    borderRadius: 3,
                                }}
                            />
                        </Box>

                        <Tooltip title={`${t("experiments.audioAnalysis.components.resonantFrequencyList.play", "Play")} ${formatFreq(r.frequency)}`}>
                            <IconButton
                                className="play-btn"
                                size="small"
                                onClick={(e) => handlePlay(e, r)}
                                aria-label={`${t("experiments.audioAnalysis.components.resonantFrequencyList.play", "Play")} ${formatFreq(r.frequency)}`}
                                sx={{
                                    opacity: 0,
                                    transition: "opacity 0.15s",
                                    flexShrink: 0,
                                    p: 0.25,
                                    color: "primary.main",
                                }}
                            >
                                <PlayArrowIcon sx={{ fontSize: "1rem" }} />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
};

export default ResonantFrequencyList;
