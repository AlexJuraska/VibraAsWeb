import React, { useState } from "react";
import { IconButton, Drawer, useMediaQuery, useTheme } from "@mui/material";
import { Menu as MenuIcon, ChevronLeft } from "@mui/icons-material";
import * as AppComponents from "../components";

interface CollapsiblePanelProps {
    collapsed?: boolean;
    children?: { component: string; props?: Record<string, any> }[];

}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
                                                                      collapsed = false,
                                                                      children = []
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
                    position: "absolute",
                    top: 8,
                    left: 8,
                    zIndex: 2000,
                    color: "white",
                    backgroundColor: "rgba(0,0,0,0.4)",
                    "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" }
                }}
            >
                {open ? <ChevronLeft /> : <MenuIcon />}
            </IconButton>

            <Drawer
                open={open}
                onClose={toggle}
                variant="temporary"
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: {
                        width: 240,
                        backgroundColor: theme.palette.background.paper,
                    }
                }}
            >
                {children.map(renderChild)}
            </Drawer>
        </>
    );
};

export default CollapsiblePanel;