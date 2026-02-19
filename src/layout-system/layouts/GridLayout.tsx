import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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

    const [visibleZones, setVisibleZones] = React.useState<Record<string, boolean>>(
        () =>
            Object.fromEntries(
                Object.keys(zones).map(name => [name, true])
            )
    );

    const [collapsedTracks, setCollapsedTracks] = React.useState<{
        columns: Set<number>;
        rows: Set<number>;
    }>({
        columns: new Set(),
        rows: new Set()
    });

    React.useEffect(() => {
        setCollapsedTracks({
            columns: new Set(),
            rows: new Set()
        });
    }, [gridVariant]);

    const computedColumns = gridVariant.columns.map((col, i) =>
        collapsedTracks.columns.has(i) ? "0px" : col
    );

    const computedRows = gridVariant.rows.map((row, i) =>
        collapsedTracks.rows.has(i) ? "0px" : row
    );

    const activeAreas = new Set(gridVariant.areas.flat());

    return (
        <motion.div
            layout
            animate={{
                gridTemplateColumns: computedColumns.join(" "),
                gridTemplateRows: computedRows.join(" ")
            }}
            transition={{duration: 0.4, ease: "easeInOut"}}
            style={{
                display: "grid",
                gridTemplateAreas: gridVariant.areas
                    .map(r => `"${r.join(" ")}"`)
                    .join(" "),
                height: "100vh",
                width: "100vw",
                overflow: "hidden"
            }}
        >
            <AnimatePresence>
                {Object.entries(zones).map(([name, zone]) => {
                    if (!activeAreas.has(name)) return null;
                    if (!visibleZones[name]) return null;

                    const Component = components[zone.component];
                    if (!Component) {
                        console.warn(`Component '${zone.component}' not found`);
                        return null;
                    }

                    return (
                        <motion.div
                            key={name}
                            layout
                            style={{
                                gridArea: name,
                                minWidth: 0,
                                minHeight: 0,
                                overflow: "hidden"
                            }}
                            animate={{
                                x:
                                    zone.animation?.collapse?.axis === "column" &&
                                    collapsedTracks.columns.has(zone.animation.collapse.trackIndex)
                                        ? zone.animation.exitDirection === "left"
                                            ? "-100%"
                                            : zone.animation.exitDirection === "right"
                                                ? "100%"
                                                : 0
                                        : 0,
                                y:
                                    zone.animation?.collapse?.axis === "row" &&
                                    collapsedTracks.rows.has(zone.animation.collapse.trackIndex)
                                        ? zone.animation.exitDirection === "up"
                                            ? "-100%"
                                            : zone.animation.exitDirection === "down"
                                                ? "100%"
                                                : 0
                                        : 0,
                                opacity:
                                    zone.animation?.collapse &&
                                    (
                                        (zone.animation.collapse.axis === "column" &&
                                            collapsedTracks.columns.has(zone.animation.collapse.trackIndex)) ||
                                        (zone.animation.collapse.axis === "row" &&
                                            collapsedTracks.rows.has(zone.animation.collapse.trackIndex))
                                    )
                                        ? 0
                                        : 1
                            }}
                            transition={{duration: 0.4, ease: "easeInOut"}}
                        >
                            <Box sx={{ height: "100%", width: "100%", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
                                <Component
                                    {...(zone.props || {})}
                                    components={components}
                                    closePanel={() => {
                                        const collapse = zone.animation?.collapse;
                                        if (!collapse) return;

                                        setCollapsedTracks(prev => {
                                            const next = {
                                                columns: new Set(prev.columns),
                                                rows: new Set(prev.rows)
                                            };

                                            if (collapse.axis === "column") {
                                                next.columns.add(collapse.trackIndex);
                                            } else {
                                                next.rows.add(collapse.trackIndex);
                                            }

                                            return next;
                                        });
                                    }}
                                />
                            </Box>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </motion.div>
    );
};
