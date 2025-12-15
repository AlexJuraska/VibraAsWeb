import React from "react";
import {Box, Slider, Button, TextField, InputAdornment, Typography} from "@mui/material";
import type { TextFieldProps } from "@mui/material/TextField";
import { publishFrequency, subscribeCurrentFrequency } from "../state/currentFrequencyBus";
import {useTranslation} from "../../../i18n/i18n";

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
                                                             disabled,
                                                             format: _format,
                                                             onChange,
                                                             showStepButtons = false,
                                                             color = "primary",
                                                         }) => {
    const { t } = useTranslation();
    const label = t("experiments.chladni.components.frequencySlider.label", "Frequency");

    const [input, setInput] = React.useState<string>(String(Math.round(value)));
    const [editing, setEditing] = React.useState(false);

    React.useEffect(() => {
        if (!editing) setInput(String(Math.round(value)));
    }, [value, editing]);

    React.useEffect(() => {
        const unsub = subscribeCurrentFrequency((freq: number) => {
            if (freq !== value) {
                onChange(freq);
            }
        });
        return unsub;
    }, [onChange, value]);

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

    const send = React.useCallback(
        (next: number) => {
            onChange(next);
            publishFrequency(next);
        },
        [onChange]
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
        if (next !== value) send(next);
        setEditing(false);
    }, [input, min, max, step, value, send]);

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
                if (next !== value) send(next);
            }
        },
        [min, max, value, send, clampAndSnap]
    );

    const valueRef = React.useRef<number>(value);
    React.useEffect(() => {
        valueRef.current = value;
    }, [value]);

    const inc = React.useCallback(() => {
        const next = Math.min(max, valueRef.current + 1);
        send(next);
    }, [send, max]);

    const dec = React.useCallback(() => {
        const next = Math.max(min, valueRef.current - 1);
        send(next);
    }, [send, min]);

    const REPEAT_DELAY_MS = 300;
    const REPEAT_INTERVAL_MS = 50;

    const repeatIntervalRef = React.useRef<number | null>(null);
    const repeatTimeoutRef = React.useRef<number | null>(null);
    const ignoreNextClickRef = React.useRef(false);

    const startRepeat = React.useCallback((fn: () => void) => {
        if (repeatIntervalRef.current != null || repeatTimeoutRef.current != null) return;

        fn();
        ignoreNextClickRef.current = true;

        repeatTimeoutRef.current = window.setTimeout(() => {
            repeatTimeoutRef.current = null;
            repeatIntervalRef.current = window.setInterval(fn, REPEAT_INTERVAL_MS);
        }, REPEAT_DELAY_MS);
    }, []);

    const stopRepeat = React.useCallback(() => {
        if (repeatIntervalRef.current != null) {
            clearInterval(repeatIntervalRef.current);
            repeatIntervalRef.current = null;
        }
        if (repeatTimeoutRef.current != null) {
            clearTimeout(repeatTimeoutRef.current);
            repeatTimeoutRef.current = null;
        }
        setTimeout(() => {
            ignoreNextClickRef.current = false;
        }, 0);
    }, []);

    React.useEffect(() => {
        return () => {
            if (repeatIntervalRef.current != null) {
                clearInterval(repeatIntervalRef.current);
                repeatIntervalRef.current = null;
            }
            if (repeatTimeoutRef.current != null) {
                clearTimeout(repeatTimeoutRef.current);
                repeatTimeoutRef.current = null;
            }
        };
    }, []);

    return (
        <Box display="flex" flexDirection="column" gap={1} width="100%">

            <Box display="flex" justifyContent="center" width="100%">
                <TextField
                    label={label}
                    type="number"
                    color={color}
                    disabled={disabled}
                    value={input}
                    onChange={onInputChange}
                    onFocus={() => setEditing(true)}
                    onBlur={commitInput}
                    onKeyDown={onInputKeyDown}
                    slotProps={{
                        input: {
                            endAdornment: <InputAdornment position="end">Hz</InputAdornment>,
                            inputProps: { min, max, step, inputMode: "numeric" },
                        },
                    }}
                />
            </Box>

            <Box display="flex" alignItems="center" width="100%" gap={1}>
                {showStepButtons && (
                    <Button
                        aria-label="decrease frequency"
                        variant="outlined"
                        size="small"
                        color="primary"
                        onMouseDown={() => startRepeat(dec)}
                        onMouseUp={stopRepeat}
                        onMouseLeave={stopRepeat}
                        onTouchStart={(e) => { e.preventDefault(); startRepeat(dec); }}
                        onTouchEnd={stopRepeat}
                        onClick={(e) => {
                            if (ignoreNextClickRef.current) {
                                ignoreNextClickRef.current = false;
                                return;
                            }
                            dec();
                        }}
                        disabled={!!disabled || value <= min}
                        sx={{
                            p: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        -
                    </Button>
                )}

                <Slider
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(_, nv) => {
                        const val = Array.isArray(nv) ? nv[0] : nv;
                        send(val);
                    }}
                    disabled={disabled}
                    aria-label={label}
                    sx={{ flex: 1 }}
                />

                {showStepButtons && (
                    <Button
                        aria-label="increase frequency"
                        variant="outlined"
                        size="small"
                        color="primary"
                        onMouseDown={() => startRepeat(inc)}
                        onMouseUp={stopRepeat}
                        onMouseLeave={stopRepeat}
                        onTouchStart={(e) => { e.preventDefault(); startRepeat(inc); }}
                        onTouchEnd={stopRepeat}
                        onClick={(e) => {
                            if (ignoreNextClickRef.current) {
                                ignoreNextClickRef.current = false;
                                return;
                            }
                            inc();
                        }}
                        disabled={!!disabled || value >= max}
                        sx={{
                            p: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        +
                    </Button>
                )}
            </Box>

            <Box display="flex" justifyContent="space-between" width="100%">
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: 13 }} >{min} Hz</Typography>

                <Typography variant="caption" color="textSecondary" sx={{ fontSize: 13 }} >{max} Hz</Typography>
            </Box>

        </Box>
    );

};

export default FrequencySlider;
