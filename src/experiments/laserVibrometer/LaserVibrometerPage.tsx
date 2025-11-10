import React from "react";
import {LayoutRenderer} from "../../layout-system/LayoutRenderer";
import type { LayoutConfig } from "../../layout-system/types/LayoutConfig";
import layout from "../../configs/laserVibrometerLayout.json";

export function LaserVibrometerPage() {
    return (
        <LayoutRenderer
            config={layout as LayoutConfig}
        />
    );
}