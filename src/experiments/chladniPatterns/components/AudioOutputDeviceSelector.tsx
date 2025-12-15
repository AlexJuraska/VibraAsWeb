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
import type {SelectChangeEvent} from "@mui/material/Select";
import RefreshIcon from "@mui/icons-material/Refresh";
import {subscribeAudioElement} from "../state/audioOutputBus";
import {useTranslation} from "../../../i18n/i18n";

type Props = {
    audioRef?: React.RefObject<HTMLAudioElement>;
    onSinkChange?: (sinkId: string) => void;
    className?: string;
    style?: React.CSSProperties;
    label?: string;
    storageKey?: string;
    fullWidth?: boolean;
};

type OutputDevice = MediaDeviceInfo & { kind: "audiooutput" };

const supportsSetSinkId =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in (HTMLMediaElement.prototype as any);

async function applySinkId(audio: HTMLAudioElement, sinkId: string): Promise<void> {
    if (!supportsSetSinkId) return;
    await (audio as any).setSinkId(sinkId);
}

export const AudioOutputDeviceSelector: React.FC<Props> = ({
                                                               audioRef,
                                                               onSinkChange,
                                                               className,
                                                               style,
                                                               storageKey = "audio.sinkId",
                                                               fullWidth = true,
                                                           }) => {
    const { t } = useTranslation();
    const label = t("experiments.chladni.components.audioOutputSelector.label", "Audio Output Device");

    const [devices, setDevices] = React.useState<OutputDevice[]>([]);
    const [selected, setSelected] = React.useState<string>(() => {
        return typeof window !== "undefined"
            ? localStorage.getItem(storageKey) || "default"
            : "default";
    });
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);

    const [busAudio, setBusAudio] = React.useState<HTMLAudioElement | null>(null);
    React.useEffect(() => {
        if (audioRef) {
            setBusAudio(null);
            return;
        }
        return subscribeAudioElement(setBusAudio);
    }, [audioRef]);

    const refreshDevices = React.useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) {
            setError("Media devices API not available.");
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

            const outs = list.filter((d): d is OutputDevice => d.kind === "audiooutput");
            const hasDefault = outs.some((d) => d.deviceId === "default");
            const withDefault = hasDefault
                ? outs
                : [
                    {
                        deviceId: "default",
                        groupId: "",
                        kind: "audiooutput",
                        label: "System default",
                        toJSON() {
                            return this;
                        },
                    } as OutputDevice,
                    ...outs,
                ];
            setDevices(withDefault);
            setError(null);
        } catch {
            setError(t("experiments.chladni.components.audioOutputSelector.enumerateError", "Failed to enumerate audio output devices."));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void refreshDevices();
        const handler = () => { void refreshDevices(); };
        navigator.mediaDevices?.addEventListener?.("devicechange", handler);
        return () => {
            navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
        };
    }, [refreshDevices]);

    React.useEffect(() => {
        const audio = audioRef?.current ?? busAudio;
        if (!audio || !supportsSetSinkId) return;
        applySinkId(audio, selected).catch((e) => {
            console.warn("setSinkId failed:", e);
        });
    }, [audioRef, busAudio, selected]);

    const onChange = async (e: SelectChangeEvent<string>) => {
        const sinkId = e.target.value as string;
        setSelected(sinkId);
        localStorage.setItem(storageKey, sinkId);

        const audio = audioRef?.current ?? busAudio;
        if (audio && supportsSetSinkId) {
            try {
                await applySinkId(audio, sinkId);
            } catch (err) {
                console.warn("Unable to switch output device:", err);
            }
        } else if (onSinkChange) {
            onSinkChange(sinkId);
        }
    };

    const disabled = !supportsSetSinkId || loading;
    const disabledReason = !supportsSetSinkId
        ? t("experiments.chladni.components.audioOutputSelector.browserNotSupported",
            "Output device switching is not supported in this browser.")
        : undefined;

    return (
        <Box className={className} style={style}>
            <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title={disabledReason || ""} disableHoverListener={supportsSetSinkId}>
                    <FormControl
                        variant="outlined" fullWidth={fullWidth} disabled={disabled}
                        >
                        <InputLabel id="audio-output-label">{label}</InputLabel>
                        <Select
                            labelId="audio-output-label"
                            id="audio-output-select"
                            input={<OutlinedInput label={label} />}
                            value={selected}
                            onChange={onChange}
                        >
                            {devices.map((d) => (
                                <MenuItem key={d.deviceId} value={d.deviceId}>
                                    {d.label || (d.deviceId === "default" ?
                                        t("experiments.chladni.components.audioOutputSelector.defaultAudio", "System default") :
                                        t("experiments.chladni.components.audioOutputSelector.audioDevice", "Audio device"))}
                                </MenuItem>
                            ))}
                        </Select>
                        {error && <FormHelperText error>{error}</FormHelperText>}
                    </FormControl>
                </Tooltip>

                <Tooltip title={t("experiments.chladni.components.audioOutputSelector.refresh", "Refresh devices")}>
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

export default AudioOutputDeviceSelector;
