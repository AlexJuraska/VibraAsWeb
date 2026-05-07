import React from "react";
import { Stack, ButtonGroup, Button, Checkbox, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, FormControlLabel, Slider, IconButton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import ArrowLeftIcon from "@mui/icons-material/ArrowLeft";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import Graph from "../../../components/Graph";
import type { ChartDataProps, Point } from "../../../components/Graph";
import type { ChartOptions } from "chart.js";
import { audioRecordingBus, useAudioRecording } from "../state/audioRecordingBus";
import { audioPlaybackBus, useAudioPlayback } from "../state/audioPlaybackBus";
import { useTranslation } from "../../../i18n/i18n";
import { useAudioFft, useAudioFftPeak } from "../state/audioFftBus";
import { encodeWav } from "../../../utils/encodeWav";

const MAX_POINTS = 15000;
const FFT_DISPLAY_MAX_HZ = 20000;

type ViewMode = "time" | "freq";
type InteractionMode = "zoom" | "cut";


function niceTicks(min: number, max: number, targetCount: number): number[] {
    if (max <= min || targetCount < 1) return [];
    const range = max - min;
    const rawStep = range / Math.max(1, targetCount);
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= rawStep) ?? mag;
    const start = Math.ceil((min + step * 1e-9) / step) * step;
    const ticks: number[] = [];
    for (let t = start; t < max - step * 1e-9; t += step) {
        ticks.push(Number(t.toFixed(10)));
    }
    return ticks;
}

const WAVEFORM_COLOR = "#1976d2";
const WAVEFORM_FILL = "rgba(25, 118, 210, 0.2)";

const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 8;
const PAD_BOTTOM = 40;

function drawLiveWaveform(
    canvas: HTMLCanvasElement,
    samples: Float32Array,
    sampleRate: number,
    yBoundsRef: { current: { min: number; max: number } | null },
    theme: Theme,
    xLabel: string,
    yLabel: string,
) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const chartL = PAD_LEFT;
    const chartT = PAD_TOP;
    const chartW = Math.max(1, cssW - PAD_LEFT - PAD_RIGHT);
    const chartH = Math.max(1, cssH - PAD_TOP - PAD_BOTTOM);

    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < samples.length; i++) {
        const v = samples[i];
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = -1; yMax = 1; }

    const prev = yBoundsRef.current;
    if (!prev) {
        yBoundsRef.current = { min: yMin, max: yMax };
    } else {
        if (yMin < prev.min) prev.min = yMin;
        if (yMax > prev.max) prev.max = yMax;
    }
    yMin = yBoundsRef.current!.min;
    yMax = yBoundsRef.current!.max;

    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yPad = Math.max((yMax - yMin) * 0.1, 0.05);
    yMin -= yPad;
    yMax += yPad;

    const duration = samples.length / sampleRate;

    const toX = (t: number) => chartL + (t / duration) * chartW;
    const toY = (v: number) => chartT + (1 - (v - yMin) / (yMax - yMin)) * chartH;

    const divider = theme.palette.divider;
    const textSec = theme.palette.text.secondary;
    const textPri = theme.palette.text.primary;
    const fontFamily = (theme.typography.fontFamily as string)?.split(",")[0]?.trim() ?? "sans-serif";
    const tickFont = `12px ${fontFamily}`;
    const labelFont = `12px ${fontFamily}`;

    ctx.lineWidth = 1;

    const yTicks = niceTicks(yMin, yMax, Math.max(2, Math.floor(chartH / 40)));
    ctx.font = tickFont;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const tick of yTicks) {
        const py = toY(tick);
        ctx.strokeStyle = divider;
        ctx.beginPath(); ctx.moveTo(chartL, py); ctx.lineTo(chartL + chartW, py); ctx.stroke();
        ctx.fillStyle = textSec;
        ctx.fillText(parseFloat(tick.toFixed(3)).toString(), chartL - 6, py);
    }

    const xTicks = niceTicks(0, duration, Math.max(2, Math.floor(chartW / 60)));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const tick of xTicks) {
        const px = toX(tick);
        ctx.strokeStyle = divider;
        ctx.beginPath(); ctx.moveTo(px, chartT); ctx.lineTo(px, chartT + chartH); ctx.stroke();
        ctx.fillStyle = textSec;
        ctx.fillText(parseFloat(tick.toFixed(2)).toString(), px, chartT + chartH + 4);
    }

    ctx.strokeStyle = divider;
    ctx.lineWidth = 1;
    ctx.strokeRect(chartL, chartT, chartW, chartH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(chartL, chartT, chartW, chartH);
    ctx.clip();

    const topPts = new Float64Array(chartW);
    const botPts = new Float64Array(chartW);
    for (let px = 0; px < chartW; px++) {
        const tS = (px / chartW) * duration;
        const tE = ((px + 1) / chartW) * duration;
        const iS = Math.floor(tS * sampleRate);
        const iE = Math.min(samples.length - 1, Math.ceil(tE * sampleRate));
        let lo = 0;
        let hi = 0;
        for (let i = iS; i <= iE; i++) {
            const v = samples[i];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
        }
        topPts[px] = toY(hi);
        botPts[px] = toY(lo);
    }

    ctx.beginPath();
    ctx.moveTo(chartL, topPts[0]);
    for (let px = 1; px < chartW; px++) ctx.lineTo(chartL + px, topPts[px]);
    for (let px = chartW - 1; px >= 0; px--) ctx.lineTo(chartL + px, botPts[px]);
    ctx.closePath();
    ctx.fillStyle = WAVEFORM_FILL;
    ctx.fill();

    ctx.strokeStyle = WAVEFORM_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartL, topPts[0]);
    for (let px = 1; px < chartW; px++) ctx.lineTo(chartL + px, topPts[px]);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(chartL, botPts[0]);
    for (let px = 1; px < chartW; px++) ctx.lineTo(chartL + px, botPts[px]);
    ctx.stroke();

    ctx.restore();

    ctx.font = labelFont;
    ctx.fillStyle = textPri;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(xLabel, chartL + chartW / 2, cssH - 2);

    ctx.save();
    ctx.translate(10, chartT + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
}

const LiveWaveformCanvas: React.FC<{
    busId: string;
    xLabel: string;
    yLabel: string;
    style?: React.CSSProperties;
}> = ({ busId, xLabel, yLabel, style }) => {
    const theme = useTheme<Theme>();
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const yBoundsRef = React.useRef<{ min: number; max: number } | null>(null);
    const pendingRef = React.useRef<{ samples: Float32Array; sampleRate: number } | null>(null);
    const dirtyRef = React.useRef(false);
    const drawParamsRef = React.useRef({ theme, xLabel, yLabel });

    React.useEffect(() => {
        drawParamsRef.current = { theme, xLabel, yLabel };
    });

    React.useEffect(() => {
        yBoundsRef.current = null;
        pendingRef.current = null;
        dirtyRef.current = false;

        const unsub = audioRecordingBus.subscribe((rec) => {
            pendingRef.current = (rec && rec.samples.length > 0 && rec.sampleRate > 0)
                ? { samples: rec.samples, sampleRate: rec.sampleRate }
                : null;
            dirtyRef.current = true;
        }, busId);

        let rafId: number;
        const loop = () => {
            if (dirtyRef.current) {
                dirtyRef.current = false;
                const canvas = canvasRef.current;
                if (canvas) {
                    const data = pendingRef.current;
                    if (data) {
                        const { theme: t, xLabel: xl, yLabel: yl } = drawParamsRef.current;
                        drawLiveWaveform(canvas, data.samples, data.sampleRate, yBoundsRef, t, xl, yl);
                    } else {
                        const ctx = canvas.getContext("2d");
                        ctx?.clearRect(0, 0, canvas.width, canvas.height);
                    }
                }
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        return () => {
            unsub();
            cancelAnimationFrame(rafId);
        };
    }, [busId]);

    return (
        <div style={{ width: "100%", height: "100%", ...style }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
    );
};



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
    const [autoTooltip, setAutoTooltip] = React.useState(false);
    const chartRef = React.useRef<any>(null);
    const playheadTimeRef = React.useRef<number | null>(null);
    const zoomSyncRef = React.useRef<string>("");
    const suppressCutRef = React.useRef(false);

    const graphView: ViewMode = enableToggle ? viewState : mode ?? "time";
    const isLiveRecording = !!recording && !recording.blob;
    const showLiveCanvas = isLiveRecording && graphView === "time";

    React.useEffect(() => {
        if (enableToggle) {
            setViewState(initialView);
        }
    }, [enableToggle, initialView]);

    React.useLayoutEffect(() => {
        playheadTimeRef.current = playback?.currentTime ?? null;
    }, [playback?.currentTime]);

    React.useEffect(() => {
        chartRef.current?.resetZoom?.();
        setCutSelection(null);
        setZoomWindow(null);
    }, [graphView, recording?.blob]);

    const drawPlayhead = React.useCallback((chart: any) => {
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
    }, []);

    const playheadPlugin = React.useMemo<any>(() => ({
        id: `playhead-${busId}`,
        afterDraw: drawPlayhead,
    }), [busId, drawPlayhead]);

    const timeYDomain = React.useMemo<{ min: number; max: number } | undefined>(() => {
        if (isLiveRecording || !recording || recording.samples.length === 0) return undefined;
        const s = recording.samples;
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        const step = Math.max(1, Math.ceil(s.length / 2_000_000));
        for (let i = 0; i < s.length; i += step) {
            const y = s[i];
            if (y < min) min = y;
            if (y > max) max = y;
        }
        if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { min: -1, max: 1 };
        const pad = Math.max((max - min) * 0.1, 0.05);
        return { min: min - pad, max: max + pad };
    }, [isLiveRecording, recording]);

    const timeData = React.useMemo<ChartDataProps | undefined>(() => {
        if (isLiveRecording || !recording || recording.samples.length === 0 || recording.sampleRate <= 0) return undefined;

        const { samples, sampleRate } = recording;
        const step = Math.max(1, Math.ceil(samples.length / MAX_POINTS));
        const pts: Point[] = [];

        for (let i = 0; i < samples.length; i += step) {
            const end = Math.min(i + step, samples.length);
            let minIdx = i;
            let maxIdx = i;
            for (let j = i + 1; j < end; j++) {
                if (samples[j] < samples[minIdx]) minIdx = j;
                if (samples[j] > samples[maxIdx]) maxIdx = j;
            }
            if (minIdx === maxIdx) {
                pts.push({ x: minIdx / sampleRate, y: samples[minIdx] });
            } else if (minIdx < maxIdx) {
                pts.push({ x: minIdx / sampleRate, y: samples[minIdx] });
                pts.push({ x: maxIdx / sampleRate, y: samples[maxIdx] });
            } else {
                pts.push({ x: maxIdx / sampleRate, y: samples[maxIdx] });
                pts.push({ x: minIdx / sampleRate, y: samples[minIdx] });
            }
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
    }, [isLiveRecording, label, recording, t]);


    const durationSec = React.useMemo(() => {
        if (isLiveRecording || !recording || recording.samples.length === 0 || recording.sampleRate <= 0) return undefined;
        return recording.samples.length / recording.sampleRate;
    }, [isLiveRecording, recording]);

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
        if (suppressCutRef.current) {
            suppressCutRef.current = false;
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
        suppressCutRef.current = true;
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

    React.useEffect(() => {
        if (graphView !== "time" || !zoomWindow) return;
        const chart = chartRef.current;
        const xScale = chart?.scales?.x;
        if (!chart || !xScale) return;

        const currentMin = Number(xScale.min);
        const currentMax = Number(xScale.max);
        const same = Number.isFinite(currentMin) && Number.isFinite(currentMax)
            && Math.abs(currentMin - zoomWindow.start) < 1e-6
            && Math.abs(currentMax - zoomWindow.end) < 1e-6;
        if (same) return;

        if (typeof chart.zoomScale === "function") {
            chart.zoomScale("x", { min: zoomWindow.start, max: zoomWindow.end }, "none");
        } else {
            if (!chart.options.scales) chart.options.scales = {};
            const xScaleOptions: any = chart.options.scales.x ?? {};
            xScaleOptions.min = zoomWindow.start;
            xScaleOptions.max = zoomWindow.end;
            chart.options.scales.x = xScaleOptions;
            chart.update("none");
        }
    }, [graphView, zoomWindow]);

    const timeOptions = React.useMemo<ChartOptions<"bar" | "line">>(() => ({
        animation: false,
        plugins: {
            legend: { display: false },
            tooltip: autoTooltip ? { mode: "index", intersect: false } : {},
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
                    wheel: { enabled: true },
                    pinch: { enabled: false },
                    onZoomComplete,
                },
            },
        },
        scales: {
            x: {
                type: "linear",
                title: { display: true, text: t("experiments.audioAnalysis.components.graph.xAxis", "Time (s)") },
                min: zoomWindow?.start ?? 0,
                max: zoomWindow?.end ?? durationSec,
            },
            y: {
                type: "linear",
                title: { display: true, text: t("experiments.audioAnalysis.components.graph.yAxis", "Amplitude") },
                min: timeYDomain?.min ?? -1,
                max: timeYDomain?.max ?? 1,
            },
        },
    }), [autoTooltip, durationSec, onZoomComplete, t, timeYDomain, zoomWindow]);

    const freqYMax = React.useMemo(() => {
        if (!fftFrame || fftFrame.magnitudes.length === 0) return 1;
        let frameMax = 0;
        for (let i = 0; i < fftFrame.magnitudes.length; i++) {
            if (fftFrame.magnitudes[i] > frameMax) frameMax = fftFrame.magnitudes[i];
        }
        const peak = fftPeak && fftPeak > 0 ? fftPeak : frameMax > 0 ? frameMax : 1;
        return peak * 1.1;
    }, [fftFrame, fftPeak]);

    const maxFreq = React.useMemo(() => {
        if (!fftFrame || fftFrame.magnitudes.length === 0) return FFT_DISPLAY_MAX_HZ;
        let frameMax = 0;
        for (let i = 0; i < fftFrame.magnitudes.length; i++) {
            if (fftFrame.magnitudes[i] > frameMax) frameMax = fftFrame.magnitudes[i];
        }
        const threshold = Math.max(1e-10, frameMax * 0.001);
        for (let i = fftFrame.magnitudes.length - 1; i >= 0; i--) {
            if (fftFrame.magnitudes[i] > threshold) {
                return Math.min(FFT_DISPLAY_MAX_HZ, Math.ceil(fftFrame.frequencies[i]));
            }
        }
        return FFT_DISPLAY_MAX_HZ;
    }, [fftFrame]);

    const freqData = React.useMemo<ChartDataProps | undefined>(() => {
        if (!fftFrame || fftFrame.magnitudes.length === 0) return undefined;
        const step = Math.max(1, Math.ceil(fftFrame.magnitudes.length / MAX_POINTS));
        const nyquist = fftFrame.sampleRate / 2;
        const pts: Point[] = [];
        const colors: string[] = [];
        for (let i = 0; i < fftFrame.magnitudes.length; i += step) {
            const freq = fftFrame.frequencies[i];
            if (freq > maxFreq) break;
            pts.push({ x: freq, y: fftFrame.magnitudes[i] });
            const hue = Math.max(0, Math.min(120, (freq / Math.min(nyquist, maxFreq)) * 120));
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
                    barPercentage: 1,
                    categoryPercentage: 1,
                },
            ],
        };
    }, [fftFrame, maxFreq, label, t]);

    const freqOptions = React.useMemo<ChartOptions<"bar" | "line">>(() => ({
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                type: "linear",
                title: { display: true, text: t("experiments.audioAnalysis.components.graph.freqAxis", "Frequency (Hz)") },
                min: 0,
                max: maxFreq,
                offset: false,
            },
            y: {
                type: "linear",
                title: { display: true, text: t("experiments.audioAnalysis.components.graph.magAxis", "Amplitude") },
                min: 0,
                max: freqYMax,
            },
        },
    }), [freqYMax, maxFreq, t]);

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
            {graphView === "time" && !isLiveRecording && (
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
                    <FormControlLabel
                        control={
                            <Checkbox
                                size="small"
                                checked={autoTooltip}
                                onChange={(e) => setAutoTooltip(e.target.checked)}
                            />
                        }
                        label={t("experiments.audioAnalysis.components.graph.autoTooltip", "Auto-display values")}
                        slotProps={{ typography: { variant: "body2" } }}
                    />
                </>
            )}
        </Stack>
    );

    return (
        <Stack spacing={1} sx={{ height: "100%" }}>
            {topControls}
            {graphView === "time" && interactionMode === "zoom" && zoomWindow && !isLiveRecording && (
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
            {showLiveCanvas ? (
                <LiveWaveformCanvas
                    busId={busId}
                    xLabel={t("experiments.audioAnalysis.components.graph.xAxis", "Time (s)")}
                    yLabel={t("experiments.audioAnalysis.components.graph.yAxis", "Amplitude")}
                    style={{ width: "100%", height: "100%" }}
                />
            ) : activeData ? (
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

