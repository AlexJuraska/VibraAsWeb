import React, { useState, useMemo, useEffect, useRef } from "react";
import { Box, IconButton, useMediaQuery, useTheme } from "@mui/material";
import { LayoutConfig, ZoneConfig, GridVariant } from "../types/LayoutConfig";
import { ComponentMap } from "../types/ComponentMap";
import {useTranslation} from "../../i18n/i18n";

export type SlideDirection = "left" | "right" | "top" | "bottom";

export interface SlideZoneConfig extends ZoneConfig {
    slideable?: boolean;
    slideDirection?: SlideDirection;
    slideLabel?: string;
    defaultOpen?: boolean;
    slideGroup?: string;
}

export interface SlideLayoutConfig extends Omit<LayoutConfig, "zones"> {
    zones: Record<string, SlideZoneConfig>;
}

interface SlideLayoutProps {
    config: SlideLayoutConfig;
    components: ComponentMap;
}

const TRANSITION_MS = 500;

const SLIDE_OUT: Record<SlideDirection, string> = {
    left:   "translateX(-105%)",
    right:  "translateX(105%)",
    top:    "translateY(-105%)",
    bottom: "translateY(105%)",
};

function computeTracks(
    variant: GridVariant,
    zones: Record<string, SlideZoneConfig>,
    openState: Record<string, boolean>,
    closingZones: Set<string>
): { columns: string; rows: string } {
    const colTracks = [...variant.columns];
    const rowTracks = [...variant.rows];

    Object.entries(zones).forEach(([name, zone]) => {
        if (!zone.slideable || (openState[name] && !closingZones.has(name))) return;

        const horizontal = zone.slideDirection === "left" || zone.slideDirection === "right";

        if (horizontal) {
            const colIndices = new Set<number>();
            variant.areas.forEach(row => row.forEach((cell, ci) => {
                if (cell === name) colIndices.add(ci);
            }));
            colIndices.forEach(ci => {
                const safe = variant.areas.every(row => {
                    const cell = row[ci];
                    return !cell || cell === name || row.some((c, i) => i !== ci && c === cell);
                });
                if (safe) colTracks[ci] = "0px";
            });
        } else {
            const rowIndices = new Set<number>();
            variant.areas.forEach((row, ri) => { if (row.includes(name)) rowIndices.add(ri); });
            rowIndices.forEach(ri => {
                const safe = variant.areas[ri].every(cell =>
                    cell === name || variant.areas.some((row, i) => i !== ri && row.includes(cell))
                );
                if (safe) rowTracks[ri] = "0px";
            });
        }
    });

    return { columns: colTracks.join(" "), rows: rowTracks.join(" ") };
}

function computeLockedZones(
    zones: Record<string, SlideZoneConfig>,
    activeAreas: Set<string>,
    openState: Record<string, boolean>,
    closingZones: Set<string>
): Set<string> {
    const groups: Record<string, string[]> = {};
    Object.entries(zones).forEach(([name, zone]) => {
        if (zone.slideGroup && activeAreas.has(name)) {
            (groups[zone.slideGroup] ??= []).push(name);
        }
    });

    const locked = new Set<string>();
    Object.values(groups).forEach(members => {
        if (members.some(m => openState[m] === false || closingZones.has(m))) {
            members.forEach(m => {
                if (openState[m] !== false && !closingZones.has(m)) locked.add(m);
            });
        }
    });
    return locked;
}

const ArrowIcon: React.FC<{ direction: SlideDirection; open: boolean }> = ({ direction, open }) => {
    const deg = { left: [180, 0], right: [0, 180], top: [270, 90], bottom: [90, 270] }[direction][open ? 0 : 1];
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
             style={{ transform: `rotate(${deg}deg)`, transition: "transform 0.3s ease" }}>
            <polyline points="6,3 11,8 6,13" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

const GhostStrip: React.FC<{ direction: SlideDirection; label?: string; onOpen: () => void }> =
    ({ direction, label, onOpen }) => {
        const isHorizontal = direction === "left" || direction === "right";
        const { t } = useTranslation();
        const resolvedLabel = label ? t(label, label) : undefined;
        return (
            <Box
                onClick={onOpen}
                sx={{
                    position: "absolute", zIndex: 40, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    ...(direction === "left"   && { top: 0, left: 0,    width: "20px", height: "100%" }),
                    ...(direction === "right"  && { top: 0, right: 0,   width: "20px", height: "100%" }),
                    ...(direction === "top"    && { top: 0, left: 0,    height: "20px", width: "100%" }),
                    ...(direction === "bottom" && { bottom: 0, left: 0, height: "20px", width: "100%" }),
                    "& .pill": {
                        opacity: 0,
                        transition: "opacity 0.2s ease, transform 0.2s ease",
                        transform: direction === "left"   ? "translateX(-6px)"
                            : direction === "right"  ? "translateX(6px)"
                                : direction === "top"    ? "translateY(-6px)"
                                    : "translateY(6px)",
                    },
                    "&:hover .pill": { opacity: 1, transform: "translate(0,0)" },
                }}
            >
                <Box className="pill" sx={{
                    display: "flex", flexDirection: isHorizontal ? "column" : "row",
                    alignItems: "center", gap: "4px",
                    bgcolor: "rgba(20,20,30,0.8)", backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "20px",
                    px: isHorizontal ? 0.75 : 1.5, py: isHorizontal ? 1.5 : 0.75,
                    color: "rgba(255,255,255,0.9)", fontSize: "11px", fontWeight: 600,
                    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.4)", pointerEvents: "none",
                }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ArrowIcon direction={direction} open={false} />
                    </Box>
                    {label && (
                        <span style={isHorizontal ? { writingMode: "vertical-rl", textOrientation: "mixed" } : undefined}>
                            {resolvedLabel}
                        </span>
                    )}
                </Box>
            </Box>
        );
    };

const CloseButton: React.FC<{ direction: SlideDirection; onClose: () => void }> =
    ({ direction, onClose }) => (
        <Box sx={{
            position: "absolute", zIndex: 20,
            ...(direction === "left"   && { top: "50%", right: "-14px", transform: "translateY(-50%)" }),
            ...(direction === "right"  && { top: "50%", left: "-14px",  transform: "translateY(-50%)" }),
            ...(direction === "top"    && { bottom: "-14px", left: "50%", transform: "translateX(-50%)" }),
            ...(direction === "bottom" && { top: "-14px",    left: "50%", transform: "translateX(-50%)" }),
        }}>
            <IconButton size="small" onClick={onClose} sx={{
                bgcolor: "rgba(20,20,30,0.8)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)",
                width: 28, height: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                "&:hover": { bgcolor: "rgba(50,50,70,0.9)" },
            }}>
                <ArrowIcon direction={direction} open={true} />
            </IconButton>
        </Box>
    );

export const SlideLayout: React.FC<SlideLayoutProps> = ({ config, components }) => {
    const { zones, grid } = config;
    const theme = useTheme();

    const isXlUp = useMediaQuery(theme.breakpoints.up("xl"));
    const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
    const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));

    const gridVariant =
        (isXlUp && grid.xl) ||
        (isLgUp && grid.lg) ||
        (isMdUp && grid.md) ||
        (isSmUp && grid.sm) ||
        grid.xs;

    if (!gridVariant) {
        console.warn("No valid grid variant found in config.");
        return null;
    }

    const initialOpenState = useMemo<Record<string, boolean>>(() => {
        const state: Record<string, boolean> = {};
        Object.entries(zones).forEach(([name, zone]) => {
            if (zone.slideable) state[name] = zone.defaultOpen !== false;
        });
        return state;
    }, [zones]);

    const [openState, setOpenState]     = useState(initialOpenState);
    const [closingZones, setClosingZones] = useState<Set<string>>(new Set());
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    useEffect(() => {
        Object.values(timers.current).forEach(clearTimeout);
        timers.current = {};
        setClosingZones(new Set());
        setOpenState(initialOpenState);
    }, [gridVariant]);

    const closeZone = (name: string) => {
        setClosingZones(prev => new Set(prev).add(name));
        timers.current[name] = setTimeout(() => {
            setClosingZones(prev => { const s = new Set(prev); s.delete(name); return s; });
            setOpenState(prev => ({ ...prev, [name]: false }));
            delete timers.current[name];
        }, TRANSITION_MS);
    };

    const openZone = (name: string) => {
        if (timers.current[name]) {
            clearTimeout(timers.current[name]);
            delete timers.current[name];
            setClosingZones(prev => { const s = new Set(prev); s.delete(name); return s; });
        }
        setOpenState(prev => ({ ...prev, [name]: true }));
    };

    const activeAreas = new Set(gridVariant.areas.flat());
    const { columns, rows } = computeTracks(gridVariant, zones, openState, closingZones);
    const lockedZones = computeLockedZones(zones, activeAreas, openState, closingZones);

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateAreas: gridVariant.areas.map(r => `"${r.join(" ")}"`).join(" "),
                transition:
                    `grid-template-columns ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1), ` +
                    `grid-template-rows ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
                height: "100vh",
                width: "100vw",
                overflow: "hidden",
            }}
            style={{ gridTemplateColumns: columns, gridTemplateRows: rows }}
        >
            {Object.entries(zones).map(([name, zone]) => {
                if (!activeAreas.has(name)) return null;

                const Component = components[zone.component];
                if (!Component) {
                    console.warn(`Component '${zone.component}' not found`);
                    return null;
                }

                if (!zone.slideable) {
                    return (
                        <Box key={name} gridArea={name} sx={{ overflow: "hidden", position: "relative" }}>
                            <Component {...(zone.props || {})} components={components} />
                        </Box>
                    );
                }

                const direction  = zone.slideDirection ?? "left";
                const open       = openState[name] !== false;
                const closing    = closingZones.has(name);
                const locked     = lockedZones.has(name);
                const visible    = open && !closing;

                return (
                    <Box key={name} gridArea={name} sx={{ position: "relative", overflow: "visible", zIndex: visible ? 10 : 30 }}>
                        <Box sx={{
                            position: "absolute", inset: 0, overflow: "hidden",
                            transform: visible ? "translate(0,0)" : SLIDE_OUT[direction],
                            opacity: visible ? 1 : 0,
                            transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1), opacity ${TRANSITION_MS}ms ease`,
                            pointerEvents: visible ? "auto" : "none",
                            willChange: "transform, opacity",
                        }}>
                            <Component {...(zone.props || {})} components={components} />
                            {!locked && <CloseButton direction={direction} onClose={() => closeZone(name)} />}
                        </Box>

                        {!open && !closing && (
                            <GhostStrip direction={direction} label={zone.slideLabel} onOpen={() => openZone(name)} />
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};