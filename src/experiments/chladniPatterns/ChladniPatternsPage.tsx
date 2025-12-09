import React from "react";
import { LayoutRenderer } from "../../layout-system/LayoutRenderer";
import layoutConfig from "../../configs/chladniPatternsLayout.json";
import {componentMap} from "../../layout-system/types/ComponentMap";

export function ChladniPatternsPage() {
    return (
        <LayoutRenderer
            config={layoutConfig}
            components={componentMap}
        />
    );
}