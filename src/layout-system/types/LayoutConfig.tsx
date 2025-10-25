export interface ZoneConfig {
    component: string;
    props?: Record<string, any>;
}

export interface GridConfig {
    areas: string[][];
    columns: string[];
    rows: string[];
}

export interface LayoutConfig {
    layout: string;
    zones: Record<string, ZoneConfig>;
    grid: GridConfig;
}
