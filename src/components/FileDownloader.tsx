import React from "react";
import {useTranslation} from "../i18n/i18n";

export default function FileDownloader(data: string) {
    const { t } = useTranslation();
    const handleDownload = () => {
        const file = new Blob([data], { type: 'text/plain' });
        const element = document.createElement('a');
        element.href = URL.createObjectURL(file);
        element.download = "myFile.txt";
        document.body.appendChild(element);
        element.click();
    };

    return (
        <div>
            <button onClick={handleDownload}>{t("components.fileDownloader", "Download File")}</button>
        </div>
    );
}