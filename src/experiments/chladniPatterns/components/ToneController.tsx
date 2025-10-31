import React from "react";
import ToneGenerator from "./ToneGenerator";
import { audioSignalBus } from "../state/audioSignalBus";
import type { ChartDataProps } from "../../../components/Graph";

type Props = {
    onOscillogram?: (data: ChartDataProps | undefined) => void;
};

const ToneController: React.FC<Props> = ({ onOscillogram }) => {
    const handleOscillogram = React.useCallback((data?: ChartDataProps) => {
        audioSignalBus.publish(data);
        onOscillogram?.(data);
    }, [onOscillogram]);

    return <ToneGenerator onOscillogram={handleOscillogram} />;
};

export default ToneController;