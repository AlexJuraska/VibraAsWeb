import React from "react";
import Button from "@mui/material/Button";
import {Box} from "@mui/material";
import {pause, play, subscribe} from "../state/startStopBus";
import {getBreakpoint, subscribeBreakpoint} from "../../../state/breakpointBus";

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

    const [bp, setBp] = React.useState(getBreakpoint());

    React.useEffect(() => {
        return subscribeBreakpoint(setBp);
    }, []);

    return (
        <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <Button id={id}
                    variant="contained"
                    color={running ? "error" : "primary"}
                    size={bp}
                    onClick={handleClick}
                    sx={{ width}}>
                {running ? "Stop Sound" : "Start Sound"}
            </Button>
        </Box>
    );
};

export default StartStopButton;