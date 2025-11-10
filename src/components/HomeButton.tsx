import React, { Suspense } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import HomeIcon from "@mui/icons-material/Home";
import {useTheme} from "@mui/material";

interface HomeButtonProps {
    to: string;
    color?: "inherit" | "primary" | "secondary" | "success" | "error" | "info" | "warning";
}

const HomeButton: React.FC<HomeButtonProps> = ({
                                                 to,
                                                 color = "primary",
                                             }) => {
    const navigate = useNavigate();

    const theme = useTheme();

    return (
        <Button
            variant={"contained"}
            color={color}
            onClick={() => navigate(to)}
            sx={{
                minWidth: 48,
                width: "100%",
                height: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "12px",
            }}
        >
            <Suspense fallback={null}>
                <HomeIcon />
            </Suspense>
        </Button>
    );
};


export default HomeButton;