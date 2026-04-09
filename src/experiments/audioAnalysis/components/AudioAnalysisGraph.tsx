import React from "react";
import { Stack, ButtonGroup, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Slider, IconButton } from "@mui/material";
import ArrowLeftIcon from "@mui/icons-material/ArrowLeft";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import Graph from "../../../components/Graph";
import type { ChartDataProps, Point } from "../../../components/Graph";
import type { ChartOptions } from "chart.js";
import { audioRecordingBus, useAudioRecording } from "../state/audioRecordingBus";
import { audioPlaybackBus, useAudioPlayback } from "../state/audioPlaybackBus";
import { useTranslation } from "../../../i18n/i18n";
import { useAudioFft, useAudioFftPeak } from "../state/audioFftBus";

const MAX_POINTS = 5000;
type ViewMode = "time" | "freq";
type InteractionMode = "zoom" | "cut";

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const dataSize = samples.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([buffer], { type: "audio/wav" });
}

const AudioAnalysisGraph: React.FC<{ busId?: string; label?: string; mode?: ViewMode; initialView?: ViewMode; enableToggle?: boolean }> = ({ busId = "main", label, mode, initialView = "time", enableToggle = false }) => {
    const { t } = useTranslation();
    const recording = useAudioRecording(busId);
    const playback = useAudioPlayback(busId);
    const fftFrame = useAudioFft(busId);
    const fftPeak = useAudioFftPeak(busId);

    const [viewState, setViewState] = React.useState<ViewMode>(initialView);
    const [interactionMode, setInteractionMode] = React.useState<InteractionMode>("zoom");
    const [cutSelection, setCutSelection] = React.useState<{ start: number; end: number } | null>(null);
    const [zoomWindow, setZoomWindow] = React.useState<{ start: number; end: number; fullMin: number; fullMax: number } | null>(null);
    const chartRef = React.useRef<any>(null);
    const playheadTimeRef = React.useRef<number | null>(null);
    const zoomSyncRef = React.useRef<string>("");

    const graphView: ViewMode = enableToggle ? viewState : mode ?? "time";

    React.useEffect(() => {
        if (enableToggle) {
            setViewState(initialView);
        }
    }, [enableToggle, initialView]);

    React.useEffect(() => {
        playheadTimeRef.current = playback?.currentTime ?? null;
    }, [playback?.currentTime]);

    React.useEffect(() => {
        chartRef.current?.resetZoom?.();
        setCutSelection(null);
        setZoomWindow(null);
    }, [graphView, recording?.samples]);

    const playheadPlugin = React.useMemo(() => ({
        id: `playhead-${busId}`,
        afterDraw: (chart: any) => {
            const currentTime = playheadTimeRef.current;
            if (currentTime == null) return;
            const { ctx, chartArea, scales } = chart;
            if (!chartArea || !scales?.x) return;
            const x = scales.x.getPixelForValue(currentTime);
            if (!Number.isFinite(x)) return;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(220,0,0,0.9)";
            ctx.stroke();
            ctx.restore();
        },
    }), [busId]);

    const timeYDomain = React.useMemo<{ min: number; max: number } | undefined>(() => {
        if (!recording || recording.samples.length === 0) return undefined;
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        const s = recording.samples;
        for (let i = 0; i < s.length; i++) {
            const y = s[i];
            if (y < min) min = y;
            if (y > max) max = y;
        }
        if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
            return { min: -1, max: 1 };
        }
        const pad = Math.max((max - min) * 0.1, 0.05);
        return { min: min - pad, max: max + pad };
    }, [recording]);

    const timeData = React.useMemo<ChartDataProps | undefined>(() => {
        if (!recording || recording.samples.length === 0 || recording.sampleRate <= 0) return undefined;

        const step = Math.max(1, Math.ceil(recording.samples.length / MAX_POINTS));
        const pts: Point[] = [];
        for (let i = 0; i < recording.samples.length; i += step) {
            const y = recording.samples[i];
            const x = i / recording.sampleRate;
            pts.push({ x, y });
        }

        const lastIdx = recording.samples.length - 1;
        const lastX = lastIdx / recording.sampleRate;
        const lastY = recording.samples[lastIdx];
        if (pts.length === 0 || pts[pts.length - 1].x < lastX) {
            pts.push({ x: lastX, y: lastY });
        }

        return {
            datasets: [
                {
                    label: label ?? t("experiments.audioAnalysis.components.graph.dataset", "Recording"),
                    data: pts,
                    borderColor: "#1976d2",
                    backgroundColor: "rgba(25, 118, 210, 0.2)",
                    pointRadius: 0,
                },
            ],
        };
    }, [label, recording, t]);

    const freqYMax = React.useMemo(() => {
        if (!fftFrame || fftFrame.magnitudes.length === 0) return 1;
        let frameMax = 0;
        for (let i = 0; i < fftFrame.magnitudes.length; i++) {
            if (fftFrame.magnitudes[i] > frameMax) frameMax = fftFrame.magnitudes[i];
        }
        const peak = fftPeak && fftPeak > 0 ? fftPeak : frameMax > 0 ? frameMax : 1;
        return peak * 1.1;
    }, [fftFrame, fftPeak]);

    const freqData = React.useMemo<ChartDataProps | undefined>(() => {
        if (!fftFrame || fftFrame.magnitudes.length === 0) return undefined;
        const step = Math.max(1, Math.ceil(fftFrame.magnitudes.length / MAX_POINTS));
        const pts: Point[] = [];
        const colors: string[] = [];
        const nyquist = fftFrame.sampleRate / 2;
        for (let i = 0; i < fftFrame.magnitudes.length; i += step) {
            const freq = fftFrame.frequencies[i];
            const y = fftFrame.magnitudes[i];
            pts.push({ x: freq, y });
            const hue = Math.max(0, Math.min(120, (freq / nyquist) * 120));
            colors.push(`hsl(${hue}, 90%, 55%)`);
        }
        const lastIdx = fftFrame.magnitudes.length - 1;
        if (pts.length === 0 || pts[pts.length - 1].x < fftFrame.frequencies[lastIdx]) {
            pts.push({ x: fftFrame.frequencies[lastIdx], y: fftFrame.magnitudes[lastIdx] });
            const hue = Math.max(0, Math.min(120, (fftFrame.frequencies[lastIdx] / nyquist) * 120));
            colors.push(`hsl(${hue}, 90%, 55%)`);
        }
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
    }, [fftFrame, label, t]);

    const durationSec = React.useMemo(() => {
        if (!recording || recording.samples.length === 0 || recording.sampleRate <= 0) return undefined;
        return recording.samples.length / recording.sampleRate;
    }, [recording]);

    const syncZoomWindow = React.useCallback((chart: any) => {
        if (!chart || !durationSec || graphView !== "time") {
            setZoomWindow(null);
            return;
        }

        const xScale = chart.scales?.x;
        if (!xScale) {
            setZoomWindow(null);
            return;
        }

        const fullMin = 0;
        const fullMax = durationSec;
        const start = Math.max(fullMin, Math.min(fullMax, Number(xScale.min)));
        const end = Math.max(fullMin, Math.min(fullMax, Number(xScale.max)));
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            setZoomWindow(null);
            return;
        }

        const fullRange = fullMax - fullMin;
        const viewRange = end - start;
        if (viewRange >= fullRange - 1e-6) {
            setZoomWindow(null);
            return;
        }

        setZoomWindow({ start, end, fullMin, fullMax });
    }, [durationSec, graphView]);

    const applyViewportStart = React.useCallback((nextStart: number) => {
        const chart = chartRef.current;
        if (!chart || !zoomWindow) return;

        const windowSize = zoomWindow.end - zoomWindow.start;
        const maxStart = zoomWindow.fullMax - windowSize;
        const clampedStart = Math.max(zoomWindow.fullMin, Math.min(maxStart, nextStart));
        const clampedEnd = clampedStart + windowSize;

        if (typeof chart.zoomScale === "function") {
            chart.zoomScale("x", { min: clampedStart, max: clampedEnd }, "none");
        } else {
            if (!chart.options.scales) chart.options.scales = {};
            const xScaleOptions: any = chart.options.scales.x ?? {};
            xScaleOptions.min = clampedStart;
            xScaleOptions.max = clampedEnd;
            chart.options.scales.x = xScaleOptions;
            chart.update("none");
        }

        setZoomWindow({ ...zoomWindow, start: clampedStart, end: clampedEnd });
    }, [zoomWindow]);

    const onZoomComplete = React.useCallback((ctx: any) => {
        const chart = ctx?.chart;
        if (interactionMode !== "cut") {
            syncZoomWindow(chart);
            return;
        }
        const xScale = chart?.scales?.x;
        if (!xScale) return;

        const rawMin = Number(xScale.min);
        const rawMax = Number(xScale.max);
        if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return;

        const start = Math.max(0, Math.min(rawMin, rawMax));
        const end = Math.max(rawMin, rawMax);
        if (end - start < 0.005) {
            chart?.resetZoom?.();
            return;
        }

        setCutSelection({ start, end });
    }, [interactionMode, syncZoomWindow]);

    const handleResetZoom = React.useCallback(() => {
        chartRef.current?.resetZoom?.();
        chartRef.current?.update?.("none");
        setCutSelection(null);
        setZoomWindow(null);
    }, []);

    const handleCancelCut = React.useCallback(() => {
        setCutSelection(null);
        chartRef.current?.resetZoom?.();
        chartRef.current?.update?.("none");
        setZoomWindow(null);
    }, []);

    const handleConfirmCut = React.useCallback(() => {
        if (!recording || !cutSelection || recording.sampleRate <= 0) return;

        const sr = recording.sampleRate;
        const startIdx = Math.max(0, Math.floor(cutSelection.start * sr));
        const endIdx = Math.min(recording.samples.length, Math.ceil(cutSelection.end * sr));
        if (endIdx <= startIdx) {
            handleCancelCut();
            return;
        }

        const trimmed = recording.samples.subarray(startIdx, endIdx);
        const samples = new Float32Array(trimmed.length);
        samples.set(trimmed);
        const duration = samples.length / sr;
        const blob = encodeWav(samples, sr);

        audioRecordingBus.publish({ samples, sampleRate: sr, duration, blob }, busId);
        audioPlaybackBus.publish({ currentTime: 0, duration, playing: false }, busId);

        setCutSelection(null);
        chartRef.current?.resetZoom?.();
        chartRef.current?.update?.("none");
        setZoomWindow(null);
    }, [busId, cutSelection, handleCancelCut, recording]);

    const onChartReady = React.useCallback((chart: any | null) => {
        chartRef.current = chart;
        if (chart) syncZoomWindow(chart);
    }, [syncZoomWindow]);

    React.useEffect(() => {
        const chart = chartRef.current;
        if (!chart || graphView !== "time" || !durationSec) return;
        const xScale = chart.scales?.x;
        if (!xScale) return;

        const start = Number(xScale.min);
        const end = Number(xScale.max);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;

        const nextKey = `${start.toFixed(6)}:${end.toFixed(6)}:${durationSec.toFixed(6)}`;
        if (zoomSyncRef.current === nextKey) return;
        zoomSyncRef.current = nextKey;
        syncZoomWindow(chart);
    }, [durationSec, graphView, interactionMode, playback?.currentTime, syncZoomWindow]);

    const timeOptions = React.useMemo<ChartOptions<"bar" | "line">>(() => ({
        animation: false,
        plugins: {
            legend: { display: false },
            zoom: {
                limits: {
                    x: { min: "original", max: "original", minRange: 0.01 },
                },
                pan: { enabled: false },
                zoom: {
                    mode: "x",
                    drag: {
                        enabled: true,
                        threshold: 5,
                        backgroundColor: "rgba(25, 118, 210, 0.2)",
                        borderColor: "rgba(25, 118, 210, 0.8)",
                        borderWidth: 1,
                    },
                    wheel: { enabled: false },
                    pinch: { enabled: false },
                    onZoomComplete,
                },
            },
        },
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
    }), [durationSec, onZoomComplete, t, timeYDomain]);

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
                max: freqYMax,
            },
        },
    }), [fftFrame, freqYMax, t]);

    const activeData = graphView === "time" ? timeData : freqData;
    const activeOptions = graphView === "time" ? timeOptions : freqOptions;
    const activeChartType = graphView === "freq" ? "bar" : "line";
    const graphPlugins = React.useMemo(() => {
        const list: any[] = [];
        if (graphView === "time") list.push(playheadPlugin);
        return list;
    }, [graphView, playheadPlugin]);

    const topControls = (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {enableToggle && (
                <ButtonGroup size="small" variant="outlined">
                    <Button variant={graphView === "time" ? "contained" : "outlined"} onClick={() => setViewState("time")}>
                        {t("experiments.audioAnalysis.components.graph.waveform", "Waveform")}
                    </Button>
                    <Button variant={graphView === "freq" ? "contained" : "outlined"} onClick={() => setViewState("freq")}>
                        {t("experiments.audioAnalysis.components.graph.fft", "FFT")}
                    </Button>
                </ButtonGroup>
            )}
            {graphView === "time" && (
                <>
                    <ButtonGroup size="small" variant="outlined">
                        <Button variant={interactionMode === "zoom" ? "contained" : "outlined"} onClick={() => setInteractionMode("zoom")}>
                            {t("experiments.audioAnalysis.components.graph.zoomMode", "Zoom")}
                        </Button>
                        <Button
                            variant={interactionMode === "cut" ? "contained" : "outlined"}
                            color={interactionMode === "cut" ? "warning" : "primary"}
                            onClick={() => setInteractionMode("cut")}
                        >
                            {t("experiments.audioAnalysis.components.graph.cutMode", "Cut")}
                        </Button>
                    </ButtonGroup>
                    <Button size="small" variant="outlined" onClick={handleResetZoom}>
                        {t("experiments.audioAnalysis.components.graph.resetZoom", "Reset")}
                    </Button>
                </>
            )}
        </Stack>
    );

    return (
        <Stack spacing={1} sx={{ height: "100%" }}>
            {topControls}
            {graphView === "time" && interactionMode === "zoom" && zoomWindow && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={() => applyViewportStart(zoomWindow.start - (zoomWindow.end - zoomWindow.start) * 0.1)}
                        disabled={zoomWindow.start <= zoomWindow.fullMin + 1e-6}
                    >
                        <ArrowLeftIcon fontSize="small" />
                    </IconButton>
                    <Slider
                        value={zoomWindow.start}
                        min={zoomWindow.fullMin}
                        max={Math.max(zoomWindow.fullMin, zoomWindow.fullMax - (zoomWindow.end - zoomWindow.start))}
                        step={Math.max(0.001, (zoomWindow.fullMax - zoomWindow.fullMin) / 2000)}
                        onChange={(_, value) => applyViewportStart(Array.isArray(value) ? value[0] : value)}
                        aria-label={t("experiments.audioAnalysis.components.graph.scrollZoom", "Scroll zoomed view")}
                    />
                    <IconButton
                        size="small"
                        onClick={() => applyViewportStart(zoomWindow.start + (zoomWindow.end - zoomWindow.start) * 0.1)}
                        disabled={zoomWindow.end >= zoomWindow.fullMax - 1e-6}
                    >
                        <ArrowRightIcon fontSize="small" />
                    </IconButton>
                </Stack>
            )}
            {activeData ? (
                <Graph
                    key={`${busId}-${graphView}`}
                    data={activeData}
                    options={activeOptions}
                    plugins={graphPlugins}
                    redrawToken={playback?.currentTime ?? 0}
                    onChartReady={onChartReady}
                    style={{ width: "100%", height: "100%" }}
                    chartType={activeChartType}
                />
            ) : (
                <div>
                    {graphView === "time"
                        ? t("experiments.audioAnalysis.components.graph.empty", "Record audio to see the waveform.")
                        : t("experiments.audioAnalysis.components.graph.fftEmpty", "Record audio to see the spectrum.")}
                </div>
            )}

            <Dialog open={!!cutSelection} onClose={handleCancelCut}>
                <DialogTitle>{t("experiments.audioAnalysis.components.graph.cutConfirmTitle", "Confirm cut")}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t("experiments.audioAnalysis.components.graph.cutConfirmText", "Keep only the selected segment and discard the rest?")}
                    </DialogContentText>
                    {cutSelection && (
                        <DialogContentText>
                            {`${cutSelection.start.toFixed(3)}s - ${cutSelection.end.toFixed(3)}s`}
                        </DialogContentText>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelCut}>
                        {t("experiments.audioAnalysis.components.graph.cancel", "Cancel")}
                    </Button>
                    <Button color="warning" variant="contained" onClick={handleConfirmCut}>
                        {t("experiments.audioAnalysis.components.graph.confirmCut", "Cut")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};

export default AudioAnalysisGraph;

