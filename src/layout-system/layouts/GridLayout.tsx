import React from "react";
import {Box, useMediaQuery, useTheme} from "@mui/material";
import { LayoutConfig } from "../types/LayoutConfig";
import { ComponentMap } from "../types/ComponentMap";

interface GridLayoutProps {
    config: LayoutConfig;
    components: ComponentMap;
}

export const GridLayout: React.FC<GridLayoutProps> = ({ config, components }) => {
    const { zones, grid } = config;
    const theme = useTheme();

    const isXlUp = useMediaQuery(theme.breakpoints.up("xl"));
    const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
    const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));

    let gridVariant =
        (isXlUp && grid.xl) ||
        (isLgUp && grid.lg) ||
        (isMdUp && grid.md) ||
        (isSmUp && grid.sm) ||
        grid.xs;


    if (!gridVariant) {
        console.warn("No valid grid variant found in config.");
        return null;
    }

    const activeAreas = new Set(gridVariant.areas.flat());

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateAreas: gridVariant.areas.map(r => `"${r.join(" ")}"`).join(" "),
                gridTemplateColumns: gridVariant.columns.join(" "),
                gridTemplateRows: gridVariant.rows.join(" "),
                height: "100vh",
                width: "100vw",
                overflow: "hidden",
            }}
        >
            {Object.entries(zones).map(([name, zone]) => {
                if (!activeAreas.has(name)) return null;

                const Component = components[zone.component];
                if (!Component) {
                    console.warn(`Component '${zone.component}' not found`);
                    return null;
                }

                return (
                    <Box key={name} gridArea={name} sx={{ overflow: "hidden", position: "relative" }}>
                        <Component
                            {...(zone.props || {})}
                            components={components}
                        />
                    </Box>
                );
            })}
        </Box>
    );
};
