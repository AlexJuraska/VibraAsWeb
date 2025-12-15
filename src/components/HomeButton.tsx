import React, { Suspense } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import HomeIcon from "@mui/icons-material/Home";
import {useTranslation} from "../i18n/i18n";

interface HomeButtonProps {
    to: string;
    color?: "inherit" | "primary" | "secondary" | "success" | "error" | "info" | "warning";
}

const HomeButton: React.FC<HomeButtonProps> = ({ to, color = "primary" }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <Button
            variant="contained"
            color={color}
            fullWidth
            startIcon={<HomeIcon />}
            onClick={() => navigate(to)}
        >
            {t("components.homeButton", "Home")}
        </Button>
    );
};

export default HomeButton;