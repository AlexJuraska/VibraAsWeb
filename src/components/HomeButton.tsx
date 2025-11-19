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
            sx={(theme) => ({
                height: 60,
                width: "100%",
                maxWidth: `calc(100% - 2 * ${theme.spacing(1)})`,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "12px",
                margin: theme.spacing(1),
            })}
        >
            <Suspense fallback={null}>
                <HomeIcon />
            </Suspense>
        </Button>
    );
};


export default HomeButton;