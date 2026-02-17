import React from "react";
import {
    Box,
    CircularProgress,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    OutlinedInput,
    Select,
    Stack,
    Tooltip,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTranslation } from "../../../i18n/i18n";
import { audioInputDeviceBus } from "../state/audioInputDeviceBus";

type Props = {
    onDeviceChange?: (deviceId: string) => void;
    className?: string;
    style?: React.CSSProperties;
    label?: string;
    storageKey?: string;
    fullWidth?: boolean;
};

type InputDevice = MediaDeviceInfo & { kind: "audioinput" };

export const AudioInputDeviceSelector: React.FC<Props> = ({
    onDeviceChange,
    className,
    style,
    label,
    storageKey = "audio.inputDeviceId",
    fullWidth = true,
}) => {
    const { t } = useTranslation();
    const resolvedLabel = label || t("experiments.audioAnalysis.components.audioInputSelector.label", "Audio Input Device");

    const [devices, setDevices] = React.useState<InputDevice[]>([]);
    const [selected, setSelected] = React.useState<string>(() => {
        return typeof window !== "undefined"
            ? localStorage.getItem(storageKey) || "default"
            : "default";
    });
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);

    const refreshDevices = React.useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) {
            setError(t("experiments.audioAnalysis.components.audioInputSelector.mediaDevicesUnavailable", "Media devices API not available."));
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            let list = await navigator.mediaDevices.enumerateDevices();

            const labelsMissing = list.every((d) => !d.label);
            if (labelsMissing) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach((t) => t.stop());
                    list = await navigator.mediaDevices.enumerateDevices();
                } catch {
                }
            }

            const inputs = list.filter((d): d is InputDevice => d.kind === "audioinput");
            const hasDefault = inputs.some((d) => d.deviceId === "default");
            const withDefault = hasDefault
                ? inputs
                : [
                    {
                        deviceId: "default",
                        groupId: "",
                        kind: "audioinput",
                        label: t("experiments.audioAnalysis.components.audioInputSelector.defaultAudio", "System default"),
                        toJSON() {
                            return this;
                        },
                    } as InputDevice,
                    ...inputs,
                ];

            setDevices(withDefault);
            setError(null);
        } catch {
            setError(t("experiments.audioAnalysis.components.audioInputSelector.enumerateError", "Failed to enumerate audio input devices."));
        } finally {
            setLoading(false);
        }
    }, [t]);

    React.useEffect(() => {
        void refreshDevices();
        const handler = () => { void refreshDevices(); };
        navigator.mediaDevices?.addEventListener?.("devicechange", handler);
        return () => {
            navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
        };
    }, [refreshDevices]);

    React.useEffect(() => {
        onDeviceChange?.(selected);
        audioInputDeviceBus.publish(selected);
        if (typeof window !== "undefined") {
            localStorage.setItem(storageKey, selected);
        }
    }, [onDeviceChange, selected, storageKey]);

    const onChange = async (e: SelectChangeEvent<string>) => {
        const deviceId = e.target.value as string;
        setSelected(deviceId);
    };

    return (
        <Box className={className} style={style}>
            <Stack direction="row" spacing={1} alignItems="center">
                <FormControl variant="outlined" fullWidth={fullWidth} disabled={loading}>
                    <InputLabel id="audio-input-label">{resolvedLabel}</InputLabel>
                    <Select
                        labelId="audio-input-label"
                        id="audio-input-select"
                        input={<OutlinedInput label={resolvedLabel} />}
                        value={selected}
                        onChange={onChange}
                    >
                        {devices.map((d) => (
                            <MenuItem key={d.deviceId} value={d.deviceId}>
                                {d.label || (d.deviceId === "default"
                                    ? t("experiments.audioAnalysis.components.audioInputSelector.defaultAudio", "System default")
                                    : t("experiments.audioAnalysis.components.audioInputSelector.audioDevice", "Audio device"))}
                            </MenuItem>
                        ))}
                    </Select>
                    {error && <FormHelperText error>{error}</FormHelperText>}
                </FormControl>

                <Tooltip title={t("experiments.audioAnalysis.components.audioInputSelector.refresh", "Refresh devices")}>
          <span>
            <IconButton
                aria-label="refresh devices"
                onClick={() => { void refreshDevices(); }}
                disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
                </Tooltip>
            </Stack>
        </Box>
    );
};

export default AudioInputDeviceSelector;

