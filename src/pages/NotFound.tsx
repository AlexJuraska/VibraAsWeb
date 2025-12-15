import {Box, Typography} from "@mui/material";
import { useTranslation } from "../i18n/i18n";

function NotFound() {
    const { t } = useTranslation();
    return (
        <Box display="flex" flexDirection="column" gap={4}>
            <Typography variant="h5" component="div">{t("notFound.notFound", "Page not found")}</Typography>
        </Box>
    );
}

export default NotFound;