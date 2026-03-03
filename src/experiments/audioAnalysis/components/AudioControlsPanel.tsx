import React from "react";
import { Box, Stack } from "@mui/material";
import { ComponentMap } from "../../../layout-system/types/ComponentMap";

// Splits controls into two vertical halves to align with top/bottom graphs.
const AudioControlsPanel: React.FC<{ components: ComponentMap }> = ({ components }) => {
    const InputSelector = components.AudioInputDeviceSelector;
    const RecordBtn = components.AudioRecordButton;
    const Upload = components.AudioFileUploader;
    const Debug = components.AudioRecordingDebug;

    return (
        <Box sx={{ height: "100%", display: "grid", gridTemplateRows: "1fr 1fr", gap: 2, p: 2, boxSizing: "border-box" }}>
            <Stack spacing={2} justifyContent="flex-start">
                <InputSelector />
                <RecordBtn busId="main" />
                <Upload busId="main" />
                <Debug busId="main" />
            </Stack>
            <Stack spacing={2} justifyContent="flex-start">
                <RecordBtn busId="second" />
                <Upload busId="second" />
                <Debug busId="second" />
            </Stack>
        </Box>
    );
};

export default AudioControlsPanel;

