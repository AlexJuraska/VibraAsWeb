import type React from "react";

import HomeButton from "../../components/HomeButton";
import BasicPanel from "../../components/BasicPanel";
import CollapsiblePanel from "../../components/CollapsiblePanel";
import ColorBlock from "../../components/ColorBlock";

import {
    OscillogramGraph,
    GainSlider,
    ToneController,
    StartStopButton,
    AudioOutputDeviceSelector,
    SavedFrequencyDropdown,
} from "../../experiments/chladniPatterns/components";

export const componentMap = {
    HomeButton,
    BasicPanel,
    CollapsiblePanel,
    ColorBlock,

    OscillogramGraph,
    GainSlider,
    ToneController,
    StartStopButton,
    AudioOutputDeviceSelector,
    SavedFrequencyDropdown,
};

export type ComponentMap = Record<string, React.ComponentType<any>>;