import {Box, Card, CardContent, Grid, Typography} from "@mui/material";
import { useNavigate } from "react-router-dom";

function Home() {
    const navigate = useNavigate();

    const experiments = [
        { title: "Chladni's Patterns", path: "/experiments/chladniPatterns" },
        { title: "Graph Test", path: "/components/graphTest" },
    ];

    return (
        <Box display="flex" flexDirection="column" alignItems="center" gap={3} mt={6}>
            <Typography variant="h3">Welcome to VibraAS</Typography>
            <Typography variant="subtitle1" color="text.secondary">
                Choose an experiment to explore
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
                                <Typography variant="h6">{exp.title}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}

export default Home;