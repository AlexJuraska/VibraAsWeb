import React from "react";
import {Box, Slider, Button, TextField, InputAdornment} from "@mui/material";
import type { TextFieldProps } from "@mui/material/TextField";

type FrequencySliderProps = {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    disabled?: boolean;
    format?: (v: number) => string;
    onChange: (value: number) => void;
    showStepButtons?: boolean;
    color?: TextFieldProps["color"];
};

const FrequencySlider: React.FC<FrequencySliderProps> = ({
                                                             value,
                                                             min = 80,
                                                             max = 2000,
                                                             step = 1,
                                                             label = "Frequency",
                                                             disabled,
                                                             format: _format,
                                                             onChange,
                                                             showStepButtons = false,
                                                             color = "primary",
                                                         }) => {
    const [input, setInput] = React.useState<string>(String(Math.round(value)));
    const [editing, setEditing] = React.useState(false);

    React.useEffect(() => {
        if (!editing) setInput(String(Math.round(value)));
    }, [value, editing]);

    const clampAndSnap = React.useCallback(
        (v: number) => {
            if (!Number.isFinite(v)) return value;
            let next = Math.min(max, Math.max(min, v));
            if (step > 0) next = Math.round(next / step) * step;
            next = Math.min(max, Math.max(min, next));
            return next;
        },
        [min, max, step, value]
    );

    const commitInput = React.useCallback(() => {
        const parsed = Number(input);
        if (!Number.isFinite(parsed)) {
            setInput(String(Math.round(value)));
            setEditing(false);
            return;
        }

        if (parsed < min || parsed > max) {
            setInput(String(Math.round(value)));
            setEditing(false);
            return;
        }

        let next = parsed;
        if (step > 0) {
            const snapped = Math.round(parsed / step) * step;
            next = snapped >= min && snapped <= max ? snapped : parsed;
        }

        setInput(String(Math.round(next)));
        if (next !== value) onChange(next);
        setEditing(false);
    }, [input, min, max, step, value, onChange]);

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            commitInput();
            (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
            setEditing(false);
            setInput(String(Math.round(value)));
            (e.currentTarget as HTMLInputElement).blur();
        }
    };

    const onInputChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            setInput(raw);

            const parsed = Number(raw);
            if (raw === "" || !Number.isFinite(parsed)) return;

            if (parsed >= min && parsed <= max) {
                const next = clampAndSnap(parsed);
                if (next !== value) onChange(next);
            }
        },
        [min, max, value, onChange, clampAndSnap]
    );

    const inc = React.useCallback(() => {
        onChange(Math.min(max, value + 1));
    }, [onChange, value, max]);

    const dec = React.useCallback(() => {
        onChange(Math.max(min, value - 1));
    }, [onChange, value, min]);

    return (
        <Box display="flex" flexDirection="column" gap={1} sx={{ width: '100%' }}>
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' }}>
                <TextField
                    label={label}
                    type="number"
                    size="medium"
                    color={color}
                    disabled={disabled}
                    value={input}
                    onChange={onInputChange}
                    onFocus={() => setEditing(true)}
                    onBlur={commitInput}
                    onKeyDown={onInputKeyDown}
                    sx={{ '& .MuiInputBase-input': { fontSize: 18 }, '& .MuiInputLabel-root': { fontSize: 18 } }}
                    slotProps={{
                        input: {
                            endAdornment: <InputAdornment position="end">Hz</InputAdornment>,
                            inputProps: { min, max, step, inputMode: "numeric" },
                        },
                    }}
                />
            </Box>

            <Box display="flex" alignItems="center" gap={1.5}>
                {showStepButtons && (
                    <Button
                        aria-label="decrease frequency"
                        variant="outlined"
                        size="small"
                        color={color}
                        onClick={dec}
                        disabled={!!disabled || value <= min}
                    >
                        -
                    </Button>
                )}

                <Box flex={1}>
                    <Slider
                        value={value}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(_, newValue) =>
                            onChange(Array.isArray(newValue) ? (newValue[0] as number) : (newValue as number))
                        }
                        disabled={disabled}
                        aria-label={label}
                    />
                    <Box display="flex" justifyContent="space-between">
                        <span style={{ fontSize: 18, color: "rgba(0,0,0,0.6)" }}>{min} Hz</span>
                        <span style={{ fontSize: 18, color: "rgba(0,0,0,0.6)" }}>{max} Hz</span>
                    </Box>
                </Box>

                {showStepButtons && (
                    <Button
                        aria-label="increase frequency"
                        variant="outlined"
                        size="small"
                        color={color}
                        onClick={inc}
                        disabled={!!disabled || value >= max}
                    >
                        +
                    </Button>
                )}
            </Box>
        </Box>
    );
};

export default FrequencySlider;
