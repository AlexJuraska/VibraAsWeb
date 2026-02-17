import React from "react";
import { LayoutRenderer } from "../../layout-system/LayoutRenderer";
import layoutConfig from "../../configs/audioAnalysisLayout.json";
import {componentMap} from "../../layout-system/types/ComponentMap";
import {usePageTitle} from "../../hooks/usePageTitle";

export function AudioAnalysisPage() {
    usePageTitle(
        "home.experiment_audio_analysis",
        "Audio Analysis"
    );

    return (
        <LayoutRenderer
            config={layoutConfig}
            components={componentMap}
        />
    );
}
