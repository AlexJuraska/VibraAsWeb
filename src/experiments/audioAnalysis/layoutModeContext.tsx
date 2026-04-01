import React, { createContext, useContext } from "react";

export type LayoutModeContextType = {
    useDualLayout: boolean;
    toggleLayout: () => void;
};

const defaultValue: LayoutModeContextType = {
    useDualLayout: false,
    toggleLayout: () => {
        // no-op fallback to avoid runtime errors when provider is absent
    },
};

const LayoutModeContext = createContext<LayoutModeContextType>(defaultValue);

export const LayoutModeProvider: React.FC<{ value: LayoutModeContextType; children: React.ReactNode }> = ({ value, children }) => {
    return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>;
};

export const useLayoutMode = (): LayoutModeContextType => {
    return useContext(LayoutModeContext);
};
