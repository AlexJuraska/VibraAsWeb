import React from "react";

export default function FileDownloader(data: string) {
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
            <button onClick={handleDownload}>Download File</button>
        </div>
    );
}