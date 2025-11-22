import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useEffect } from "react";

const BREAKPOINT_MAP: Record<string, "small" | "medium"> = {
    xs: "small",
    sm: "small",
    md: "small",
    lg: "medium",
    xl: "medium",
};

type BPType = "small" | "medium";

let currentBreakpoint: BPType = "small";
const listeners = new Set<(value: BPType) => void>();

export function getBreakpoint(): BPType {
    return currentBreakpoint;
}

export function publishBreakpoint(next: BPType): void {
    currentBreakpoint = next;
    listeners.forEach((fn) => {
        try { fn(next); } catch {}
    });
}

export function subscribeBreakpoint(
    listener: (v: BPType) => void,
    emitCurrent = true
): () => void {
    listeners.add(listener);
    if (emitCurrent) {
        try { listener(currentBreakpoint); } catch {}
    }
    return () => {
        listeners.delete(listener);
    };
}

export function breakpointListener(): void {
    const theme = useTheme();

    const qs = {
        xs: useMediaQuery(theme.breakpoints.only("xs")),
        sm: useMediaQuery(theme.breakpoints.only("sm")),
        md: useMediaQuery(theme.breakpoints.only("md")),
        lg: useMediaQuery(theme.breakpoints.only("lg")),
        xl: useMediaQuery(theme.breakpoints.only("xl")),
    };

    useEffect(() => {
        const active = (Object.keys(qs) as Array<keyof typeof qs>).find((bp) => qs[bp]);
        if (!active) return;

        const mapped = BREAKPOINT_MAP[active];
        publishBreakpoint(mapped);
    }, [qs.xs, qs.sm, qs.md, qs.lg, qs.xl]);
}
