import type React from "react";

import HomeButton from "../../components/HomeButton";
import BasicPanel from "../../components/BasicPanel";
import CollapsiblePanel from "../../components/CollapsiblePanel";
import ColorBlock from "../../components/ColorBlock";
import {TestSidebar} from "../../components/TestSidebar";

import {
    OscillogramGraph,
    GainSlider,
    ToneController,
    StartStopButton,
    AudioOutputDeviceSelector,
    SavedFrequencyDropdown,
} from "../../experiments/chladniPatterns/components";
import { AudioInputDeviceSelector, AudioRecordButton, AudioRecordingDebug, AudioRecordingGraph } from "../../experiments/audioAnalysis/components";

export const componentMap = {
    HomeButton,
    BasicPanel,
    CollapsiblePanel,
    ColorBlock,
    TestSidebar,

    OscillogramGraph,
    GainSlider,
    ToneController,
    StartStopButton,
    AudioOutputDeviceSelector,
    SavedFrequencyDropdown,
    AudioInputDeviceSelector,
    AudioRecordButton,
    AudioRecordingDebug,
    AudioRecordingGraph,
};

export type ComponentMap = Record<string, React.ComponentType<any>>;