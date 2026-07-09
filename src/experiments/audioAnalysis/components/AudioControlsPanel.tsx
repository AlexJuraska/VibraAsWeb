import React from "react";
import { Box, Stack, Button, Tooltip } from "@mui/material";
import { ComponentMap } from "../../../layout-system/types/ComponentMap";
import { useLayoutMode } from "../layoutModeContext";
import { useAudioRecording } from "../state/audioRecordingBus";
import AudioPlayer from "./AudioPlayer";
import { useTranslation } from "../../../i18n/i18n";

const AudioControlsPanel: React.FC<{ components: ComponentMap; showSecondControls?: boolean }> = ({ components, showSecondControls = false }) => {
    const { t } = useTranslation();
    const InputSelector = components.AudioInputDeviceSelector;
    const FrequencyGenerator = components.AudioFrequencyGenerator;
    const RecordBtn = components.AudioRecordButton;
    const Upload = components.AudioFileUploader;
    const { useDualLayout, toggleLayout } = useLayoutMode();

    const recordingMain = useAudioRecording("main");
    const recordingSecond = useAudioRecording("second");
    const [urlMain, setUrlMain] = React.useState<string>("");
    const [urlSecond, setUrlSecond] = React.useState<string>("");

    React.useEffect(() => {
        if (urlMain) URL.revokeObjectURL(urlMain);
        if (recordingMain?.blob) {
            setUrlMain(URL.createObjectURL(recordingMain.blob));
        } else {
            setUrlMain("");
        }
        return () => {
            if (urlMain) URL.revokeObjectURL(urlMain);
        };
    }, [recordingMain?.blob]);

    React.useEffect(() => {
        if (urlSecond) URL.revokeObjectURL(urlSecond);
        if (recordingSecond?.blob) {
            setUrlSecond(URL.createObjectURL(recordingSecond.blob));
        } else {
            setUrlSecond("");
        }
        return () => {
            if (urlSecond) URL.revokeObjectURL(urlSecond);
        };
    }, [recordingSecond?.blob]);

    return (
        <Box sx={{ height: "100%", display: "grid", gridTemplateRows: showSecondControls ? "auto 1fr 1fr" : "auto 1fr", gap: 2, p: 2, boxSizing: "border-box", minHeight: 0, overflow: "hidden" }}>
            <Stack direction="row" spacing={1} justifyContent="flex-start" sx={{ flexShrink: 0 }}>
                <Tooltip title={useDualLayout
                    ? t("experiments.audioAnalysis.components.audioControlsPanel.tooltip.single", "Switch to single recording view")
                    : t("experiments.audioAnalysis.components.audioControlsPanel.tooltip.dual", "Switch to dual view for side-by-side A/B comparison of two recordings")}>
                    <Button size="small" variant="outlined" onClick={toggleLayout}>
                        {useDualLayout
                            ? t("experiments.audioAnalysis.components.audioControlsPanel.singleLayout", "Single dataset layout")
                            : t("experiments.audioAnalysis.components.audioControlsPanel.dualLayout", "Two-graph layout (two recordings)")}
                    </Button>
                </Tooltip>
            </Stack>
            <Stack spacing={2} justifyContent="flex-start" sx={{ minHeight: 0, overflowY: "auto", pr: 0.5 }}>
                <InputSelector />
                <FrequencyGenerator />
                <RecordBtn busId="main" />
                <Upload busId="main" />
                {urlMain && <AudioPlayer url={urlMain} busId="main" />}
            </Stack>
            {showSecondControls && (
                <Stack spacing={2} justifyContent="flex-start" sx={{ minHeight: 0, overflowY: "auto", pr: 0.5 }}>
                    <RecordBtn busId="second" />
                    <Upload busId="second" />
                    {urlSecond && <AudioPlayer url={urlSecond} busId="second" />}
                </Stack>
            )}
        </Box>
    );
};

export default AudioControlsPanel;
