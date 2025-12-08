import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import Home from "./pages/Home";
import { Box, CircularProgress } from "@mui/material";
import NotFound from "./pages/NotFound";

const ChladniExp = lazy(() => import("./experiments/chladniPatterns"));
const LaserExp = lazy(() => import("./experiments/laserVibrometer"));
const GraphTest = lazy(() => import("./components/graphTest"));

function App() {
    return (
        <Box display="flex" flexDirection="column" minHeight="100vh">
            <Box flex={1}>
                <Suspense fallback={<CircularProgress />}>
                    <Routes>
                        <Route path="/" element={<Home />} />

                        <Route path="/experiments/chladniPatterns" element={<ChladniExp />} />
                        <Route path="/experiments/laserVibrometer" element={<LaserExp/>} />
                        <Route path="/components/graphTest" element={<GraphTest/>} />
                        <Route path="/404" element={<NotFound />} />
                        <Route path="*" element={<Navigate to="/404" />} />
                    </Routes>
                </Suspense>
            </Box>
        </Box>
    );
}

export default App;