import React, { Suspense } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
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
        <Tooltip title={t("components.homeButton.tooltip", "Return to the home page")}>
            <Button
                variant="contained"
                color={color}
                fullWidth
                startIcon={<HomeIcon />}
                onClick={() => navigate(to)}
            >
                {t("components.homeButton.label", "Home")}
            </Button>
        </Tooltip>
    );
};

export default HomeButton;