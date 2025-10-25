import React from "react";
import { Box } from "@mui/material";
import { LayoutConfig } from "../types/LayoutConfig";
import * as AppComponents from "../../components";

export const GridLayout: React.FC<{ config: LayoutConfig }> = ({ config }) => {
    const { zones, grid } = config;

    const renderZone = (name: string) => {
        const zone = zones[name];
        if (!zone) return null;
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
                    // boxSizing: "border-box",
                    // border: "1px solid rgba(0,0,0,0.1)",
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
                gridTemplateAreas: grid.areas.map(r => `"${r.join(" ")}"`).join(" "),
                gridTemplateColumns: grid.columns.join(" "),
                gridTemplateRows: grid.rows.join(" "),
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
