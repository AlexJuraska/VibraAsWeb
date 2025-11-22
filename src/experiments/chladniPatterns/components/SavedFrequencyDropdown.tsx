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
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {getBreakpoint, subscribeBreakpoint} from "../../../state/breakpointBus";

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

    const [bp, setBp] = React.useState(getBreakpoint());

    React.useEffect(() => {
        return subscribeBreakpoint(setBp);
    }, []);

    if (savedFrequencies.length === 0) {
        return (
            <Box display="flex" flexDirection="column" gap={1}>
                <Typography variant="body2">
                    You do not have any saved frequencies. You can add more with the button below or import a file
                    with saved frequencies.
                </Typography>

                <Button variant="contained"
                        color="primary"
                        onClick={addCurrentFrequency}
                        sx={{ flex: 1, whiteSpace: "nowrap" }}>
                    Save Current Frequency
                </Button>

                <SavedFreqFileImporter
                    label={"Import saved frequencies"}
                    buttonProps={{
                        sx: { flex: 1, whiteSpace: "nowrap" }
                    }}
                />
            </Box>
        );
    }

    return (
        <Box ref={containerRef} display="flex" flexDirection="column" gap={1} width="100%">

            <FormControl fullWidth>
                <InputLabel id="saved-freqs-label">
                    Saved Frequencies ({savedFrequencies.length})
                </InputLabel>

                <Select
                    labelId="saved-freqs-label"
                    value={currentFreq}
                    label={`Saved Frequencies (${savedFrequencies.length})`}
                    onChange={(e) => onSelectFrequency(Number(e.target.value))}
                    variant={"outlined"}>
                    {savedFrequencies.map((freq) => (
                        <MenuItem key={freq} value={freq}>
                            {freq} Hz {freq === currentFreq ? "(current)" : ""}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {open && (
                <Paper
                    elevation={4}
                    sx={{
                        position: "absolute",
                        top: 60,
                        left: 0,
                        right: 0,
                        maxHeight: 220,
                        overflowY: "auto",
                        zIndex: 20,
                    }}
                >
                    <List dense disablePadding>
                        {savedFrequencies.map((freq) => {
                            const isCurrent = freq === currentFreq;
                            return (
                                <ListItemButton
                                    key={freq}
                                    onClick={() => onSelectFrequency(freq)}
                                    selected={isCurrent}
                                >
                                    <Typography>
                                        {freq} Hz{isCurrent ? " (current)" : ""}
                                    </Typography>
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Paper>
            )}

            <Button
                variant="contained"
                color="primary"
                onClick={addCurrentFrequency}
                fullWidth
                size={bp}
                sx={{ flex: 1, textTransform: "none", whiteSpace: "nowrap" }}
            >
                Save current frequency
            </Button>

            <Box display="flex" gap={1}>
                <SavedFreqFileImporter
                    buttonProps={{
                        sx: { flex: 1, textTransform: "none", whiteSpace: "nowrap" }
                    }}
                />

                <FileExporter
                    fileName="frequencies.txt"
                    getContent={() =>
                        getSavedFrequencies()
                            .sort((a, b) => a - b)
                            .map((f) => `${f}`)
                            .join("\n")
                    }
                    buttonProps={{
                        variant: "outlined",
                        color: "primary",
                        sx: { flex: 1, textTransform: "none", whiteSpace: "nowrap" }
                    }}
                />
            </Box>
        </Box>

    );
}