import { createTheme } from "@mui/material/styles";

const fontSize = 14;

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
        fontSize: fontSize,
        caption: { fontSize: fontSize-1 }
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontSize: fontSize
                }
            }
        },
        MuiInputBase: {
            styleOverrides: {
                root: { fontSize: fontSize }
            }
        }
    }
});

export default theme;