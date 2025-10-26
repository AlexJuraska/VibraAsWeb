import React from "react";
import {Box, Typography} from "@mui/material";

interface ColorBlockProps {
    color?: string;
    label?: string;
}

const ColorBlock: React.FC<ColorBlockProps> = ({ color = "#ccc", label = "text" }) => {
    return (
        <Box
            sx={{
                backgroundColor: color,
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            }}
        >
            <Typography variant="body1" component="div">{label}</Typography>
        </Box>
    );
};

export default ColorBlock