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

export interface ZoneConfig {
    component: string;
    props?: Record<string, any>;
}

export interface LayoutConfig {
    layout: string;
    zones: Record<string, ZoneConfig>;
    grid: GridConfig;
}
