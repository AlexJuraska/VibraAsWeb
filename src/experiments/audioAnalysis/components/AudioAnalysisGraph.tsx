import React from "react";
import { Button, ButtonGroup, Stack } from "@mui/material";
import Graph from "../../../components/Graph";
import type { ChartDataProps, Dataset, Point } from "../../../components/Graph";
import type { ChartOptions } from "chart.js";
import { useAudioRecording } from "../state/audioRecordingBus";
import { useAudioPlayback } from "../state/audioPlaybackBus";
import { useTranslation } from "../../../i18n/i18n";
import { useAudioFft, useAudioFftPeak } from "../state/audioFftBus";

const MAX_POINTS = 5000;
type ViewMode = "time" | "freq";

const AudioAnalysisGraph: React.FC<{ busId?: string; label?: string }> = ({ busId = "main", label }) => {
    const { t } = useTranslation();
    const recording = useAudioRecording(busId);
    const playback = useAudioPlayback(busId);
    const fftFrame = useAudioFft(busId);
    const fftPeak = useAudioFftPeak(busId);
    const [timeYDomain, setTimeYDomain] = React.useState<{ min: number; max: number } | undefined>(undefined);
    const [freqYDomain, setFreqYDomain] = React.useState<{ min: number; max: number } | undefined>(undefined);
    const [graphView, setGraphView] = React.useState<ViewMode>("time");

    const recordingPeak = React.useMemo(() => {
        if (!recording || recording.samples.length === 0) return undefined;
        let max = 0;
        const s = recording.samples;
        for (let i = 0; i < s.length; i++) {
            const v = Math.abs(s[i]);
            if (v > max) max = v;
        }
        return max || undefined;
    }, [recording]);

    const timeData = React.useMemo<ChartDataProps | undefined>(() => {
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
        setTimeYDomain({ min: paddedMin, max: paddedMax });

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

    const freqData = React.useMemo<ChartDataProps | undefined>(() => {
        if (!fftFrame || fftFrame.magnitudes.length === 0) return undefined;
        const step = Math.max(1, Math.ceil(fftFrame.magnitudes.length / MAX_POINTS));
        const pts: Point[] = [];
        const colors: string[] = [];
        const nyquist = fftFrame.sampleRate / 2;
        let maxMag = 0;
        for (let i = 0; i < fftFrame.magnitudes.length; i += step) {
            const freq = fftFrame.frequencies[i];
            const y = fftFrame.magnitudes[i];
            pts.push({ x: freq, y });
            if (y > maxMag) maxMag = y;
            const hue = Math.max(0, Math.min(120, (freq / nyquist) * 120));
            colors.push(`hsl(${hue}, 90%, 55%)`);
        }
        // Ensure the Nyquist bin is included for full-width rendering.
        const lastIdx = fftFrame.magnitudes.length - 1;
        if (pts.length === 0 || pts[pts.length - 1].x < fftFrame.frequencies[lastIdx]) {
            pts.push({ x: fftFrame.frequencies[lastIdx], y: fftFrame.magnitudes[lastIdx] });
            if (fftFrame.magnitudes[lastIdx] > maxMag) maxMag = fftFrame.magnitudes[lastIdx];
            const hue = Math.max(0, Math.min(120, (fftFrame.frequencies[lastIdx] / nyquist) * 120));
            colors.push(`hsl(${hue}, 90%, 55%)`);
        }
        const peak = fftPeak && fftPeak > 0 ? fftPeak : maxMag > 0 ? maxMag : 1;
        const paddedPeak = peak * 1.1;
        setFreqYDomain({ min: 0, max: paddedPeak });

        return {
            datasets: [
                {
                    label: label ?? t("experiments.audioAnalysis.components.graph.fftDataset", "FFT"),
                    data: pts,
                    type: "bar",
                    backgroundColor: colors,
                    borderWidth: 0,
                    pointRadius: 0,
                    showLine: false,
                },
            ],
        };
    }, [fftFrame, label, recordingPeak, t]);

    const durationSec = React.useMemo(() => {
        if (!recording || recording.samples.length === 0 || recording.sampleRate <= 0) return undefined;
        return recording.samples.length / recording.sampleRate;
    }, [recording]);

    const timeOptions = React.useMemo<ChartOptions<"bar" | "line">>(() => ({
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
                min: timeYDomain?.min ?? -1,
                max: timeYDomain?.max ?? 1,
            },
        },
    }), [t, timeYDomain, durationSec]);

    const freqOptions = React.useMemo<ChartOptions<"bar" | "line">>(() => ({
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                type: "linear",
                title: { display: true, text: t("experiments.audioAnalysis.components.graph.freqAxis", "Frequency (Hz)") },
                min: 0,
                max: fftFrame ? fftFrame.sampleRate / 2 : undefined,
                offset: false,
            },
            y: {
                type: "linear",
                title: { display: true, text: t("experiments.audioAnalysis.components.graph.magAxis", "Amplitude") },
                min: 0,
                max: freqYDomain?.max ?? 1,
            },
        },
    }), [fftFrame, freqYDomain?.max, t]);

    const activeData = graphView === "time" ? timeData : freqData;
    const activeOptions = graphView === "time" ? timeOptions : freqOptions;
    const activeChartType = graphView === "freq" ? "bar" : "line";

    if (!activeData) {
        return (
            <Stack spacing={1} sx={{ height: "100%" }}>
                <ButtonGroup size="small" variant="outlined">
                    <Button variant={graphView === "time" ? "contained" : "outlined"} onClick={() => setGraphView("time")}>
                        {t("experiments.audioAnalysis.components.graph.waveform", "Waveform")}
                    </Button>
                    <Button variant={graphView === "freq" ? "contained" : "outlined"} onClick={() => setGraphView("freq")}>
                        {t("experiments.audioAnalysis.components.graph.fft", "FFT")}
                    </Button>
                </ButtonGroup>
                <div>
                    {graphView === "time"
                        ? t("experiments.audioAnalysis.components.graph.empty", "Record audio to see the waveform.")
                        : t("experiments.audioAnalysis.components.graph.fftEmpty", "Record audio to see the spectrum.")}
                </div>
            </Stack>
        );
    }

    return (
        <Stack spacing={1} sx={{ height: "100%" }}>
            <ButtonGroup size="small" variant="outlined">
                <Button variant={graphView === "time" ? "contained" : "outlined"} onClick={() => setGraphView("time")}>
                    {t("experiments.audioAnalysis.components.graph.waveform", "Waveform")}
                </Button>
                <Button variant={graphView === "freq" ? "contained" : "outlined"} onClick={() => setGraphView("freq")}>
                    {t("experiments.audioAnalysis.components.graph.fft", "FFT")}
                </Button>
            </ButtonGroup>
            <Graph
                key={`${busId}-${graphView}`}
                data={activeData}
                options={activeOptions}
                plugins={undefined}
                style={{ width: "100%", height: "100%" }}
                chartType={activeChartType}
            />
        </Stack>
    );
};

export default AudioAnalysisGraph;

