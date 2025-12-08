import React, { Suspense } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import HomeIcon from "@mui/icons-material/Home";

interface HomeButtonProps {
    to: string;
    color?: "inherit" | "primary" | "secondary" | "success" | "error" | "info" | "warning";
}

const HomeButton: React.FC<HomeButtonProps> = ({ to, color = "primary" }) => {
    const navigate = useNavigate();

    return (
        <Button
            variant="contained"
            color={color}
            fullWidth
            startIcon={<HomeIcon />}
            onClick={() => navigate(to)}
        >
            Home
        </Button>
    );
};

export default HomeButton;