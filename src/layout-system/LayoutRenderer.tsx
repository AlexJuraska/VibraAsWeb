import React from "react";
import { LayoutConfig } from "./types/LayoutConfig";
import { GridLayout } from "./layouts/GridLayout";

interface Props {
    config: LayoutConfig;
}

export const LayoutRenderer: React.FC<Props> = ({ config }) => {
    switch (config.layout) {
        case "GridLayout":
            return <GridLayout config={config} />;
        default:
            return <div>Unknown layout type: {config.layout}</div>;
    }
};
