import React from "react";
import { LayoutConfig } from "./types/LayoutConfig";
import { ComponentMap } from "./types/ComponentMap"
import { GridLayout } from "./layouts/GridLayout";
import {SlideLayout} from "./layouts/SlideLayout";

interface Props {
    config: LayoutConfig;
    components: ComponentMap;
}

export const LayoutRenderer: React.FC<Props> = ({ config, components }) => {
    switch (config.layout) {
        case "GridLayout":
            return <GridLayout config={config} components={components} />;
        case "SlideLayout":
            return <SlideLayout config={config} components={components} />;
        default:
            return <div>Unknown layout type: {config.layout}</div>;
    }
};
