import  React, { useState } from "react";
import { IconButton, Drawer, useTheme } from "@mui/material";
import { Menu as MenuIcon, ChevronLeft } from "@mui/icons-material";
import * as ChladniComponents from "../experiments/chladniPatterns/components";
import ColorBlock from "./ColorBlock";

const AppComponents = { ...ChladniComponents, ColorBlock };

interface CollapsiblePanelProps {
    collapsed?: boolean;
    children?: { component: string; props?: Record<string, any> }[];
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
                                                                      collapsed = false,
                                                                      children = [],
                                                                  }) => {
    const [open, setOpen] = useState(!collapsed);
    const theme = useTheme();

    const toggle = () => setOpen(prev => !prev);

    const renderChild = (child: { component: string; props?: Record<string, any> }, i: number) => {
        const Comp = (AppComponents as any)[child.component];
        if (!Comp) return null;
        return <Comp key={i} {...(child.props || {})} />;
    };

    return (
        <>
            <IconButton
                onClick={toggle}
                sx={{
                    height: "100%",
                    width: "100%",
                    position: "absolute",
                    top: 8,
                    left: 8,
                    zIndex: 2000,
                    color: "white",
                    backgroundColor: "rgba(0,0,0,0.4)",
                    "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" },
                    display: open ? "none" : "flex",
                }}
            >
                <MenuIcon/>
            </IconButton>

            <Drawer
                open={open}
                onClose={toggle}
                variant="temporary"
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: {
                        width: "80vw",
                        backgroundColor: theme.palette.background.paper,
                        padding: theme.spacing(3),
                        gap: theme.spacing(2),
                    }
                }}
            >
                {children.map(renderChild)}
            </Drawer>
        </>
    );
};

export default CollapsiblePanel;