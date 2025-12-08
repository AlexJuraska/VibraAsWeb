import { createTheme } from "@mui/material/styles";

const fluidMobile = {
    font: "clamp(1.05rem, 5vw, 1.25rem)",
    control: "clamp(48px, 9vw, 60px)",
    icon: "clamp(24px, 6vw, 32px)",
};

const fluidDesktop = {
    font: "clamp(0.9rem, 1.4vw, 1rem)",
    control: "clamp(36px, 2.2vw, 42px)",
    icon: "clamp(18px, 1.8vw, 22px)",
};

const theme = createTheme({
    palette: {
        primary: {
            main: "#69bf97",
            dark: "#579f7d",
            light: "#b1ecd3",
            contrastText: "#ffffff",
        },
        text: {
            secondary: "rgba(0,0,0,0.6)",
        },
    },

    typography: {
        fontSize: 16,
    },

    components: {

        MuiButton: {
            styleOverrides: {
                root: ({ theme }) => ({
                    minHeight: fluidMobile.control,
                    fontSize: fluidMobile.font,
                    borderRadius: 12,

                    [theme.breakpoints.up("lg")]: {
                        minHeight: fluidDesktop.control,
                        fontSize: fluidDesktop.font,
                    },
                }),
            },
        },

        MuiIconButton: {
            styleOverrides: {
                root: ({ theme }) => ({
                    width: fluidMobile.control,
                    height: fluidMobile.control,

                    [theme.breakpoints.up("lg")]: {
                        width: fluidDesktop.control,
                        height: fluidDesktop.control,
                    },
                }),
            },
        },

        MuiSelect: {
            styleOverrides: {
                select: ({ theme }) => ({
                    display: "flex",
                    alignItems: "center",
                    minHeight: fluidMobile.control,
                    fontSize: fluidMobile.font,

                    [theme.breakpoints.up("lg")]: {
                        minHeight: fluidDesktop.control,
                        fontSize: fluidDesktop.font,
                    },
                }),
            },
        },

        MuiInputBase: {
            styleOverrides: {
                root: ({ theme }) => ({
                    minHeight: fluidMobile.control,
                    fontSize: fluidMobile.font,

                    [theme.breakpoints.up("lg")]: {
                        minHeight: fluidDesktop.control,
                        fontSize: fluidDesktop.font,
                    },
                }),

                input: ({ theme }) => ({
                    padding: "0 0.75em",

                    [theme.breakpoints.up("lg")]: {
                        padding: "0 0.6em",
                    },
                }),
            },
        },

        MuiSlider: {
            styleOverrides: {
                root: ({ theme }) => ({
                    height: "clamp(6px, 2vw, 8px)",

                    [theme.breakpoints.up("lg")]: {
                        height: "clamp(4px, 0.8vw, 6px)",
                    },
                }),
                thumb: ({ theme }) => ({
                    width: fluidMobile.icon,
                    height: fluidMobile.icon,

                    [theme.breakpoints.up("lg")]: {
                        width: fluidDesktop.icon,
                        height: fluidDesktop.icon,
                    },
                }),
            },
        },

        MuiTypography: {
            styleOverrides: {
                root: ({ theme }) => ({
                    fontSize: fluidMobile.font,

                    [theme.breakpoints.up("lg")]: {
                        fontSize: fluidDesktop.font,
                    },
                }),
            },
        },
    },
});

export default theme;