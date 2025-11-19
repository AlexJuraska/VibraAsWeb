import React from "react";
import { publishFrequency, subscribeCurrentFrequency } from "../state/currentFrequencyBus";
import {
    addSavedFrequency,
    subscribeSavedFrequencies,
    getSavedFrequencies,
} from "../state/savedFrequencies";
import FileExporter from "../components/SavedFreqFileExporter";
import SavedFreqFileImporter from "../components/SavedFreqFileImporter";
import {Box, Button, List, ListItemButton, Paper, Typography} from "@mui/material";

export default function SavedFrequencyDropdown() {
    const [currentFreq, setCurrentFreq] = React.useState<number>(0);
    const [savedFrequencies, setSavedFrequencies] = React.useState<number[]>([]);
    const [open, setOpen] = React.useState<boolean>(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const unsub = subscribeCurrentFrequency((freq: number) => {
            setCurrentFreq(freq);
        });
        return unsub;
    }, []);

    React.useEffect(() => {
        const unsub = subscribeSavedFrequencies((freqs) => {
            setSavedFrequencies(freqs);
        });
        return unsub;
    }, []);

    React.useEffect(() => {
        function onPointerDown(e: PointerEvent) {
            if (!open) return;
            const el = containerRef.current;
            if (el && !el.contains(e.target as Node)) setOpen(false);
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const addCurrentFrequency = React.useCallback(() => {
        addSavedFrequency(currentFreq);
    }, [currentFreq]);

    const onSelectFrequency = React.useCallback((v: number) => {
        if (!Number.isFinite(v)) return;
        publishFrequency(v);
        setOpen(false);
    }, []);

    const fieldPrimary = React.useMemo(
        () => `Saved Frequencies${savedFrequencies.length > 0 ? ` (${savedFrequencies.length})` : ""}`,
        [savedFrequencies.length]
    );
    const fieldSecondary = React.useMemo(
        () =>
            savedFrequencies.includes(currentFreq)
                ? `${currentFreq} Hz`
                : ``,
        [savedFrequencies, currentFreq]
    );

    if (savedFrequencies.length === 0) {
        return (
            <Box>
                <Typography variant="body2">
                    You do not have any saved frequencies. You can add more with the button below or import a file
                    with saved frequencies.
                </Typography>
                <Box mt={1}>
                    <Button variant="contained" color="primary" onClick={addCurrentFrequency}>
                        Save Current Frequency
                    </Button>
                </Box>
                <Box sx={{ flexBasis: "100%"}}>
                    <SavedFreqFileImporter />
                </Box>
            </Box>
        );
    }

    return (
        <Box ref={containerRef} sx={{ position: "relative", width: "100%" }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <Button
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    onClick={() => setOpen((s) => !s)}
                    variant="outlined"
                    color="primary"
                    fullWidth
                    sx={{
                        justifyContent: "flex-start",
                        textTransform: "none",
                        py: 1,
                        flexDirection: "column",
                        alignItems: "flex-start",
                    }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {fieldPrimary}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        {fieldSecondary}
                    </Typography>
                </Button>
            </Box>

            {open && (
                <Paper
                    elevation={4}
                    sx={{
                        position: "absolute",
                        top: 64,
                        left: 0,
                        right: 0,
                        maxHeight: 200,
                        overflowY: "auto",
                        mt: 1,
                        zIndex: 1000,
                    }}
                >
                    <List dense disablePadding>
                        {savedFrequencies.map((freq, i) => {
                            const isCurrent = freq === currentFreq;
                            return (
                                <ListItemButton
                                    key={i}
                                    onClick={() => onSelectFrequency(freq)}
                                    selected={isCurrent}
                                >
                                    <Typography variant="body2">
                                        {freq} Hz{isCurrent ? " (current)" : ""}
                                    </Typography>
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Paper>
            )}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                    gap: 1,
                    mt: 1,
                }}
            >
                <Button
                    variant="contained"
                    color="primary"
                    onClick={addCurrentFrequency}
                    sx={{ whiteSpace: "nowrap" }}
                >
                    Save current frequency
                </Button>

                <FileExporter
                    fileName="frequencies.txt"
                    label="Export saved frequencies"
                    getContent={() => {
                        const frequencies = getSavedFrequencies();
                        const sorted = [...frequencies].sort((a, b) => a - b);
                        return sorted.map((f) => `${f}`).join("\n");
                    }}
                    buttonProps={{
                        variant: "outlined",
                        color: "primary",
                        sx: { whiteSpace: "nowrap", textTransform: "none" },
                    }}
                />
            </Box>
            <Box sx={{ flexBasis: "100%"}}>
                <SavedFreqFileImporter />
            </Box>
        </Box>

    );
}