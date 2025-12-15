import React, {use} from "react";
import Button from "@mui/material/Button";
import {Box} from "@mui/material";
import {pause, play, subscribe} from "../state/startStopBus";
import {color} from "chart.js/helpers";
import {useTranslation} from "../../../i18n/i18n";

type Props = {
    id?: string;
    width?: string | number;
};

const StartStopButton: React.FC<Props> = ({ id = "startStopBtn", width = "50%"}) => {
    const { t } = useTranslation();

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
                {running ? t("experiments.chladni.components.startStop.stop", "Stop Sound") :
                    t("experiments.chladni.components.startStop.start", "Start Sound")}
            </Button>
        </Box>
    );
};

export default StartStopButton;