import React from "react";
import { Box, Stack, Button } from "@mui/material";
import { ComponentMap } from "../../../layout-system/types/ComponentMap";
import { useLayoutMode } from "../layoutModeContext";

// Single control column by default; optional second set when enabled.
const AudioControlsPanel: React.FC<{ components: ComponentMap; showSecondControls?: boolean }> = ({ components, showSecondControls = false }) => {
    const InputSelector = components.AudioInputDeviceSelector;
    const RecordBtn = components.AudioRecordButton;
    const Upload = components.AudioFileUploader;
    const Debug = components.AudioRecordingDebug;
    const { useDualLayout, toggleLayout } = useLayoutMode();

    return (
        <Box sx={{ height: "100%", display: "grid", gridTemplateRows: showSecondControls ? "auto 1fr 1fr" : "auto 1fr", gap: 2, p: 2, boxSizing: "border-box" }}>
            <Stack direction="row" spacing={1} justifyContent="flex-start">
                <Button size="small" variant="outlined" onClick={toggleLayout}>
                    {useDualLayout ? "Single dataset layout" : "Two-graph layout (two recordings)"}
                </Button>
            </Stack>
            <Stack spacing={2} justifyContent="flex-start">
                <InputSelector />
                <RecordBtn busId="main" />
                <Upload busId="main" />
                <Debug busId="main" />
            </Stack>
            {showSecondControls && (
                <Stack spacing={2} justifyContent="flex-start">
                    <RecordBtn busId="second" />
                    <Upload busId="second" />
                    <Debug busId="second" />
                </Stack>
            )}
        </Box>
    );
};

export default AudioControlsPanel;
