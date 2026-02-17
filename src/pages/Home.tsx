import { Box, Card, CardContent, Grid, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n/i18n";
import LanguageSelector from "../components/LanguageSelector";
import { usePageTitle } from "../hooks/usePageTitle";

export default function Home() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    usePageTitle(undefined, "VibraAS");

    const experiments = [
            { titleKey: "home.experiment_chladni", title: "Chladni's Patterns", path: "/experiments/chladniPatterns" },
            { titleKey: "home.experiment_audio_analysis", title: "Audio Analysis", path: "/experiments/audioAnalysis" },
    ];

    return (
        <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
            <Box
                mt={1}
                mb={2}
                sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "flex-end",
                    px: { xs: 2, lg: 4 },
                    pt: { xs: 2, lg: 3 },
                }}
            >
                <LanguageSelector />
            </Box>
            <Typography variant="h3">{t("home.welcome", "Welcome to VibraAS")}</Typography>
            <Typography variant="subtitle1" color="text.secondary">
                {t("home.choose_experiment", "Choose an experiment to explore")}
            </Typography>

            <Grid container spacing={3} justifyContent="center" maxWidth="md">
                {experiments.map((exp) => (
                    <Grid key={exp.path} size={12}>
                        <Card
                            onClick={() => navigate(exp.path)}
                            sx={{
                                cursor: "pointer",
                                "&:hover": { boxShadow: 6 },
                                height: "100%",
                            }}
                        >
                            <CardContent>
                                <Typography variant="h6">{t(exp.titleKey, exp.title)}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}