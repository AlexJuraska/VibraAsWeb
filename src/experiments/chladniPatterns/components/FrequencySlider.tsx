import React from "react";

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
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: "#666" }}>
                {label}: {display}
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                style={{ width: "100%" }}
                aria-label={label}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#777" }}>
                <span>{min} Hz</span>
                <span>{max} Hz</span>
            </div>
        </div>
    );
};

export default FrequencySlider;