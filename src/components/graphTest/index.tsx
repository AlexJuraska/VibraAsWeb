import React from "react";
import { Container, Paper, Stack, Typography, CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ChartOptions } from "chart.js";
import Graph, { ChartDataProps, Point } from "../Graph";

const makeSine = (points: number, step: number, noise = 0): Point[] =>
    Array.from({ length: points }, (_, i) => {
        const x = i * step;
        const y = Math.sin(x) + (noise ? (Math.random() - 0.5) * noise : 0);
        return { x, y };
    });

const theme = createTheme();

const data: ChartDataProps = {
    datasets: [
        {
            label: "Sine",
            data: makeSine(200, 0.1, 0),
            borderColor: "#1976d2",
            backgroundColor: "rgba(25,118,210,0.15)",
            pointRadius: 0,
            borderWidth: 2,
            type: "line",
            showLine: true
        },
        {
            label: "Sine (noisy)",
            data: makeSine(200, 0.1, 0.3),
            borderColor: "#9c27b0",
            backgroundColor: "rgba(156,39,176,0.15)",
            pointRadius: 0,
            borderWidth: 2,
            type: "line",
            showLine: true
        }
    ]
};

const options: ChartOptions<"line"> = {
    plugins: {
        title: { display: true, text: "Graph demo" }
    },
    scales: {
        x: { type: "linear", title: { display: true, text: "X" } },
        y: { title: { display: true, text: "Y" } }
    }
};

export default function GraphDemo() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Stack spacing={2}>
                    <Typography variant="h5">Graph component demo</Typography>
                    <Paper elevation={3} sx={{ p: 2 }}>
                        <Graph data={data} options={options} style={{ height: 420 }} />
                    </Paper>
                </Stack>
            </Container>
        </ThemeProvider>
    );
}
