import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import App from "./App";
import {ThemeProvider} from "@mui/material/styles";
import theme from "./theme";
import {I18nProvider} from "./i18n/i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <I18nProvider>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter>
            <App />
            </BrowserRouter>
        </ThemeProvider>
            </I18nProvider>
    </React.StrictMode>
);