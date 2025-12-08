import React from "react";
import { Box, useTheme } from "@mui/material";
import { ComponentMap } from "../layout-system/types/ComponentMap";

interface PanelChild {
    component: string;
    props?: Record<string, any>;
}

interface BasicPanelProps {
    components: ComponentMap;
    children?: PanelChild[];
}

const BasicPanel: React.FC<BasicPanelProps> = ({
                                                   components,
                                                   children = [],
                                               }) => {
    const theme = useTheme();

    const flowChildren = children.filter(
        (c) => c.props?.placement !== "bottom"
    );

    const bottomChildren = children.filter(
        (c) => c.props?.placement === "bottom"
    );

    const render = (child: PanelChild, i: number) => {
        const Comp = components[child.component];
        if (!Comp) {
            console.warn(`Component '${child.component}' not found`);
            return null;
        }
        return <Comp key={i} {...child.props} components={components} />;
    };

    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    p: theme.spacing(2),
                    display: "flex",
                    flexDirection: "column",
                    gap: theme.spacing(2),
                }}
            >
                {flowChildren.map(render)}
            </Box>

            {bottomChildren.length > 0 && (
                <Box
                    sx={{
                        p: theme.spacing(2),
                        borderTop: "1px solid rgba(0,0,0,0.12)",
                        display: "flex",
                        flexDirection: "column",
                        gap: theme.spacing(1),
                    }}
                >
                    {bottomChildren.map(render)}
                </Box>
            )}
        </Box>
    );
};

export default BasicPanel;
