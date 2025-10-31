import React from "react";
import {LayoutRenderer} from "../../layout-system/LayoutRenderer";
import type { LayoutConfig } from "../../layout-system/types/LayoutConfig";
import layout from "../../configs/chladniPatternsLayout.json";

export function ChladniPatternsPage() {
    return (
        <LayoutRenderer
            config={layout as LayoutConfig}
        />
    );
}