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

const fluidTypography = {
    h1: {
        mobile: "clamp(2.2rem, 8vw, 2.8rem)",
        desktop: "clamp(1.8rem, 3vw, 2.2rem)",
    },
    h2: {
        mobile: "clamp(1.9rem, 6.5vw, 2.4rem)",
        desktop: "clamp(1.5rem, 2.5vw, 1.9rem)",
    },
    h3: {
        mobile: "clamp(1.6rem, 5.5vw, 2rem)",
        desktop: "clamp(1.3rem, 2vw, 1.6rem)",
    },
    h4: {
        mobile: "clamp(1.35rem, 4.5vw, 1.6rem)",
        desktop: "clamp(1.15rem, 1.6vw, 1.35rem)",
    },
    h5: {
        mobile: "clamp(1.2rem, 4vw, 1.35rem)",
        desktop: "clamp(1.05rem, 1.4vw, 1.15rem)",
    },
    h6: {
        mobile: "clamp(1.05rem, 3.5vw, 1.2rem)",
        desktop: "clamp(0.95rem, 1.2vw, 1.05rem)",
    },

    body1: {
        mobile: fluidMobile.font,
        desktop: fluidDesktop.font,
    },
    body2: {
        mobile: "clamp(0.95rem, 4.5vw, 1.05rem)",
        desktop: "clamp(0.8rem, 1.2vw, 0.9rem)",
    },

    subtitle1: {
        mobile: "clamp(1rem, 4.5vw, 1.15rem)",
        desktop: "clamp(0.85rem, 1.3vw, 0.95rem)",
    },
    subtitle2: {
        mobile: "clamp(0.9rem, 4vw, 1rem)",
        desktop: "clamp(0.75rem, 1.1vw, 0.85rem)",
    },

    button: {
        mobile: fluidMobile.font,
        desktop: fluidDesktop.font,
    },

    caption: {
        mobile: "clamp(0.8rem, 3.5vw, 0.9rem)",
        desktop: "clamp(0.7rem, 1vw, 0.8rem)",
    },

    overline: {
        mobile: "clamp(0.75rem, 3vw, 0.85rem)",
        desktop: "clamp(0.65rem, 0.9vw, 0.75rem)",
    },
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

        h1: { fontSize: fluidTypography.h1.mobile, fontWeight: 700 },
        h2: { fontSize: fluidTypography.h2.mobile, fontWeight: 600 },
        h3: { fontSize: fluidTypography.h3.mobile, fontWeight: 600 },
        h4: { fontSize: fluidTypography.h4.mobile, fontWeight: 600 },
        h5: { fontSize: fluidTypography.h5.mobile, fontWeight: 500 },
        h6: { fontSize: fluidTypography.h6.mobile, fontWeight: 500 },

        subtitle1: { fontSize: fluidTypography.subtitle1.mobile },
        subtitle2: { fontSize: fluidTypography.subtitle2.mobile },

        body1: { fontSize: fluidTypography.body1.mobile, lineHeight: 1.6 },
        body2: { fontSize: fluidTypography.body2.mobile, lineHeight: 1.55 },

        button: {
            fontSize: fluidTypography.button.mobile,
            textTransform: "none",
            fontWeight: 500,
        },

        caption: { fontSize: fluidTypography.caption.mobile },
        overline: {
            fontSize: fluidTypography.overline.mobile,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
        },
    },

    components: {

        MuiCssBaseline: {
            styleOverrides: (theme) => ({
                [theme.breakpoints.up("lg")]: {
                    "& h1": { fontSize: fluidTypography.h1.desktop },
                    "& h2": { fontSize: fluidTypography.h2.desktop },
                    "& h3": { fontSize: fluidTypography.h3.desktop },
                    "& h4": { fontSize: fluidTypography.h4.desktop },
                    "& h5": { fontSize: fluidTypography.h5.desktop },
                    "& h6": { fontSize: fluidTypography.h6.desktop },

                    "& .MuiTypography-body1": {
                        fontSize: fluidTypography.body1.desktop,
                    },
                    "& .MuiTypography-body2": {
                        fontSize: fluidTypography.body2.desktop,
                    },
                    "& .MuiTypography-subtitle1": {
                        fontSize: fluidTypography.subtitle1.desktop,
                    },
                    "& .MuiTypography-subtitle2": {
                        fontSize: fluidTypography.subtitle2.desktop,
                    },
                    "& .MuiTypography-button": {
                        fontSize: fluidTypography.button.desktop,
                    },
                    "& .MuiTypography-caption": {
                        fontSize: fluidTypography.caption.desktop,
                    },
                    "& .MuiTypography-overline": {
                        fontSize: fluidTypography.overline.desktop,
                    },
                },
            }),
        },

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
                    paddingRight: theme.spacing(4), // space from dropdown icon

                    [theme.breakpoints.up("lg")]: {
                        paddingRight: theme.spacing(5),
                    },
                }),
            },
        },

        MuiInputLabel: {
            styleOverrides: {
                outlined: ({ theme }) => ({
                    fontSize: "0.95em",

                    [theme.breakpoints.up("lg")]: {
                        fontSize: "0.9em",
                    },
                }),
            },
        },

        MuiOutlinedInput: {
            styleOverrides: {
                root: ({ theme }) => ({
                    fontSize: "0.95em",

                    [theme.breakpoints.up("lg")]: {
                        fontSize: "0.9em",
                    },
                }),
            },
        },

        MuiMenuItem: {
            styleOverrides: {
                root: ({ theme }) => ({
                    fontSize: "0.95em",
                    minHeight: "2.25em",

                    [theme.breakpoints.up("lg")]: {
                        fontSize: "0.9em",
                        minHeight: "2em",
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
    },
});

export default theme;