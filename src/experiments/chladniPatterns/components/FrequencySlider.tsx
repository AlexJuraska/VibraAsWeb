import React from "react";
import { Box, Slider, Typography } from "@mui/material";

type FrequencySliderProps = {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    disabled?: boolean;
    format?: (v: number) => string;
    onChange: (value: number) => void;
};

const FrequencySlider: React.FC<FrequencySliderProps> = ({
                                                             value,
                                                             min = 80,
                                                             max = 2000,
                                                             step = 1,
                                                             label = "Frequency",
                                                             disabled,
                                                             format,
                                                             onChange
                                                         }) => {
    const display = format ? format(value) : `${Math.round(value)} Hz`;
    return (
        <Box display="flex" flexDirection="column" gap={1}>
            <Typography variant="caption" color="text.secondary">
                {label}: {display}
            </Typography>

            <Slider
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(_, newValue) => onChange(newValue as number)}
                disabled={disabled}
                aria-label={label}
            />

            <Box display="flex" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                    {min} Hz
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {max} Hz
                </Typography>
            </Box>
        </Box>
    );
};

export default FrequencySlider;