import React from "react";
import { Button, ButtonProps } from "@mui/material";

export type FileExporterProps = {
    getContent: () => string;
    fileName?: string;
    label?: string;
    disabled?: boolean;
    buttonProps?: Omit<ButtonProps, "onClick" | "disabled">;
};

const SavedFreqFileExporter: React.FC<FileExporterProps> = ({
                                                       getContent,
                                                       fileName = "export.txt",
                                                       label = "Export",
                                                       disabled,
                                                       buttonProps,
                                                   }) => {
    const handleExport = React.useCallback(() => {
        const content = getContent();
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [getContent, fileName]);

    return (
        <Button
            variant="outlined"
            color="primary"
            onClick={handleExport}
            disabled={disabled}
            {...buttonProps}
        >
            {label}
        </Button>
    );
};

export default SavedFreqFileExporter;