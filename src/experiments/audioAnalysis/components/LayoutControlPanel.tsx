import React from "react";
import { Box, Stack, Button, useTheme } from "@mui/material";
import type { ComponentMap } from "../../../layout-system/types/ComponentMap";
import { useLayoutMode } from "../layoutModeContext";
import { useAudioRecording } from "../state/audioRecordingBus";
import AudioPlayer from "./AudioPlayer";

interface PanelChild {
    component: string;
    props?: Record<string, any>;
}

interface LayoutControlPanelProps {
    components: ComponentMap;
    children?: PanelChild[];
    busId?: string;
}

const LayoutControlPanel: React.FC<LayoutControlPanelProps> = ({
    components,
    children = [],
    busId = "main"
}) => {
    const theme = useTheme();
    const { useDualLayout, toggleLayout } = useLayoutMode();
    const recordingMain = useAudioRecording("main");
    const recordingSecond = useAudioRecording("second");
    const [urlMain, setUrlMain] = React.useState<string>("");
    const [urlSecond, setUrlSecond] = React.useState<string>("");

    React.useEffect(() => {
        if (!recordingMain?.blob) {
            setUrlMain("");
            return;
        }
        const url = URL.createObjectURL(recordingMain.blob);
        setUrlMain(url);
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [recordingMain?.blob]);

    React.useEffect(() => {
        if (!recordingSecond?.blob) {
            setUrlSecond("");
            return;
        }
        const url = URL.createObjectURL(recordingSecond.blob);
        setUrlSecond(url);
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [recordingSecond?.blob]);

    const render = (child: PanelChild, i: number) => {
        if (child.component === "AudioPlayer") {
            const playerBusId = child.props?.busId || "main";
            const recording = playerBusId === "main" ? recordingMain : recordingSecond;
            const playerUrl = playerBusId === "main" ? urlMain : urlSecond;

            return <AudioPlayer key={i} url={playerUrl || null} busId={playerBusId} disabled={!recording || !playerUrl} />;
        }

        const Comp = components[child.component];
        if (!Comp) {
            console.warn(`Component '${child.component}' not found`);
            return null;
        }
        return <Comp key={i} {...child.props} components={components} />;
    };

    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    p: theme.spacing(2),
                    display: "flex",
                    flexDirection: "column",
                    gap: theme.spacing(2),
                }}
            >
                <Stack direction="row" spacing={1} justifyContent="flex-start" sx={{ flexShrink: 0 }}>
                    <Button size="small" variant="outlined" onClick={toggleLayout}>
                        {useDualLayout ? "Single dataset layout" : "Two-graph layout (two recordings)"}
                    </Button>
                </Stack>
                {children.map(render)}
            </Box>
        </Box>
    );
};

export default LayoutControlPanel;



