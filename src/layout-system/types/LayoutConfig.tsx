export interface GridVariant {
    areas: string[][];
    columns: string[];
    rows: string[];
}

export interface GridConfig {
    xs?: GridVariant;
    sm?: GridVariant;
    md?: GridVariant;
    lg?: GridVariant;
    xl?: GridVariant;
}

export interface ZoneAnimationConfig {
    exitDirection?: "left" | "right" | "up" | "down";
    collapse?: {
        axis: "column" | "row";
        trackIndex: number;
    };
}

export interface ZoneConfig {
    component: string;
    props?: Record<string, any>;
    animation?: ZoneAnimationConfig;
}

export interface LayoutConfig {
    layout: string;
    zones: Record<string, ZoneConfig>;
    grid: GridConfig;
}
