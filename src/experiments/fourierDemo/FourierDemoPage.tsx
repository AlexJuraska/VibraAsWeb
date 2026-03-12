import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import Graph, { Dataset, Point } from "../../components/Graph";
import { usePageTitle } from "../../hooks/usePageTitle";
import type { ChartOptions } from "chart.js";

const LIVE_FFT_SIZE = 2048;
const MAX_SAMPLES = 2048;

const hannWindow = (input: Float32Array): Float32Array => {
    const N = input.length;
    const out = new Float32Array(N);
    for (let n = 0; n < N; n++) {
        out[n] = input[n] * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)));
    }
    return out;
};

const computeSpectrum = (buffer: Float32Array, sampleRate: number): Point[] => {
    const N = Math.min(buffer.length, MAX_SAMPLES);
    if (!sampleRate || N <= 1) return [];

    const windowed = hannWindow(buffer.slice(0, N));
    const half = Math.floor(N / 2);
    const points: Point[] = [];

    for (let k = 0; k < half; k++) {
        let real = 0;
        let imag = 0;
        for (let n = 0; n < N; n++) {
            const angle = (2 * Math.PI * k * n) / N;
            real += windowed[n] * Math.cos(angle);
            imag -= windowed[n] * Math.sin(angle);
        }
        const magnitude = Math.sqrt(real * real + imag * imag) / N;
        points.push({ x: (k * sampleRate) / N, y: magnitude });
    }

    return points;
};

const buildWaveformPoints = (buffer: Float32Array, sampleRate: number): Point[] => {
    const N = Math.min(buffer.length, MAX_SAMPLES);
    if (!sampleRate || N === 0) return [];
    const trimmed = buffer.slice(0, N);
    const points: Point[] = new Array(N);
    for (let i = 0; i < N; i++) {
        points[i] = { x: i / sampleRate, y: trimmed[i] };
    }
    return points;
};

/* ─── Live canvas component ─── */
const LiveCanvas: React.FC<{ analyserRef: React.RefObject<AnalyserNode | null> }> = ({ analyserRef }) => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const rafRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        const draw = () => {
            const analyser = analyserRef.current;
            const canvas = canvasRef.current;
            if (!analyser || !canvas) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }
            const ctx = canvas.getContext("2d");
            if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

            const buffer = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(buffer);

            const w = canvas.width;
            const h = canvas.height;
            const mid = h / 2;

            ctx.clearRect(0, 0, w, h);

            // grid
            ctx.strokeStyle = "#e0e0e0";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, mid); ctx.lineTo(w, mid);
            ctx.stroke();

            // waveform
            ctx.strokeStyle = "#4caf50";
            ctx.lineWidth = 2;
            ctx.beginPath();

            const len = buffer.length;
            // find first positive zero-crossing to stabilize phase
            let start = 0;
            for (let i = 1; i < len; i++) {
                if (buffer[i - 1] <= 0 && buffer[i] > 0) {
                    start = i;
                    break;
                }
            }
            const samplesToShow = Math.min(len - start, len);

            for (let i = 0; i < samplesToShow; i++) {
                const x = (i / samplesToShow) * w;
                const y = mid - buffer[start + i] * mid; // -1..1 mapped to 0..h
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [analyserRef]);

    return (
        <canvas
            ref={canvasRef}
            width={1200}
            height={360}
            style={{ width: "100%", height: 360, border: "1px solid #e0e0e0", borderRadius: 4 }}
        />
    );
};

export const FourierDemoPage: React.FC = () => {
    const [waveform, setWaveform] = React.useState<Point[]>([]);
    const [spectrum, setSpectrum] = React.useState<Point[]>([]);
    const [status, setStatus] = React.useState<string>("Load a WAV file or generate a sample");
    const [sampleInfo, setSampleInfo] = React.useState<string>("");
    const [micStatus, setMicStatus] = React.useState<string>("Mic idle");
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const liveAudioCtx = React.useRef<AudioContext | null>(null);
    const liveAnalyser = React.useRef<AnalyserNode | null>(null);
    const liveStream = React.useRef<MediaStream | null>(null);

    usePageTitle("Fourier Demo", "Fourier Demo");

    const handleBuffer = React.useCallback((data: Float32Array, sampleRate: number, label: string) => {
        setWaveform(buildWaveformPoints(data, sampleRate));
        setSpectrum(computeSpectrum(data, sampleRate));
        setSampleInfo(`${label} — ${sampleRate} Hz, ${Math.min(data.length, MAX_SAMPLES)} samples`);
        setStatus("Analysis ready");
    }, []);

    const handleGenerateClick = () => {
        const sampleRate = 44100;
        const length = sampleRate;
        const buffer = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            buffer[i] = 0.6 * Math.sin(2 * Math.PI * 440 * t) + 0.35 * Math.sin(2 * Math.PI * 880 * t);
        }
        handleBuffer(buffer, sampleRate, "Synthetic 440/880 Hz");
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setStatus(`Loading ${file.name}…`);
        let audioCtx: AudioContext | null = null;
        try {
            const arrayBuffer = await file.arrayBuffer();
            audioCtx = new AudioContext();
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            const channel = decoded.getChannelData(0);
            handleBuffer(channel, decoded.sampleRate, file.name);
            setStatus("Analysis ready");
        } catch (err) {
            console.error(err);
            setStatus("Could not read that file. Make sure it is a WAV file.");
        } finally {
            if (audioCtx) await audioCtx.close();
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const stopLive = React.useCallback(async () => {
        liveAnalyser.current = null;
        if (liveAudioCtx.current) {
            await liveAudioCtx.current.close();
            liveAudioCtx.current = null;
        }
        liveStream.current?.getTracks().forEach((t) => t.stop());
        liveStream.current = null;
        setMicStatus("Mic idle");
    }, []);

    const startLive = React.useCallback(async () => {
        try {
            await stopLive();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioCtx = new AudioContext();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = LIVE_FFT_SIZE;
            analyser.smoothingTimeConstant = 0;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            liveAudioCtx.current = audioCtx;
            liveAnalyser.current = analyser;
            liveStream.current = stream;
            setMicStatus(`Mic live — ${audioCtx.sampleRate} Hz`);
        } catch (err) {
            console.error(err);
            setMicStatus("Mic unavailable or permission denied");
            await stopLive();
        }
    }, [stopLive]);

    React.useEffect(() => {
        return () => { stopLive(); };
    }, [stopLive]);

    const waveformDataset: Dataset[] = waveform.length
        ? [{ label: "Waveform", data: waveform, pointRadius: 0, type: "line" }]
        : [];
    const spectrumDataset: Dataset[] = spectrum.length
        ? [{ label: "Magnitude", data: spectrum, pointRadius: 0, type: "line" }]
        : [];

    const waveformOptions = React.useMemo<ChartOptions<"line">>(() => {
        const xMin = waveform[0]?.x;
        const xMax = waveform[waveform.length - 1]?.x;
        return {
            parsing: false as const,
            animation: false,
            scales: {
                x: { type: "linear" as const, title: { display: true, text: "Time (s)" }, min: xMin, max: xMax },
                y: { type: "linear" as const, title: { display: true, text: "Amplitude" } }
            }
        };
    }, [waveform]);

    const spectrumOptions = React.useMemo<ChartOptions<"line">>(() => ({
        parsing: false as const,
        animation: false,
        scales: {
            x: { type: "linear" as const, title: { display: true, text: "Frequency (Hz)" } },
            y: { type: "linear" as const, title: { display: true, text: "Magnitude" } }
        }
    }), []);

    return (
        <Box p={3} display="flex" flexDirection="column" gap={3}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
                <Button variant="contained" onClick={handleGenerateClick}>
                    Generate sine (440 Hz)
                </Button>
                <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
                    Load WAV
                </Button>
                <Button variant="outlined" color="success" onClick={startLive}>
                    Start mic
                </Button>
                <Button variant="outlined" color="error" onClick={stopLive}>
                    Stop mic
                </Button>
                <input
                    type="file"
                    accept="audio/wav,.wav"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                />
            </Stack>

            <Typography variant="body2" color="text.secondary">{status}</Typography>
            {sampleInfo && (
                <Typography variant="body2" color="text.secondary">{sampleInfo}</Typography>
            )}
            <Typography variant="body2" color="text.secondary">{micStatus}</Typography>

            <Box display="grid" gap={3}>
                <Box>
                    <Typography variant="h6" gutterBottom>Time domain</Typography>
                    <Graph
                        data={waveformDataset.length ? { datasets: waveformDataset } : undefined}
                        options={waveformOptions}
                    />
                </Box>
                <Box>
                    <Typography variant="h6" gutterBottom>Live microphone</Typography>
                    <LiveCanvas analyserRef={liveAnalyser} />
                </Box>
                <Box>
                    <Typography variant="h6" gutterBottom>Frequency domain (FFT)</Typography>
                    <Graph
                        data={spectrumDataset.length ? { datasets: spectrumDataset } : undefined}
                        options={spectrumOptions}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default FourierDemoPage;

