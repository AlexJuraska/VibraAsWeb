import React from "react";
import { Line, Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import Box from "@mui/material/Box";
import { useTheme, alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, zoomPlugin);

export type Point = { x: number; y: number };

export type Dataset = {
    label: string;
    data: Point[];
    type?: "line" | "scatter" | "bar";
    stepped?: boolean;
    pointBackgroundColor?: string | string[];
    pointRadius?: number;
    showLine?: boolean;
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
};

export type ChartDataProps = {
    datasets: Dataset[];
};

type Props = {
    data?: ChartDataProps;
    options?: ChartOptions<"line" | "bar">;
    plugins?: any[];
    className?: string;
    style?: React.CSSProperties;
    chartType?: "line" | "bar";
    redrawToken?: number;
    onChartReady?: (chart: any | null) => void;
};

const buildDefaultOptions = (theme: Theme): ChartOptions<"line" | "bar"> => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        x: {
            type: "linear",
            title: { display: true, text: "X", color: theme.palette.text.primary },
            ticks: { color: theme.palette.text.secondary },
            grid: { color: theme.palette.divider }
        },
        y: {
            title: { display: true, text: "Y", color: theme.palette.text.primary },
            ticks: { color: theme.palette.text.secondary },
            grid: { color: theme.palette.divider }
        }
    },
    plugins: {
        legend: {
            position: "top",
            labels: {
                color: theme.palette.text.primary,
                font: { family: theme.typography.fontFamily as string }
            }
        },
        title: {
            display: false,
            color: theme.palette.text.primary,
            font: { family: theme.typography.fontFamily as string }
        },
        tooltip: {
            titleColor: theme.palette.common.white,
            bodyColor: theme.palette.common.white
        }
    }
});

const isValidChartData = (d: any): d is ChartDataProps => {
    if (!d || !Array.isArray(d.datasets) || d.datasets.length === 0) return false;
    return d.datasets.every((ds: any) => Array.isArray(ds?.data));
};

const Graph: React.FC<Props> = ({ data, options, plugins, className, style, chartType = "line", redrawToken, onChartReady }) => {
    const theme = useTheme<Theme>();
    const chartRef = React.useRef<any>(null);
    const onChartReadyRef = React.useRef<typeof onChartReady>(onChartReady);
    React.useEffect(() => {
        onChartReadyRef.current = onChartReady;
    }, [onChartReady]);
    const setChartRef = React.useCallback((chart: any | null) => {
        chartRef.current = chart;
        onChartReadyRef.current?.(chart ?? null);
    }, []);

    const emptyData = React.useMemo<ChartDataProps>(() => ({
        datasets: [
            {
                label: "",
                type: "line",
                data: [],
                pointRadius: 0,
                showLine: false,
                borderWidth: 0
            }
        ]
    }), []);

    const valid = isValidChartData(data);
    const safeData = valid ? data! : emptyData;

    const themedData = React.useMemo<ChartDataProps>(() => {
        const primary = theme.palette.primary.main;
        const bg = alpha(primary, 0.2);
        return {
            ...safeData,
            datasets: safeData.datasets.map((ds) => ({
                pointBackgroundColor: primary,
                borderColor: primary,
                backgroundColor: bg,
                borderWidth: 2,
                showLine: ds.type !== "scatter" ? true : ds.showLine,
                ...ds
            }))
        };
    }, [safeData, theme]);

    const mergedOptions = React.useMemo(() => {
        const base = buildDefaultOptions(theme);
        return {
            ...base,
            ...(options || {}),
            plugins: {
                ...(base.plugins || {}),
                ...((options && options.plugins) || {})
            }
        } as ChartOptions<"line" | "bar">;
    }, [options, theme]);

    const ChartComponent = chartType === "bar" ? Bar : Line;

    React.useEffect(() => {
        if (redrawToken == null) return;
        const chart = chartRef.current;
        if (!chart) return;
        chart.draw();
    }, [redrawToken]);

    React.useEffect(() => {
        return () => {
            onChartReadyRef.current?.(null);
        };
    }, []);

    return (
        <Box className={className} style={{ height: 360, ...style }}>
            <ChartComponent ref={setChartRef} data={themedData as any} options={mergedOptions as any} plugins={plugins as any} />
        </Box>
    );
};

export default Graph;