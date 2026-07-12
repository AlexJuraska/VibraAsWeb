import React from "react";
import { LayoutRenderer } from "../../layout-system/LayoutRenderer";
import layoutConfig from "../../configs/audioAnalysisLayout.json";
import dualLayoutConfig from "../../configs/audioAnalysisLayoutDual.json";
import { componentMap } from "../../layout-system/types/ComponentMap";
import { usePageTitle } from "../../hooks/usePageTitle";
import { LayoutModeProvider } from "./layoutModeContext";
import { Box } from "@mui/material";

export function AudioAnalysisPage() {
    usePageTitle(
        "home.experiment_audio_analysis",
        "Audio Analysis"
    );

    const [useDualLayout, setUseDualLayout] = React.useState(false);
    const activeConfig = useDualLayout ? dualLayoutConfig : layoutConfig;
    const layoutKey = useDualLayout ? "dual" : "single";

    const toggleLayout = React.useCallback(() => setUseDualLayout((v) => !v), []);

    return (
        <LayoutModeProvider value={{ useDualLayout, toggleLayout }}>
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                    <LayoutRenderer key={layoutKey} config={activeConfig} components={componentMap} />
                </Box>
            </Box>
        </LayoutModeProvider>
    );
}
