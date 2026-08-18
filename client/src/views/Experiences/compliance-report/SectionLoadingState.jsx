import React from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";

const ACCENT = "#F09925";

/**
 * Wraps a report section and displays per-section loading/error states.
 *
 * Props:
 *  - loading (boolean): show loading indicator
 *  - error (string|null): error message to display
 *  - onRetry (function): called when the user clicks "Retry"
 *  - children: section content rendered when not loading and no error
 */
const SectionLoadingState = ({ loading, error, onRetry, children }) => {
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          py: 4,
        }}
      >
        <CircularProgress size={28} sx={{ color: ACCENT }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ mb: 2, borderRadius: 2 }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={onRetry}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return <>{children}</>;
};

export default SectionLoadingState;
