# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VibraAS** is a React + TypeScript web application for audio visualization and analysis. The application provides multiple "experiments" for exploring audio signals through Fourier analysis, spectrograms, and pattern visualization. The codebase is built with Vite, Material-UI, and Chart.js.

### Key Technology Stack
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 8.0.5 (dev server on port 3000)
- **UI Library**: Material-UI v7 with responsive fluid typography
- **Audio Analysis**: fft.js for FFT computation, Web Audio API for recording/playback
- **Charting**: Chart.js 4 with zoom plugin for interactive graphs
- **Routing**: React Router v7
- **Internationalization**: Custom i18n system supporting English, Slovak, Czech

## Build and Development Commands

```bash
npm run dev       # Start development server (http://localhost:3000)
npm run start     # Alias for dev
npm run build     # Build for production
npm run preview   # Preview production build locally
```

**Note**: The vite.config.ts has a @ts-ignore on the React plugin import. This is intentional and safe to leave as-is.

## Project Architecture

### Core Directory Structure

```
src/
├── App.tsx                          # Main router with lazy-loaded experiments
├── index.tsx                        # Entry point with providers
├── theme.tsx                        # Fluid typography MUI theme
├── pages/                           # Page-level components (Home, NotFound)
├── components/                      # Shared UI components
├── experiments/                     # Feature modules
│   ├── chladniPatterns/            # Chladni patterns experiment
│   ├── laserVibrometer/            # Laser vibrometer (partial)
│   ├── audioAnalysis/              # Core audio analysis
│   └── automaticAudioAnalysis/     # Sweep-based analysis
├── layout-system/                  # Dynamic layout composition
├── configs/                        # JSON layout configurations
├── hooks/                          # Custom React hooks
├── i18n/                           # Translation system
├── utils/                          # Helper utilities
└── types/                          # Global TypeScript definitions
```

### State Management: The Bus Pattern

Instead of Redux/Context, the app uses **custom pub/sub "bus" singletons** for audio state. Each bus manages one aspect:

**audioRecordingBus**
- Holds: `{ samples: Float32Array, sampleRate, duration, blob? }`
- Published by: AudioRecordButton, AudioFileUploader, cut operations
- Subscribed by: FFT/STFT buses for auto-analysis

**audioPlaybackBus**
- Holds: `{ currentTime, duration, playing }`
- Published by: AudioPlayer, graph seek actions
- Used for: Playhead sync, real-time frame analysis

**audioFftBus**
- Computes frame-by-frame FFT at current playback time
- Applies Hann windowing + fft.js real transform
- Caches FFT instances per size for performance
- Publishes `AudioFftFrame { magnitudes, frequencies, fftSize, sampleRate }`

**audioStftBus**
- Computes full spectrogram (FFT across all time frames) when recording finishes
- Outputs 2D matrix: `Map<freqBinIdx → Float32Array(magnitudes over time)>`
- Performs spike detection (statistical 3-sigma thresholding for resonant peaks)
- Auto-scales frequency axis based on signal content

**audioInputDeviceBus / audioOutputDeviceBus**
- Microphone and speaker device selection

**Bus files**: `src/experiments/audioAnalysis/state/*.tsx`

Each bus exports:
- `.publish()` and `.subscribe()` methods
- Custom hook (`useAudioFft`, `useAudioStft`, etc.) that auto-subscribes on mount

### Layout System

Layouts are **JSON-defined component containers** with responsive breakpoints. Two engines exist:

**GridLayout** (CSS Grid based)
- Uses named template areas
- Per-breakpoint grid variants (xs, sm, md, lg, xl)
- Used by: Chladni Patterns, Laser Vibrometer
- File: `src/layout-system/layouts/GridLayout.tsx`

**SlideLayout** (Slide-out panels)
- Collapsible side/top/bottom panels
- Used by: Audio Analysis experiments
- File: `src/layout-system/layouts/SlideLayout.tsx`

**Configuration files** (`src/configs/`):
- `audioAnalysisLayout.json` / `audioAnalysisLayoutDual.json`
- `automaticAudioAnalysisLayout.json` / `automaticAudioAnalysisLayoutDual.json`
- `chladniPatternsLayout.json`
- `laserVibrometerLayout.json`

**ComponentMap** (`src/layout-system/types/ComponentMap.tsx`)
- Registry mapping string names in JSON configs to React components
- All custom components must be registered here to be usable in layouts

### Audio Analysis Pipeline

#### FFT (Frame Analysis)
1. Takes audio recording from audioRecordingBus
2. Extracts centered 2048-sample window around current playback time
3. Applies Hann window to reduce spectral leakage
4. Computes real FFT using fft.js
5. Normalizes by window gain and frame size
6. Output: `AudioFftFrame { magnitudes, frequencies, fftSize, sampleRate }`

#### STFT (Spectrogram)
1. Triggered when recording finishes (has blob)
2. Frame size auto-tuned to achieve ~2 Hz bin resolution
3. Hop size = frame/4 (minimum 1024 samples) for time resolution
4. Sliding window: each frame is windowed, FFT'd, normalized
5. Outputs 2D magnitude matrix: `Map<freqBinIdx → [mag@t0, mag@t1, ...]>`
6. Spike detection flags peaks at bins with coefficient of variation ≥ 0.5 and magnitude ≥ mean + 3σ
7. `deriveMaxFrequency()` finds highest bin with ≥5% of global peak for axis auto-scaling

#### Heatmap Rendering
- **StftHeatmapCanvas** in `AudioAnalysisGraph.tsx`
- Pre-renders spectrogram to offscreen 1px-wide canvas (one pixel = one time frame)
- Uses HSL-to-RGB lookup table for smooth orange gradient coloring
- Pixel value = max magnitude across all frequency bins at that time
- Supports zoom/pan by cropping pre-rendered image
- Shows playhead and cut-selection overlay
- Clickable for seeking

#### Live Waveform Canvas
- **LiveWaveformCanvas** in `AudioAnalysisGraph.tsx`
- Rolling 8-second window during recording
- Coarse stride sampling to keep CPU cost constant
- Min/max bucket aggregation for visual fidelity
- Reuses Float64Arrays to minimize garbage collection

### Key Components

**Audio Input/Output**:
- `AudioRecordButton` - Web Audio API + AudioWorklet recording
- `AudioFileUploader` - Loads and converts audio files
- `AudioPlayer` - HTML5 audio with seek sync
- `AudioInputDeviceSelector` - Microphone picker
- `AudioFrequencyGenerator` - Test tone generator

**Analysis**:
- `AudioAnalysisGraph` - Main waveform + FFT display with zoom/cut tools
- `AudioAnalysisPage` - Wrapper managing single/dual layout toggle
- `StftHeatmapCanvas` - Spectrogram visualization
- `LiveWaveformCanvas` - Real-time recording visualization

**Experiments**:
- `ChladniPatternsPage` - GridLayout for tone control + visualization
- `AudioAnalysisPage` - SlideLayout for flexible analysis
- `AutomaticAudioAnalysisPage` - SlideLayout for sweep recording

### Data Flow Example

1. User clicks AudioRecordButton
2. AudioWorklet accumulates samples, publishes batch every 50ms to audioRecordingBus
3. LiveWaveformCanvas renders rolling window in real-time
4. audioFftBus auto-computes frame-by-frame FFT on new recording data
5. Graph updates freq-domain visualization
6. On stop: audioStftBus computes full spectrogram + pre-renders heatmap
7. During playback:
   - AudioPlayer publishes currentTime to audioPlaybackBus
   - audioFftBus RAF loop requests frames at playback position
   - Graph playhead and heatmap cursor sync in real-time

## Important Patterns

### Responsive Design
- Material-UI `useMediaQuery()` with theme breakpoints
- Fluid typography via CSS `clamp()` (see `theme.tsx`)
- Layout variants per breakpoint (xs, sm, md, lg, xl)

### Web Audio API
- AudioWorklet code embedded as string, compiled at runtime
- `pureMicConstraints()` in utils enforces safe microphone constraints
- FFT sizes always powers of 2; auto-adjusted per sample rate

### Internationalization
- Keys use dot notation (e.g., `"home.experiment_chladni"`)
- Translations in `src/i18n/{en,sk,cz}.json`
- Fallback to English if key missing
- Use `useTranslation()` hook in components

### Canvas Rendering
- Always call `setTransform(dpr, 0, 0, dpr, 0, 0)` for device pixel ratio
- Pre-allocate TypedArrays and reuse them
- Use ResizeObserver for responsive redraw

## File Conventions

- `.tsx` - React components
- `.ts` - Pure TypeScript (utils, types, bus logic)
- `.json` - Configuration (layouts, translations)
- `state/*.tsx` - Bus pub/sub modules with hooks
- `components/index.tsx` - Barrel exports

## Debugging Tips

- **Layout**: Verify zone names in JSON configs match keys in ComponentMap; zone name mismatches fail silently
- **FFT/STFT**: Log `audioFftBus.get()` and `audioStftBus.get()` to inspect current frames
- **Performance**: Target 30 FPS RAF loop during recording; pre-allocate TypedArrays rather than allocating inside RAF callbacks
