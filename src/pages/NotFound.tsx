import {Box, Typography} from "@mui/material";

function NotFound() {
    return (
        <Box display="flex" flexDirection="column" gap={4}>
            <Typography variant="h5" component="div">Page not found</Typography>
        </Box>
    );
}

export default NotFound;