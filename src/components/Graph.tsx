import React from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions
} from "chart.js";
import Box from "@mui/material/Box";
import { useTheme, alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export type Point = { x: number; y: number };

export type Dataset = {
    label: string;
    data: Point[];
    type?: "line" | "scatter";
    stepped?: boolean;
    pointBackgroundColor?: string;
    pointRadius?: number;
    showLine?: boolean;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
};

export type ChartDataProps = {
    datasets: Dataset[];
};

type Props = {
    data?: ChartDataProps;
    options?: ChartOptions<"line">;
    plugins?: any[];
    className?: string;
    style?: React.CSSProperties;
};

const buildDefaultOptions = (theme: Theme): ChartOptions<"line"> => ({
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
            titleColor: theme.palette.text.primary,
            bodyColor: theme.palette.text.secondary
        }
    }
});

const isValidChartData = (d: any): d is ChartDataProps => {
    if (!d || !Array.isArray(d.datasets) || d.datasets.length === 0) return false;
    return d.datasets.every((ds: any) => Array.isArray(ds?.data));
};

const Graph: React.FC<Props> = ({ data, options, plugins, className, style }) => {
    const theme = useTheme<Theme>();

    // Provide a safe empty dataset when no data is passed
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
        } as ChartOptions<"line">;
    }, [options, theme]);

    return (
        <Box className={className} style={{ height: 360, ...style }}>
            <Line data={themedData as any} options={mergedOptions as any} plugins={plugins as any} />
        </Box>
    );
};

export default Graph;