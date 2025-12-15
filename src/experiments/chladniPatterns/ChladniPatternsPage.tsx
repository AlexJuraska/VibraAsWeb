import React from "react";
import { LayoutRenderer } from "../../layout-system/LayoutRenderer";
import layoutConfig from "../../configs/chladniPatternsLayout.json";
import {componentMap} from "../../layout-system/types/ComponentMap";
import {usePageTitle} from "../../hooks/usePageTitle";

export function ChladniPatternsPage() {
    usePageTitle(
        "home.experiment_chladni",
        "Chladni's Patterns"
    );

    return (
        <LayoutRenderer
            config={layoutConfig}
            components={componentMap}
        />
    );
}