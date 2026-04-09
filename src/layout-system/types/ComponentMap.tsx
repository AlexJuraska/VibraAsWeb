import type React from "react";

import HomeButton from "../../components/HomeButton";
import BasicPanel from "../../components/BasicPanel";
import CollapsiblePanel from "../../components/CollapsiblePanel";
import ColorBlock from "../../components/ColorBlock";
import DividerLine from "../../components/DividerLine";

import {
    OscillogramGraph,
    GainSlider,
    ToneController,
    StartStopButton,
    AudioOutputDeviceSelector,
    SavedFrequencyDropdown,
} from "../../experiments/chladniPatterns/components";
import { AudioFileUploader, AudioInputDeviceSelector, AudioRecordButton, AudioRecordingDebug, AudioRecordingGraph, AudioControlsPanel, AudioFrequencyGenerator } from "../../experiments/audioAnalysis/components";

export const componentMap = {
    HomeButton,
    BasicPanel,
    CollapsiblePanel,
    ColorBlock,
    DividerLine,

    OscillogramGraph,
    GainSlider,
    ToneController,
    StartStopButton,
    AudioOutputDeviceSelector,
    SavedFrequencyDropdown,
    AudioFileUploader,
    AudioInputDeviceSelector,
    AudioRecordButton,
    AudioRecordingDebug,
    AudioRecordingGraph,
    AudioControlsPanel,
    AudioFrequencyGenerator,
};

export type ComponentMap = Record<string, React.ComponentType<any>>;