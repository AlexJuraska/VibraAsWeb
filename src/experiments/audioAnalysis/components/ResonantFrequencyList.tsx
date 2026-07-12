import React, { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ClearIcon from "@mui/icons-material/Clear";
import { useAudioStft } from "../state/audioStftBus";
import type { ResonanceEntry } from "../state/audioStftBus";
import { audioPlaybackBus } from "../state/audioPlaybackBus";
import { audioFrequencyCommandBus } from "../state/audioFrequencyCommandBus";
import { useTranslation } from "../../../i18n/i18n";

const formatFreq = (hz: number): string =>
    hz >= 1000 ? `${(hz / 1000).toFixed(3)} kHz` : `${hz.toFixed(1)} Hz`;

const T = "experiments.audioAnalysis.components.resonantFrequencyList";

interface Props {
    busId?: string;
}

const ResonantFrequencyList: React.FC<Props> = ({ busId = "main" }) => {
    const { t } = useTranslation();
    const stftFrame = useAudioStft(busId);
    const analysisResonances = stftFrame?.resonances;

    const [uploadedResonances, setUploadedResonances] = useState<ResonanceEntry[] | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [filename, setFilename] = useState("resonant-frequencies");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resonances = uploadedResonances ?? analysisResonances;
    const isFromFile = uploadedResonances !== null;
    const hasResonances = resonances && resonances.length > 0;

    const handleSeek = (r: ResonanceEntry) => {
        if (isFromFile) return;
        const duration = audioPlaybackBus.get(busId)?.duration ?? 0;
        audioPlaybackBus.publish({ currentTime: r.timeSec, duration, playing: false }, busId);
    };

    const handlePlay = (e: React.MouseEvent, r: ResonanceEntry) => {
        e.stopPropagation();
        audioFrequencyCommandBus.send({ frequency: r.frequency });
    };

    const handleDownload = () => {
        if (!resonances || resonances.length === 0) return;
        const sorted = [...resonances].sort((a, b) => a.frequency - b.frequency);
        const lines = [
            "# VibraAS Resonant Frequencies",
            `# Date: ${new Date().toISOString().slice(0, 10)}`,
            ...sorted.map((r) => r.frequency.toFixed(4)),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename.trim() || "resonant-frequencies"}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setDownloadOpen(false);
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const entries: ResonanceEntry[] = [];
            for (const line of text.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) continue;
                const hz = parseFloat(trimmed);
                if (!isFinite(hz) || hz <= 0) {
                    setUploadError(t(`${T}.uploadError`, "Invalid file: expected one frequency in Hz per line."));
                    return;
                }
                entries.push({ frequency: hz, prominence: 1, consistency: 1, magnitude: 1, timeSec: 0 });
            }
            if (entries.length === 0) {
                setUploadError(t(`${T}.uploadError`, "Invalid file: expected one frequency in Hz per line."));
                return;
            }
            setUploadError(null);
            setUploadedResonances(entries);
        };
        reader.readAsText(file);
    };

    const sorted = hasResonances ? [...resonances].sort((a, b) => a.frequency - b.frequency) : [];
    const maxProm = hasResonances ? Math.max(...resonances.map((r) => r.prominence)) : 1;

    return (
        <Box sx={{ px: 1.5, py: 1 }}>
            <Stack direction="row" alignItems="center" mb={0.75}>
                <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1, flex: 1 }}>
                    {t(`${T}.title`, "Resonant Frequencies")}
                    {isFromFile && (
                        <Typography component="span" variant="caption" sx={{ ml: 0.75, color: "text.disabled" }}>
                            ({t(`${T}.fromFile`, "from file")})
                        </Typography>
                    )}
                </Typography>

                {isFromFile && (
                    <Tooltip title={t(`${T}.tooltipClear`, "Clear uploaded data")}>
                        <IconButton
                            size="small"
                            onClick={() => { setUploadedResonances(null); setUploadError(null); }}
                        >
                            <ClearIcon sx={{ fontSize: "0.9rem" }} />
                        </IconButton>
                    </Tooltip>
                )}

                <Tooltip title={t(`${T}.tooltipUpload`, "Load frequencies from text file")}>
                    <IconButton size="small" onClick={() => fileInputRef.current?.click()}>
                        <UploadFileIcon sx={{ fontSize: "0.9rem" }} />
                    </IconButton>
                </Tooltip>

                {hasResonances && (
                    <Tooltip title={t(`${T}.tooltipDownload`, "Save frequencies to text file")}>
                        <IconButton size="small" onClick={() => setDownloadOpen(true)}>
                            <DownloadIcon sx={{ fontSize: "0.9rem" }} />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>

            <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                style={{ display: "none" }}
                onChange={handleUpload}
            />

            {uploadError && (
                <Typography variant="caption" sx={{ color: "error.main", display: "block", mb: 0.5 }}>
                    {uploadError}
                </Typography>
            )}

            {hasResonances && (
                <Stack spacing={0.4}>
                    {sorted.map((r: ResonanceEntry, i: number) => (
                        <Stack
                            key={i}
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            onClick={() => handleSeek(r)}
                            sx={{
                                cursor: isFromFile ? "default" : "pointer",
                                borderRadius: 1,
                                px: 0.5,
                                py: 0.25,
                                ...(!isFromFile && { "&:hover": { bgcolor: "action.hover" } }),
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

                            <Box sx={{ flex: 1, height: 5, bgcolor: "divider", borderRadius: 3, overflow: "hidden" }}>
                                <Box
                                    sx={{
                                        height: "100%",
                                        width: `${(r.prominence / maxProm) * 100}%`,
                                        bgcolor: "primary.main",
                                        borderRadius: 3,
                                    }}
                                />
                            </Box>

                            <Tooltip title={`${t(`${T}.play`, "Play")} ${formatFreq(r.frequency)}`}>
                                <IconButton
                                    className="play-btn"
                                    size="small"
                                    onClick={(e) => handlePlay(e, r)}
                                    aria-label={`${t(`${T}.play`, "Play")} ${formatFreq(r.frequency)}`}
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
            )}

            <Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {t(`${T}.downloadTitle`, "Save Resonant Frequencies")}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label={t(`${T}.filenameLabel`, "Filename")}
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleDownload(); }}
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">.txt</InputAdornment>
                                ),
                            },
                        }}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDownloadOpen(false)}>
                        {t(`${T}.cancel`, "Cancel")}
                    </Button>
                    <Button variant="contained" onClick={handleDownload} disabled={!filename.trim()}>
                        {t(`${T}.download`, "Download")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ResonantFrequencyList;
