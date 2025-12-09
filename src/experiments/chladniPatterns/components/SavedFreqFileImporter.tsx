import React from "react";
import { Button, ButtonProps } from "@mui/material";
import { setSavedFrequencies } from "../state/savedFrequencies";

export type SavedFreqFileImporterProps = {
    label?: string;
    buttonProps?: Omit<ButtonProps, "onClick">;
};

const SavedFreqFileImporter: React.FC<SavedFreqFileImporterProps> = ({
                                                                         label = "Import",
                                                                         buttonProps,
                                                                     }) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const handleClick = React.useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleFileChange = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const text = String(reader.result ?? "");
                    const lines = text.split(/\r?\n/);

                    const parsed = lines
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0)
                        .map((line) => {
                            const numericPart = line.split(/\s+/)[0];
                            return Number.parseFloat(numericPart);
                        })
                        .filter((v) => Number.isFinite(v)) as number[];

                    const uniqueParsed = Array.from(new Set(parsed));
                    const sorted = uniqueParsed.sort((a, b) => a - b);

                    setSavedFrequencies(sorted);
                } catch (e) {
                    console.error("Failed to import frequencies", e);
                } finally {
                    event.target.value = "";
                }
            };

            reader.readAsText(file);
        },
        []
    );

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".txt"
                style={{ display: "none" }}
                onChange={handleFileChange}
            />
            <Button
                variant="outlined"
                color="primary"
                onClick={handleClick}
                sx={{ whiteSpace: "nowrap" }}
                {...buttonProps}
            >
                {label}
            </Button>
        </>
    );
};

export default SavedFreqFileImporter;