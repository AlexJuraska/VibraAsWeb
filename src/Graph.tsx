import React from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    zoomPlugin
);

type Point = { x: number; y: number };

type Dataset = {
    label: string;
    data: Point[];
    stepped?: boolean;
    type?: "scatter" | "line";
    pointBackgroundColor?: string;
    pointRadius?: number;
    showLine?: boolean;
};

type AppData = { datasets: Dataset[] };

const mockStates: AppData[] = [
    {
        datasets: [
            {
                label: "Node Values",
                data: [
                    { x: 0, y: 12 },
                    { x: 1, y: 19 },
                    { x: 2, y: 3 },
                    { x: 3, y: 5 },
                    { x: 4, y: 8 },
                    { x: 5, y: 15 },
                    { x: 6, y: 7 },
                    { x: 7, y: 10 }
                ],
                stepped: true
            }
        ]
    },
    {
        datasets: [
            {
                label: "Node Values",
                data: [
                    { x: 0, y: 5 },
                    { x: 1, y: 10 },
                    { x: 2, y: 15 },
                    { x: 3, y: 20 },
                    { x: 4, y: 18 },
                    { x: 5, y: 12 },
                    { x: 6, y: 6 },
                    { x: 7, y: 9 }
                ],
                stepped: false
            }
        ]
    },
    {
        datasets: [
            {
                label: "Node Values",
                data: [
                    { x: 0, y: 20 },
                    { x: 1, y: 5 },
                    { x: 2, y: 10 },
                    { x: 3, y: 8 },
                    { x: 4, y: 14 },
                    { x: 5, y: 11 },
                    { x: 6, y: 17 },
                    { x: 7, y: 4 }
                ]
            }
        ]
    }
];

function findPeaks(data: Point[]): Point[] {
    const peaks: Point[] = [];
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i].y > data[i - 1].y && data[i].y > data[i + 1].y) {
            peaks.push({ x: data[i].x, y: data[i].y });
        }
    }
    return peaks;
}

const getOptions = (zoomEnabled: boolean): ChartOptions => ({
    responsive: true,
    scales: {
        x: { type: "linear", title: { display: true, text: "X" } },
        y: { title: { display: true, text: "Y" } }
    },
    plugins: {
        legend: { position: "top" },
        title: { display: true, text: "Super chart" },
        zoom: {
            pan: { enabled: !zoomEnabled, mode: "xy" },
            zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: "xy",
                drag: {
                    enabled: zoomEnabled,
                    backgroundColor: "rgba(0,123,255,0.2)",
                    borderColor: "rgba(0,123,255,0.5)",
                    borderWidth: 1
                }
            }
        }
    }
});

const Graph: React.FC = () => {
    const [chartData, setChartData] = React.useState<AppData>(mockStates[0]);
    const [zoomEnabled, setZoomEnabled] = React.useState<boolean>(false);

    const peaks = findPeaks(chartData.datasets[0].data);
    const peakDataset: Dataset = {
        label: "Peaks",
        data: peaks,
        type: "scatter",
        pointBackgroundColor: "red",
        pointRadius: 6,
        showLine: false
    };

    const displayData: AppData = {
        ...chartData,
        datasets: [chartData.datasets[0], peakDataset]
    };

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "1") setChartData(mockStates[0]);
            if (e.key === "2") setChartData(mockStates[1]);
            if (e.key === "3") setChartData(mockStates[2]);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div>
            <label>
                <input
                    type="checkbox"
                    checked={zoomEnabled}
                    onChange={(e) => setZoomEnabled(e.target.checked)}
                />
                Enable drag zoom (disables move)
            </label>
            {/* cast to any to avoid chartjs-plugin-zoom type friction */}
            <Line data={displayData as any} options={getOptions(zoomEnabled) as any} />
            <p>Ine data pomocou 1 (stepped, ako v spectre) 2 3 na klavesnici</p>
        </div>
    );
};

export default Graph;
