import React, { useState, useEffect } from "react";
import { Box, IconButton, Drawer, useTheme } from "@mui/material";
import { Menu as MenuIcon, ChevronLeft } from "@mui/icons-material";
import { ComponentMap } from "../layout-system/types/ComponentMap";

interface PanelChild {
    component: keyof ComponentMap;
    props?: Record<string, any>;
}

interface CollapsiblePanelProps {
    collapsed?: boolean;
    components: ComponentMap;
    children?: PanelChild[];
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
                                                               collapsed = false,
                                                               components,
                                                               children = [],
                                                           }) => {
    const [open, setOpen] = useState(!collapsed);
    const theme = useTheme();

    useEffect(() => {
        setOpen(!collapsed);
    }, [collapsed]);

    const toggle = () => setOpen((prev) => !prev);

    const flowChildren = children.filter(
        (c) => c.props?.placement !== "bottom"
    );

    const bottomChildren = children.filter(
        (c) => c.props?.placement === "bottom"
    );

    const render = (child: PanelChild, i: number) => {
        const Comp = components[child.component] as React.ComponentType<any>;
        return <Comp key={i} {...child.props} components={components} />;
    };

    return (
        <>
            {!open && (
                <Box
                    sx={{
                        width: "100%",
                        maxWidth: 72,
                        minWidth: 0,
                        display: "flex",
                        alignSelf: "center",
                        justifySelf: "start",
                        flexShrink: 0,
                    }}
                >
                    <IconButton
                        disableRipple
                        onClick={toggle}
                        sx={{
                            height: "100%",
                            minWidth: 0,
                            minHeight: 0,
                            padding: 0,
                            aspectRatio: "1 / 1",
                            borderRadius: "50%",
                            color: "white",
                            backgroundColor: "rgba(0,0,0,0.4)",
                            "& .MuiSvgIcon-root": {
                                fontSize: "clamp(1rem, 60%, 1.5rem)",
                            },
                            "&:hover": {
                                backgroundColor: "rgba(0,0,0,0.6)",
                            },
                        }}
                    >
                        <MenuIcon />
                    </IconButton>
                </Box>
            )}

            <Drawer
                open={open}
                onClose={toggle}
                variant="temporary"
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: {
                        width: "90vw",
                        maxWidth: "90vw",
                        height: "100vh",
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: theme.palette.background.paper,
                    },
                }}
            >
                <Box
                    sx={{
                        px: 2,
                        py: 1,
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                >
                    <IconButton
                        onClick={toggle}
                        sx={{
                            color: "white",
                            backgroundColor: "rgba(0,0,0,0.4)",
                            borderRadius: "50%",
                            "&:hover": {
                                backgroundColor: "rgba(0,0,0,0.6)",
                            },
                        }}
                    >
                        <ChevronLeft />
                    </IconButton>
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        p: 2,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    {flowChildren.map(render)}
                </Box>

                {bottomChildren.length > 0 && (
                    <Box
                        sx={{
                            p: 2,
                            borderTop: "1px solid",
                            borderColor: "divider",
                            backgroundColor: "background.paper",
                        }}
                    >
                        {bottomChildren.map(render)}
                    </Box>
                )}
            </Drawer>
        </>
    );
};

export default CollapsiblePanel;