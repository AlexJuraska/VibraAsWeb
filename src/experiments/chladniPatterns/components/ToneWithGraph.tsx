import React from "react";
import Graph from "../../../components/Graph";
import ToneGenerator from "./ToneGenerator";
import type { ChartDataProps } from "../../../components/Graph";
import { FIXED_TIME_WINDOW_S } from "./SoundToGraphConvertor";
import type { ChartOptions } from "chart.js";

const ToneWithGraph: React.FC = () => {
    const [data, setData] = React.useState<ChartDataProps | undefined>(undefined);

    const options = React.useMemo<ChartOptions<"line">>(() => ({
        animation: false,
        animations: {
            colors: { duration: 0 },
            x: { duration: 0 },
            y: { duration: 0 }
        },
        transitions: {
            active: { animation: { duration: 0 } },
            show: { animations: { x: { duration: 0 }, y: { duration: 0 } } },
            hide: { animations: { x: { duration: 0 }, y: { duration: 0 } } }
        },
        scales: {
            x: {
                type: "linear" as const,
                min: 0,
                max: FIXED_TIME_WINDOW_S,
                title: { display: true, text: "Time (s)" }
            },
            y: {
                type: "linear" as const,
                min: -1,
                max: 1,
                title: { display: true, text: "Amplitude (dB)" }
            }
        }
    }), []);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, height: "100%" }}>
            <ToneGenerator label="Chladni Tone" onOscillogram={setData} />
            <Graph data={data} options={options} style={{ width: "100%", height: "100%" }} />
        </div>
    );
};

export default ToneWithGraph;