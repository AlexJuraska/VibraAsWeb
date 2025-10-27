import React from "react";
import config from "../../configs/chladniPatternsLayout.json";
import {LayoutRenderer} from "../../layout-system/LayoutRenderer";

export default function TestLayoutPage() {
    return <LayoutRenderer config={config} />;
}
