import React from "react";
import { Stack, ButtonGroup, Button, Checkbox, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, FormControlLabel, Slider, IconButton, Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import ArrowLeftIcon from "@mui/icons-material/ArrowLeft";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import Graph from "../../../components/Graph";
import type { ChartDataProps, Point } from "../../../components/Graph";
import type { ChartOptions } from "chart.js";
import { audioRecordingBus, useAudioRecording } from "../state/audioRecordingBus";
import { audioPlaybackBus } from "../state/audioPlaybackBus";
import { useTranslation } from "../../../i18n/i18n";
import { audioFftBus, useAudioFft, useAudioFftPeak } from "../state/audioFftBus";
import { useAudioStft, deriveMaxFrequency, type AudioStftFrame } from "../state/audioStftBus";
import { encodeWav } from "../../../utils/encodeWav";

const MAX_POINTS = 15000;

// ─── Live-waveform performance knobs ──────────────────────────────────────────
// MAX_DISPLAY_SECONDS_FOR_LIVE  – rolling sample window shown during recording.
// LIVE_COARSE_FACTOR            – stride multiplier; caps loop iterations to
//                                 chartW × factor (3–5 is ideal).
// MIN_DRAW_MS_LIVE              – minimum ms between canvas redraws (~60 FPS).
const MAX_DISPLAY_SECONDS_FOR_LIVE = 8;
const LIVE_COARSE_FACTOR = 4;
const MIN_DRAW_MS_LIVE = 16;
const BAR_HZ = 10;

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

/*
 * drawLiveWaveform — canvas renderer for the live-recording waveform.
 *
 * Performance strategy
 * ────────────────────
 * Rendering a raw 44.1 kHz buffer pixel-by-pixel inside an RAF loop causes
 * visible jank within the first few seconds of recording. Three techniques
 * keep it constant-cost regardless of how long the recording has been running:
 *
 *  1. Rolling window  – Only the last MAX_DISPLAY_SECONDS_FOR_LIVE seconds of
 *                       samples are fed to each draw call, bounding input size.
 *
 *  2. Coarse stride   – A stride of ceil(N / (chartW × LIVE_COARSE_FACTOR)) caps
 *                       examined samples to chartW × LIVE_COARSE_FACTOR, keeping
 *                       both the y-bounds scan and the bucket-aggregation loop
 *                       O(chartW) regardless of recording duration.
 *
 *  3. Single polygon  – One closed path (maxima left→right, minima right→left)
 *                       followed by a single fill() + stroke() replaces N separate
 *                       per-pixel stroke calls, minimising Canvas 2D state changes.
 *
 * topPtsRef / botPtsRef are reused Float64Arrays (reallocated only when chartW
 * changes), avoiding GC pressure inside the RAF loop.
 */
function drawLiveWaveform(
    canvas: HTMLCanvasElement,
    samples: Float32Array,
    sampleRate: number,
    yBoundsRef: { current: { min: number; max: number } | null },
    topPtsRef: { current: Float64Array | null },
    botPtsRef: { current: Float64Array | null },
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

    // Window to the most recent MAX_DISPLAY_SECONDS_FOR_LIVE seconds of samples.
    const maxDisplaySamples = Math.floor(MAX_DISPLAY_SECONDS_FOR_LIVE * sampleRate);
    const startIdx = Math.max(0, samples.length - maxDisplaySamples);
    const displaySamples = samples.subarray(startIdx);
    const duration = displaySamples.length / sampleRate;

    // LIVE_COARSE_FACTOR caps total loop iterations to chartW × LIVE_COARSE_FACTOR,
    // keeping per-frame CPU cost constant regardless of how many samples have accumulated.
    const stride = Math.max(1, Math.ceil(displaySamples.length / (chartW * LIVE_COARSE_FACTOR)));

    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < displaySamples.length; i += stride) {
        const v = displaySamples[i];
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = -1; yMax = 1; }

    const prev = yBoundsRef.current;
    if (!prev) {
        yBoundsRef.current = { min: yMin, max: yMax };
    } else {
        // Only expand stored bounds when the new extreme falls outside the current
        // bounds plus a 10% guard, reducing axis churn on small amplitude changes.
        const range = Math.max(prev.max - prev.min, 0.01);
        const pad = range * 0.1;
        if (yMin < prev.min - pad) prev.min = yMin;
        if (yMax > prev.max + pad) prev.max = yMax;
    }
    yMin = yBoundsRef.current!.min;
    yMax = yBoundsRef.current!.max;

    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yPad = Math.max((yMax - yMin) * 0.1, 0.05);
    yMin -= yPad;
    yMax += yPad;

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

    // Reuse pre-allocated pixel buffers; reallocate only when chartW changes.
    if (!topPtsRef.current || topPtsRef.current.length !== chartW) {
        topPtsRef.current = new Float64Array(chartW);
    }
    if (!botPtsRef.current || botPtsRef.current.length !== chartW) {
        botPtsRef.current = new Float64Array(chartW);
    }
    const topPts = topPtsRef.current;
    const botPts = botPtsRef.current;

    // Bucket aggregation: single O(N) pass — each sample lands in exactly one pixel column.
    topPts.fill(0); // amplitude hi per pixel (starts at 0 = center)
    botPts.fill(0); // amplitude lo per pixel (starts at 0 = center)
    for (let i = 0; i < displaySamples.length; i += stride) {
        const px = Math.min(chartW - 1, Math.floor((i / displaySamples.length) * chartW));
        const v = displaySamples[i];
        if (v > topPts[px]) topPts[px] = v;
        if (v < botPts[px]) botPts[px] = v;
    }
    // Convert amplitude values to canvas Y coordinates in place.
    for (let px = 0; px < chartW; px++) {
        topPts[px] = toY(topPts[px]);
        botPts[px] = toY(botPts[px]);
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
    const topPtsRef = React.useRef<Float64Array | null>(null);
    const botPtsRef = React.useRef<Float64Array | null>(null);
    const pendingRef = React.useRef<{ samples: Float32Array; sampleRate: number } | null>(null);
    const dirtyRef = React.useRef(false);
    const drawParamsRef = React.useRef({ theme, xLabel, yLabel });

    React.useEffect(() => {
        drawParamsRef.current = { theme, xLabel, yLabel };
    });

    React.useEffect(() => {
        yBoundsRef.current = null;
        topPtsRef.current = null;
        botPtsRef.current = null;
        pendingRef.current = null;
        dirtyRef.current = false;

        const unsub = audioRecordingBus.subscribe((rec) => {
            pendingRef.current = (rec && rec.samples.length > 0 && rec.sampleRate > 0)
                ? { samples: rec.samples, sampleRate: rec.sampleRate }
                : null;
            dirtyRef.current = true;
        }, busId);

        let rafId: number;
        let lastDrawTs = 0;
        const loop = (now: number) => {
            if (dirtyRef.current && now - lastDrawTs >= MIN_DRAW_MS_LIVE) {
                dirtyRef.current = false;
                lastDrawTs = now;
                const canvas = canvasRef.current;
                if (canvas) {
                    const data = pendingRef.current;
                    if (data) {
                        const { theme: t, xLabel: xl, yLabel: yl } = drawParamsRef.current;
                        drawLiveWaveform(canvas, data.samples, data.sampleRate, yBoundsRef, topPtsRef, botPtsRef, t, xl, yl);
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



// Reused across calls — never stored outside this function's return value.
let _stftMagBuf: Float32Array | null = null;

function getStftMagnitudesAtTime(stftFrame: AudioStftFrame, timeSec: number): Float32Array {
    const { timeBins, stftMatrix, frameSize } = stftFrame;
    const bins = frameSize / 2;
    let lo = 0;
    let hi = timeBins.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (timeBins[mid] < timeSec) lo = mid + 1; else hi = mid;
    }
    if (lo > 0 && Math.abs(timeBins[lo - 1] - timeSec) < Math.abs(timeBins[lo] - timeSec)) lo--;
    if (!_stftMagBuf || _stftMagBuf.length !== bins + 1) _stftMagBuf = new Float32Array(bins + 1);
    for (let b = 0; b <= bins; b++) {
        _stftMagBuf[b] = stftMatrix.get(b)?.[lo] ?? 1e-12;
    }
    return _stftMagBuf;
}

// HSL → RGB helper and pre-built color lookup table (computed once at module load).
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h * 12) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const SPECTROGRAM_COLORS = (() => {
    const table = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
        const intensity = i / 255;
        // intensity=0 → lightness 90% (pale = silence), intensity=1 → lightness 10% (dark = loud spike)
        const [r, g, b] = hslToRgb(120 / 360, 0.75, (90 - 80 * intensity) / 100);
        table[i * 3] = r; table[i * 3 + 1] = g; table[i * 3 + 2] = b;
    }
    return table;
})();


const StftHeatmapCanvas: React.FC<{
    stftFrame: AudioStftFrame;
    duration: number;
    busId: string;
    onSeek: (t: number) => void;
    viewStart: number;
    viewEnd: number;
    cutSelection: { start: number; end: number } | null;
    paddingLeft?: number;
    paddingRight?: number;
}> = ({ stftFrame, duration, busId, onSeek, viewStart, viewEnd, cutSelection, paddingLeft = 0, paddingRight = 0 }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    // Pre-rendered full spectrogram; zoomed view is a cheap drawImage crop.
    const offscreenRef = React.useRef<HTMLCanvasElement | null>(null);

    const currentTimeRef = React.useRef(0);
    const durationRef = React.useRef(duration);
    const viewStartRef = React.useRef(viewStart);
    const viewEndRef = React.useRef(viewEnd);
    const cutRef = React.useRef(cutSelection);
    const paddingLeftRef = React.useRef(paddingLeft);
    const paddingRightRef = React.useRef(paddingRight);

    React.useEffect(() => { durationRef.current = duration; }, [duration]);
    React.useEffect(() => { viewStartRef.current = viewStart; }, [viewStart]);
    React.useEffect(() => { viewEndRef.current = viewEnd; }, [viewEnd]);
    React.useEffect(() => { cutRef.current = cutSelection; }, [cutSelection]);
    React.useEffect(() => { paddingLeftRef.current = paddingLeft; }, [paddingLeft]);
    React.useEffect(() => { paddingRightRef.current = paddingRight; }, [paddingRight]);

    const draw = React.useCallback(() => {
        const canvas = canvasRef.current;
        const offCanvas = offscreenRef.current;
        if (!canvas || !offCanvas) return;
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

        const padL = paddingLeftRef.current;
        const padR = paddingRightRef.current;
        const chartW = Math.max(1, cssW - padL - padR);

        const vs = viewStartRef.current;
        const ve = viewEndRef.current;
        const dur = durationRef.current;
        const viewDuration = ve - vs;
        if (viewDuration <= 0 || dur <= 0) return;

        // The offscreen canvas represents [0, duration] (each frame placed at its
        // correct timeBins[fi] position), so a simple proportional crop suffices.
        const srcX = (vs / dur) * offCanvas.width;
        const srcW = Math.max(1, (viewDuration / dur) * offCanvas.width);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(offCanvas, srcX, 0, srcW, offCanvas.height, padL, 0, chartW, cssH);

        const toX = (t: number) => padL + ((t - vs) / viewDuration) * chartW;

        // Dim regions outside the cut selection and draw an amber border.
        const cut = cutRef.current;
        if (cut) {
            const cutX0 = Math.max(padL, toX(cut.start));
            const cutX1 = Math.min(padL + chartW, toX(cut.end));
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            if (cutX0 > padL) ctx.fillRect(padL, 0, cutX0 - padL, cssH);
            if (cutX1 < padL + chartW) ctx.fillRect(cutX1, 0, padL + chartW - cutX1, cssH);
            ctx.strokeStyle = "rgba(255,165,0,0.9)";
            ctx.lineWidth = 2;
            ctx.strokeRect(cutX0 + 1, 1, Math.max(0, cutX1 - cutX0 - 2), cssH - 2);
        }

        // Playhead
        const px = toX(currentTimeRef.current);
        if (px >= padL && px <= padL + chartW) {
            ctx.strokeStyle = "rgba(220,0,0,0.9)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, cssH);
            ctx.stroke();
        }
    }, []);

    // Build the full offscreen heatmap once per recording.
    // The canvas spans [0, duration]: each STFT frame is placed at the pixel that
    // corresponds to its center time (timeBins[fi] / duration * canvasWidth).
    // The extra `frameSize/hopSize` pixels widen the canvas to accommodate the
    // half-frame offset so the first/last frames land at the right positions
    // without leaving gaps between consecutive frames (frame spacing = 1 px).
    React.useEffect(() => {
        const { stftMatrix, timeBins, frameSize, hopSize } = stftFrame;
        const numFrames = timeBins.length;
        const dur = durationRef.current;

        // Extra width = frameSize/hopSize so that pixel spacing between consecutive
        // frames is exactly 1, with silence pixels padding both ends.
        const canvasWidth = Math.max(1, numFrames + Math.round(frameSize / hopSize));

        const frameMaxes = new Float32Array(numFrames);
        let gmax = 0;
        for (const arr of stftMatrix.values()) {
            for (let fi = 0; fi < arr.length; fi++) {
                if (arr[fi] > frameMaxes[fi]) frameMaxes[fi] = arr[fi];
            }
        }
        for (let i = 0; i < numFrames; i++) {
            if (frameMaxes[i] > gmax) gmax = frameMaxes[i];
        }

        const offCanvas = document.createElement("canvas");
        offCanvas.width = canvasWidth;
        offCanvas.height = 1;
        const offCtx = offCanvas.getContext("2d");
        if (!offCtx) return;

        const imgData = offCtx.createImageData(canvasWidth, 1);
        const data = imgData.data;

        // Fill all pixels with the silence color (level 0 = pale/bright, matching the no-data regions).
        for (let px = 0; px < canvasWidth; px++) {
            const idx = px * 4;
            data[idx] = SPECTROGRAM_COLORS[0];
            data[idx + 1] = SPECTROGRAM_COLORS[1];
            data[idx + 2] = SPECTROGRAM_COLORS[2];
            data[idx + 3] = 255;
        }

        // Place each STFT frame at its true time-proportional position.
        for (let fi = 0; fi < numFrames; fi++) {
            const px = dur > 0
                ? Math.min(canvasWidth - 1, Math.round((timeBins[fi] / dur) * canvasWidth))
                : fi;
            const level = gmax > 0 ? Math.min(255, Math.round((frameMaxes[fi] / gmax) * 255)) : 0;
            const ci = level * 3;
            const idx = px * 4;
            data[idx] = SPECTROGRAM_COLORS[ci];
            data[idx + 1] = SPECTROGRAM_COLORS[ci + 1];
            data[idx + 2] = SPECTROGRAM_COLORS[ci + 2];
            data[idx + 3] = 255;
        }

        offCtx.putImageData(imgData, 0, 0);
        offscreenRef.current = offCanvas;
        draw();
    }, [stftFrame, draw]);

    // Subscribe directly to the playback bus — no React re-render, just canvas update.
    React.useEffect(() => {
        return audioPlaybackBus.subscribe((pb) => {
            currentTimeRef.current = pb?.currentTime ?? 0;
            draw();
        }, busId);
    }, [busId, draw]);

    React.useEffect(() => { draw(); }, [draw, viewStart, viewEnd, cutSelection, paddingLeft, paddingRight]);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const observer = new ResizeObserver(() => draw());
        observer.observe(canvas);
        return () => observer.disconnect();
    }, [draw]);

    const handleClick = React.useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const padL = paddingLeftRef.current;
        const padR = paddingRightRef.current;
        const chartW = rect.width - padL - padR;
        const xRel = Math.max(0, Math.min(1, (e.clientX - rect.left - padL) / chartW));
        const clicked = viewStartRef.current + xRel * (viewEndRef.current - viewStartRef.current);
        onSeek(Math.max(0, Math.min(durationRef.current, clicked)));
    }, [onSeek]);

    return (
        <canvas
            ref={canvasRef}
            onClick={handleClick}
            title="Spectrogram — click to navigate"
            style={{ width: "100%", height: "100%", display: "block", cursor: "pointer" }}
        />
    );
};

const AudioAnalysisGraph: React.FC<{ busId?: string; label?: string; mode?: ViewMode; initialView?: ViewMode; enableToggle?: boolean }> = ({ busId = "main", label, mode, initialView = "time", enableToggle = false }) => {
    const { t } = useTranslation();
    const recording = useAudioRecording(busId);
    const fftFrame = useAudioFft(busId);
    const fftPeak = useAudioFftPeak(busId);
    const stftFrame = useAudioStft(busId);
    // When stftFrame is available (post-recording), it is the stable source for freq-view
    // rendering. Binding freqSource to stftFrame prevents fftFrame's 30fps updates from
    // flowing into freqData/freqYMax memos and triggering chart.update() during playback.
    const freqSource = stftFrame ?? fftFrame;

    const [viewState, setViewState] = React.useState<ViewMode>(initialView);
    const [interactionMode, setInteractionMode] = React.useState<InteractionMode>("zoom");
    const [cutSelection, setCutSelection] = React.useState<{ start: number; end: number } | null>(null);
    const [zoomWindow, setZoomWindow] = React.useState<{ start: number; end: number; fullMin: number; fullMax: number } | null>(null);
    const [autoTooltip, setAutoTooltip] = React.useState(false);
    const [chartPadding, setChartPadding] = React.useState<{ left: number; right: number }>({ left: 0, right: 0 });

    // Derived values needed both in render and in refs below.
    const graphView: ViewMode = enableToggle ? viewState : mode ?? "time";
    const isLiveRecording = !!recording && !recording.blob;
    const showLiveCanvas = isLiveRecording && graphView === "time";

    const chartRef = React.useRef<any>(null);
    const overlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const playheadTimeRef = React.useRef<number | null>(null);
    const zoomSyncRef = React.useRef<string>("");
    const suppressCutRef = React.useRef(false);
    const stftFrameRef = React.useRef<AudioStftFrame | undefined>(undefined);
    const maxFreqRef = React.useRef<number>(10000);
    // Kept in sync via useEffect so the direct bus subscription can read current values
    // without closing over stale props/state.
    const graphViewRef = React.useRef(graphView);
    const isLiveRecordingRef = React.useRef(isLiveRecording);
    // Refs for values needed inside subscription callbacks (avoid stale closures).
    const chartPaddingRef = React.useRef<{ left: number; right: number }>({ left: 0, right: 0 });
    const zoomWindowRef = React.useRef<{ start: number; end: number; fullMin: number; fullMax: number } | null>(null);
    const durationSecRef = React.useRef<number | undefined>(undefined);

    React.useEffect(() => {
        if (enableToggle) {
            setViewState(initialView);
        }
    }, [enableToggle, initialView]);

    React.useEffect(() => { graphViewRef.current = graphView; }, [graphView]);
    React.useEffect(() => { isLiveRecordingRef.current = isLiveRecording; }, [isLiveRecording]);

    // Draw the playhead on the overlay canvas (reads only refs — safe to call from anywhere).
    const drawPlayheadOverlay = React.useCallback(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssH * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        const currentTime = playheadTimeRef.current;
        if (currentTime == null) return;
        const pad = chartPaddingRef.current;
        const zw = zoomWindowRef.current;
        const dur = durationSecRef.current ?? 0;
        const xMin = zw?.start ?? 0;
        const xMax = zw?.end ?? dur;
        if (xMax <= xMin) return;
        const chartLeft = pad.left;
        const chartRight = cssW - pad.right;
        if (chartRight <= chartLeft) return;
        const x = chartLeft + (currentTime - xMin) / (xMax - xMin) * (chartRight - chartLeft);
        if (x < chartLeft || x > chartRight) return;
        ctx.beginPath();
        ctx.moveTo(x, PAD_TOP);
        ctx.lineTo(x, cssH - PAD_BOTTOM);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(220,0,0,0.9)";
        ctx.stroke();
    }, []);

    // Subscription: update playhead overlay at 60fps without touching the Chart.js canvas.
    React.useEffect(() => {
        return audioPlaybackBus.subscribe((pb) => {
            playheadTimeRef.current = pb?.currentTime ?? null;
            if (graphViewRef.current === "time" && !isLiveRecordingRef.current) {
                drawPlayheadOverlay();
            }
        }, busId);
    }, [busId, drawPlayheadOverlay]);

    React.useEffect(() => {
        chartRef.current?.resetZoom?.();
        setCutSelection(null);
        setZoomWindow(null);
    }, [graphView, recording?.blob]);

    const chartAreaPlugin = React.useMemo<any>(() => ({
        id: `chartArea-${busId}`,
        afterLayout: (chart: any) => {
            const { left, right } = chart.chartArea;
            const cssRight = chart.canvas.clientWidth - right;
            const p = { left, right: cssRight };
            chartPaddingRef.current = p;
            setChartPadding(p);
            // Redraw playhead whenever chart layout changes (resize, zoom, initial render).
            drawPlayheadOverlay();
        },
    }), [busId, drawPlayheadOverlay]);

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
    zoomWindowRef.current = zoomWindow;
    durationSecRef.current = durationSec;

    const handleSeek = React.useCallback((timeSec: number) => {
        const dur = durationSec ?? 0;
        audioPlaybackBus.publish({ currentTime: Math.max(0, Math.min(dur, timeSec)), duration: dur, playing: false }, busId);
    }, [busId, durationSec]);

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
    }, [durationSec, graphView, interactionMode, syncZoomWindow]);

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
        // fftPeak is computed from the full recording at the same FFT size used for live
        // bar display (DEFAULT_FFT_SIZE), so it is the correct y-axis ceiling.
        if (fftPeak && fftPeak > 0) return fftPeak * 1.1;
        // Fallback when fftPeak is not yet available.
        if (!freqSource) return 1;
        if ("stftMatrix" in freqSource) {
            let peak = 0;
            for (const mags of freqSource.stftMatrix.values()) {
                for (let i = 0; i < mags.length; i++) { if (mags[i] > peak) peak = mags[i]; }
            }
            return (peak > 0 ? peak : 1) * 1.1;
        }
        if (freqSource.magnitudes.length === 0) return 1;
        let frameMax = 0;
        for (let i = 0; i < freqSource.magnitudes.length; i++) {
            if (freqSource.magnitudes[i] > frameMax) frameMax = freqSource.magnitudes[i];
        }
        return (frameMax > 0 ? frameMax : 1) * 1.1;
    }, [freqSource, fftPeak]);

    const maxFreq = React.useMemo(() => {
        if (stftFrame) {
            const derived = deriveMaxFrequency(stftFrame);
            if (derived != null && derived > 0) return derived * 1.05;
        }
        return 10000;
    }, [stftFrame]);

    stftFrameRef.current = stftFrame;
    maxFreqRef.current = maxFreq;

    const freqData = React.useMemo<ChartDataProps | undefined>(() => {
        if (!freqSource) return undefined;

        let magnitudes: Float32Array;
        let frequencies: Float32Array;
        let sampleRate: number;

        if ("stftMatrix" in freqSource) {
            magnitudes = getStftMagnitudesAtTime(freqSource, freqSource.timeBins[0] ?? 0);
            frequencies = freqSource.frequencies;
            sampleRate = freqSource.sampleRate;
        } else {
            magnitudes = freqSource.magnitudes;
            frequencies = freqSource.frequencies;
            sampleRate = freqSource.sampleRate;
        }

        if (magnitudes.length === 0) return undefined;
        const nyquist = sampleRate / 2;
        const binHz = frequencies.length > 1 ? frequencies[1] : 1;
        const numBars = Math.floor(maxFreq / BAR_HZ);
        const pts: Point[] = [];
        const colors: string[] = [];
        for (let bar = 0; bar < numBars; bar++) {
            const freqStart = bar * BAR_HZ;
            const iStart = Math.max(0, Math.round(freqStart / binHz));
            const iEnd = Math.min(magnitudes.length - 1, Math.max(iStart, Math.round((freqStart + BAR_HZ) / binHz) - 1));
            if (iStart >= magnitudes.length) break;
            let maxMag = 0;
            for (let i = iStart; i <= iEnd; i++) {
                if (magnitudes[i] > maxMag) maxMag = magnitudes[i];
            }
            const centerFreq = freqStart + BAR_HZ / 2;
            pts.push({ x: centerFreq, y: maxMag });
            const hue = Math.max(0, Math.min(120, (centerFreq / Math.min(nyquist, maxFreq)) * 120));
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
    }, [freqSource, maxFreq, label, t]);

    React.useEffect(() => {
        if (graphView !== "freq") return;

        const updateBars = (magnitudes: ArrayLike<number>, barCount: number) => {
            const chart = chartRef.current;
            if (!chart) return;
            const meta = chart.getDatasetMeta(0);
            const yScale = (chart.scales as any)?.y;
            if (!meta?.data?.length || !yScale) return;
            const yMin = yScale.min as number;
            const yRange = ((yScale.max as number) - yMin) || 1;
            const yBottom = yScale.bottom as number;
            const yPixelRange = yBottom - (yScale.top as number);
            const parsed = (meta as any)._parsed as Array<{ x: number; y: number }> | undefined;
            const count = Math.min(barCount, meta.data.length);
            for (let bar = 0; bar < count; bar++) {
                const maxMag = magnitudes[bar];
                const el = meta.data[bar] as any;
                el.y = yBottom - ((maxMag - yMin) / yRange) * yPixelRange;
                el.height = yBottom - el.y;
                if (parsed?.[bar]) parsed[bar].y = maxMag;
            }
            chart.draw();
        };

        // Post-recording: use fine-hop STFT barData precomputed in the worker.
        // One array lookup + binary search replaces per-frame FFT computation.
        if (stftFrame?.barData?.length && stftFrame.barNumBars && stftFrame.barNumFrames && stftFrame.barTimeBins?.length) {
            const { barData, barTimeBins, barNumBars, barNumFrames } = stftFrame;
            return audioPlaybackBus.subscribe((pb) => {
                const timeSec = pb?.currentTime ?? 0;
                let lo = 0, hi = barNumFrames - 1;
                while (lo < hi) {
                    const mid = (lo + hi) >> 1;
                    if (barTimeBins[mid] < timeSec) lo = mid + 1; else hi = mid;
                }
                if (lo > 0 && Math.abs(barTimeBins[lo - 1] - timeSec) < Math.abs(barTimeBins[lo] - timeSec)) lo--;
                // barData view starting at this frame
                const frameSlice = barData.subarray(lo * barNumBars, lo * barNumBars + barNumBars);
                updateBars(frameSlice, barNumBars);
            }, busId);
        }

        // Fallback: live FFT (during recording or before STFT finishes computing).
        // Pre-allocate bar buffer outside the callback to avoid GC pressure at 60fps.
        const fftBarBuf = new Float32Array(Math.ceil(22050 / BAR_HZ));
        return audioFftBus.subscribe((fftFrame) => {
            if (!fftFrame) return;
            const { magnitudes, frequencies } = fftFrame;
            const binHz = frequencies.length > 1 ? frequencies[1] : 1;
            const numBars = Math.floor(maxFreqRef.current / BAR_HZ);
            for (let bar = 0; bar < numBars; bar++) {
                const freqStart = bar * BAR_HZ;
                const iStart = Math.max(0, Math.round(freqStart / binHz));
                const iEnd = Math.min(magnitudes.length - 1, Math.max(iStart, Math.round((freqStart + BAR_HZ) / binHz) - 1));
                let maxMag = 0;
                for (let i = iStart; i <= iEnd; i++) {
                    if (magnitudes[i] > maxMag) maxMag = magnitudes[i];
                }
                fftBarBuf[bar] = maxMag;
            }
            updateBars(fftBarBuf, numBars);
        }, busId);
    }, [graphView, busId, stftFrame]);

    const freqOptions = React.useMemo<ChartOptions<"bar" | "line">>(() => ({
        animation: false,
        plugins: {
            legend: { display: false },
            zoom: {
                limits: { x: { min: 0, max: maxFreq, minRange: 20 } },
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
                },
            },
        },
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
    const graphPlugins = React.useMemo(() => [chartAreaPlugin], [chartAreaPlugin]);

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
            {graphView === "freq" && !isLiveRecording && (
                <Button size="small" variant="outlined" onClick={handleResetZoom}>
                    {t("experiments.audioAnalysis.components.graph.resetZoom", "Reset")}
                </Button>
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
            ) : (
                <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
                    {activeData ? (
                        <Graph
                            key={`${busId}-${graphView}`}
                            data={activeData}
                            options={activeOptions}
                            plugins={graphPlugins}
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
                    {graphView === "time" && (
                        <canvas
                            ref={overlayCanvasRef}
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                        />
                    )}
                </Box>
            )}

            {!isLiveRecording && stftFrame && durationSec && mode !== "freq" && (
                <Box sx={{ height: 80, flexShrink: 0 }}>
                    <StftHeatmapCanvas
                        stftFrame={stftFrame}
                        duration={durationSec}
                        busId={busId}
                        onSeek={handleSeek}
                        viewStart={zoomWindow?.start ?? 0}
                        viewEnd={zoomWindow?.end ?? durationSec}
                        cutSelection={cutSelection}
                        paddingLeft={chartPadding.left}
                        paddingRight={chartPadding.right}
                    />
                </Box>
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

