import React from "react";
import { Box } from "@mui/material";

interface ColorBlockProps {
    color?: string;
}

const ColorBlock: React.FC<ColorBlockProps> = ({ color = "#ccc" }) => {
    return (
        <Box
            sx={{
                backgroundColor: color,
                width: "100%",
                height: "100%",
                display: "flex",
            }}
        >
        </Box>
    );
};

export default ColorBlock