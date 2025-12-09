import React from "react";
import Button from "@mui/material/Button";
import {Box} from "@mui/material";
import {pause, play, subscribe} from "../state/startStopBus";
import {color} from "chart.js/helpers";

type Props = {
    id?: string;
    width?: string | number;
};

const StartStopButton: React.FC<Props> = ({ id = "startStopBtn", width = "50%"}) => {
    const [running, setRunning] = React.useState<boolean>(false);

    React.useEffect(() => {
        return subscribe(setRunning);
    }, []);

    const handleClick = () => {
        if (running) pause();
        else play();
    };

    return (
        <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <Button id={id}
                    variant="contained"
                    size="large"
                    color={running ? "error" : "primary"}
                    onClick={handleClick}
                    sx={{ width}}>
                {running ? "Stop Sound" : "Start Sound"}
            </Button>
        </Box>
    );
};

export default StartStopButton;