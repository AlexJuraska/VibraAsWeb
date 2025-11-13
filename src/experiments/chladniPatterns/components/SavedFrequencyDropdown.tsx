import React from "react";
import { publishFrequency, subscribeCurrentFrequency } from "../state/currentFrequencyBus";

export default function SavedFrequencyDropdown() {
    const [currentFreq, setCurrentFreq] = React.useState<number>(0);
    const [savedFrequencies, setSavedFrequencies] = React.useState<number[]>([]);
    const [open, setOpen] = React.useState<boolean>(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const unsub = subscribeCurrentFrequency((freq: number) => {
            setCurrentFreq(freq);
        });
        return unsub;
    }, []);

    React.useEffect(() => {
        function onPointerDown(e: PointerEvent) {
            if (!open) return;
            const el = containerRef.current;
            if (el && !el.contains(e.target as Node)) setOpen(false);
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const AddCurrentFrequency = React.useCallback(() => {
        setSavedFrequencies((prev) => {
            if (prev.includes(currentFreq)) return prev;
            return [...prev, currentFreq];
        });
    }, [currentFreq]);

    const onSelectFrequency = React.useCallback((v: number) => {
        if (!Number.isFinite(v)) return;
        publishFrequency(v);
        setOpen(false);
    }, []);

    const fieldPrimary = React.useMemo(
        () => `Saved Frequencies${savedFrequencies.length > 0 ? ` (${savedFrequencies.length})` : ""}`,
        [savedFrequencies.length]
    );
    const fieldSecondary = React.useMemo(
        () =>
            savedFrequencies.includes(currentFreq)
                ? `${currentFreq} Hz`
                : `Current: ${currentFreq} Hz`,
        [savedFrequencies, currentFreq]
    );

    if (savedFrequencies.length === 0) {
        return (
            <div>
                <label htmlFor="savedFrequencies">
                    You do not have any saved frequencies. You can add more with the button below or import a file
                    with saved frequencies
                </label>
                <div style={{ marginTop: 8 }}>
                    <button onClick={AddCurrentFrequency}>Save Current Frequency</button>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} style={{ position: "relative", width: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    onClick={() => setOpen((s) => !s)}
                    style={{
                        flex: 1,
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        padding: "8px",
                    }}
                >
                    <span style={{ fontWeight: 600 }}>{fieldPrimary}</span>
                    <span style={{ fontSize: 13, color: "rgba(0,0,0,0.6)", marginTop: 4 }}>
                        {fieldSecondary}
                    </span>
                </button>
                <div style={{ marginLeft: 8 }}>
                    <button onClick={AddCurrentFrequency}>Save</button>
                </div>
            </div>

            {open && (
                <ul
                    role="listbox"
                    aria-label="Saved Frequencies"
                    tabIndex={-1}
                    style={{
                        position: "absolute",
                        top: 64,
                        left: 0,
                        right: 0,
                        maxHeight: 200,
                        overflowY: "auto",
                        margin: 0,
                        padding: "8px",
                        listStyle: "none",
                        background: "white",
                        border: "1px solid rgba(0,0,0,0.15)",
                        borderRadius: 4,
                        boxShadow: "0 4px 8px rgba(0,0,0,0.08)",
                        zIndex: 1000,
                    }}
                >
                    {savedFrequencies.map((freq, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>
                            <button
                                onClick={() => onSelectFrequency(freq)}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "6px 8px",
                                    background: freq === currentFreq ? "rgba(0,0,0,0.06)" : "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                                aria-selected={freq === currentFreq}
                            >
                                {freq} Hz{freq === currentFreq ? " (current)" : ""}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
