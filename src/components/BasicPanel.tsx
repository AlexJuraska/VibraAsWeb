import React from "react";
import { Box, useTheme } from "@mui/material";
import * as ChladniComponents from "../experiments/chladniPatterns/components";
import ColorBlock from "./ColorBlock";

const AppComponents = { ...ChladniComponents, ColorBlock };

interface BasicPanelProps {
    children?: { component: string; props?: Record<string, any> }[];
}

const BasicPanel: React.FC<BasicPanelProps> = ({
                                                   children = [],
                                               }) => {
    const theme = useTheme();

    const renderChild = (child: { component: string; props?: Record<string, any> }, i: number) => {
        const Comp = (AppComponents as any)[child.component];
        if (!Comp) return null;
        return <Comp key={i} {...(child.props || {})} />;
    };

    return (
        <Box
            sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "flex-start",
                overflowY: "auto",
                padding: theme.spacing(2),
                gap: theme.spacing(2),
            }}
        >
            {children.map(renderChild)}
        </Box>
    );
};

export default BasicPanel;