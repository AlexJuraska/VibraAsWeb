import React from "react";
import Graph from "../../../components/Graph";
import type { ChartDataProps, Dataset, Point } from "../../../components/Graph";
import type { ChartOptions } from "chart.js";
import { useAudioRecording } from "../state/audioRecordingBus";
import { useAudioPlayback } from "../state/audioPlaybackBus";
import { useTranslation } from "../../../i18n/i18n";

const MAX_POINTS = 5000;

const AudioAnalysisGraph: React.FC<{ busId?: string; label?: string }> = ({ busId = "main", label }) => {
    const { t } = useTranslation();
    const recording = useAudioRecording(busId);
    const playback = useAudioPlayback(busId);
    const [yDomain, setYDomain] = React.useState<{ min: number; max: number } | undefined>(undefined);

    const data = React.useMemo<ChartDataProps | undefined>(() => {
        if (!recording || recording.samples.length === 0 || recording.sampleRate <= 0) return undefined;

        const step = Math.max(1, Math.ceil(recording.samples.length / MAX_POINTS));
        const pts: Point[] = [];
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < recording.samples.length; i += step) {
            const y = recording.samples[i];
            const x = i / recording.sampleRate;
            pts.push({ x, y });
            if (y < min) min = y;
            if (y > max) max = y;
        }

        const lastIdx = recording.samples.length - 1;
        const lastX = lastIdx / recording.sampleRate;
        const lastY = recording.samples[lastIdx];
        if (pts.length === 0 || pts[pts.length - 1].x < lastX) {
            pts.push({ x: lastX, y: lastY });
            if (lastY < min) min = lastY;
            if (lastY > max) max = lastY;
        }

        if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
            min = -1;
            max = 1;
        }
        const pad = Math.max((max - min) * 0.1, 0.05);
        const paddedMin = min - pad;
        const paddedMax = max + pad;
        setYDomain({ min: paddedMin, max: paddedMax });

        const datasets: Dataset[] = [
            {
                label: label ?? t("experiments.audioAnalysis.components.graph.dataset", "Recording"),
                data: pts,
                borderColor: "#1976d2",
                backgroundColor: "rgba(25, 118, 210, 0.2)",
                pointRadius: 0,
            },
        ];

        if (playback && playback.currentTime != null) {
            datasets.push({
                label: "Playhead",
                data: [
                    { x: playback.currentTime, y: paddedMin },
                    { x: playback.currentTime, y: paddedMax },
                ],
                borderColor: "rgba(220,0,0,0.9)",
                backgroundColor: "rgba(220,0,0,0.4)",
                borderWidth: 2,
                pointRadius: 0,
            });
        }

        return { datasets };
    }, [label, playback, recording, t]);

    const durationSec = React.useMemo(() => {
        if (!recording || recording.samples.length === 0 || recording.sampleRate <= 0) return undefined;
        return recording.samples.length / recording.sampleRate;
    }, [recording]);

    const options = React.useMemo<ChartOptions<"line">>(() => ({
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                type: "linear",
                title: { display: true, text: t("experiments.audioAnalysis.components.graph.xAxis", "Time (s)") },
                min: 0,
                max: durationSec,
            },
            y: {
                type: "linear",
                title: { display: true, text: t("experiments.audioAnalysis.components.graph.yAxis", "Amplitude") },
                min: yDomain?.min ?? -1,
                max: yDomain?.max ?? 1,
            },
        },
    }), [t, yDomain, durationSec]);

    const cursorPlugin = React.useMemo(() => ({
        id: "playback-cursor",
        afterDraw(chart: any) {
            if (!playback || playback.currentTime == null || Number.isNaN(playback.currentTime)) return;
            const xScale = chart.scales.x;
            const { chartArea } = chart;
            if (!xScale || !chartArea) return;
            const xMin = xScale.min ?? 0;
            const xMax = xScale.max ?? durationSec ?? 0;
            if (xMax <= xMin) return;
            const xValue = Math.min(Math.max(playback.currentTime, xMin), xMax);
            const xPixel = xScale.getPixelForValue(xValue);
            if (!Number.isFinite(xPixel)) return;
            const ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = "rgba(220,0,0,0.9)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xPixel, chartArea.top);
            ctx.lineTo(xPixel, chartArea.bottom);
            ctx.stroke();
            ctx.restore();
        },
    }), [durationSec, playback]);

    if (!data) {
        return <div>{t("experiments.audioAnalysis.components.graph.empty", "Record audio to see the waveform.")}</div>;
    }

    return <Graph data={data} options={options} plugins={[cursorPlugin]} style={{ width: "100%", height: "100%" }} />;
};

export default AudioAnalysisGraph;

