import React from "react";
import {Box, useMediaQuery, useTheme} from "@mui/material";
import { LayoutConfig } from "../types/LayoutConfig";
import * as GenericComponents from "../../components";
import * as ChladniComponents from "../../experiments/chladniPatterns/components";
import ColorBlock from "../../components/ColorBlock";

const AppComponents = { ...GenericComponents, ...ChladniComponents, ColorBlock };

export const GridLayout: React.FC<{ config: LayoutConfig }> = ({ config }) => {
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

    const activeAreas = Array.from(
        new Set(gridVariant.areas.flat())
    );

    const renderZone = (name: string) => {
        const zone = zones[name];
        if (!zone) return null;

        if (!activeAreas.includes(name)) {
            return null;
        }

        const Component = (AppComponents as any)[zone.component];
        if (!Component) {
            console.warn(`Component '${zone.component}' not found.`);
            return null;
        }
        return (
            <Box
                key={name}
                gridArea={name}
                sx={{
                    overflow: "hidden"
                }}
            >
                <Component {...(zone.props || {})} />
            </Box>
        );
    };

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
                boxSizing: "border-box",
            }}
        >
            {Object.keys(zones).map(name => renderZone(name))}
        </Box>
    );
};
