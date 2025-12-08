import React from "react";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { getGain, publishGain, subscribeGain } from "../state/gainBus";

type GainSliderProps = {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    disabled?: boolean;
    onChange?: (value: number) => void;
    format?: (v: number) => string;
};

const GainSlider: React.FC<GainSliderProps> = ({
                                                   value,
                                                   min = 0,
                                                   max = 0.5,
                                                   step = 0.01,
                                                   label = "Gain",
                                                   disabled = false,
                                                   onChange,
                                                   format = (v) => (Number.isFinite(v) ? v.toFixed(2) : "0.00"),
                                               }) => {
    const [busVal, setBusVal] = React.useState<number>(() => getGain());

    React.useEffect(() => {
        if (value !== undefined) return;
        const unsub = subscribeGain(setBusVal);
        return unsub;
    }, [value]);

    const displayValue = typeof value === "number" ? value : busVal;

    const handleChange = (_: Event, v: number | number[]) => {
        const next = Array.isArray(v) ? (v[0] as number) : (v as number);
        onChange?.(next);
        publishGain(next);
    };

    return (
        <Box>
            <Typography variant="body2" color="textSecondary" >
                {label}: {format(displayValue)}
            </Typography>
            <Slider
                value={displayValue}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                onChange={handleChange}
                getAriaValueText={(v) => format(v as number)}
                aria-label={label}
            />
        </Box>
    );
};

export default GainSlider;
