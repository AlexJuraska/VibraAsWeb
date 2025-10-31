import React from "react";
import Graph from "../components/Graph";
import ColorBlock from "../components/ColorBlock";
import CollapsiblePanel from "../components/CollapsiblePanel";
import ToneGenerator from "../experiments/chladniPatterns/components/ToneGenerator";
import ToneController from "../experiments/chladniPatterns/components/ToneController";
import OscillogramGraph from "../experiments/chladniPatterns/components/OscillogramGraph";

export type ComponentRegistry = Record<string, React.ComponentType<any>>;

export const componentRegistry: ComponentRegistry = {
    ColorBlock,
    CollapsiblePanel,
    Graph,
    ToneGenerator,
    ToneController,
    OscillogramGraph,
};