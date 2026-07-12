import React, { createContext, useContext } from "react";

export type LayoutModeContextType = {
    useDualLayout: boolean;
    toggleLayout: () => void;
};

const defaultValue: LayoutModeContextType = {
    useDualLayout: false,
    toggleLayout: () => {
    },
};

const LayoutModeContext = createContext<LayoutModeContextType>(defaultValue);

export const LayoutModeProvider: React.FC<{ value: LayoutModeContextType; children: React.ReactNode }> = ({ value, children }) => {
    return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>;
};

export const useLayoutMode = (): LayoutModeContextType => {
    return useContext(LayoutModeContext);
};
