import React from "react";
import { Box, Typography, Button } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { hasValidSession, buildLoginUrl } from "../utils/auth/session";

const ACCENT = "#F09925";

/**
 * ErrorBoundary — catches render/lifecycle crashes in lazy-loaded routes.
 *
 * Without this, any thrown error inside a page unmounted the tree and left a
 * blank white screen with no indication of what went wrong. When the crash
 * coincides with a dead session we send the user to login instead.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error("Unknown error") };
  }

  componentDidCatch(error, info) {
    console.error("Route crashed:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A crash while the session is gone is almost always a downstream symptom.
    if (!hasValidSession()) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1D1B20", mb: 1 }}>
            Your session expired
          </Typography>
          <Typography sx={{ color: "#71727A", mb: 3, maxWidth: 420, lineHeight: 1.6 }}>
            Sign in again to pick up where you left off.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => window.location.replace(buildLoginUrl())}
            sx={{ background: ACCENT, textTransform: "none", fontWeight: 700, px: 4, py: 1.5, borderRadius: 2, "&:hover": { background: "#D4820F" } }}
          >
            Sign in
          </Button>
        </Box>
      );
    }

    // A failed lazy() chunk fetch usually means a stale build is cached.
    const message = error?.message || String(error);
    const isChunkError = /loading chunk|dynamically imported module|failed to fetch/i.test(message);

    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", p: 4 }}>
        <ErrorOutlineIcon sx={{ fontSize: 56, color: ACCENT, mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1D1B20", mb: 1 }}>
          {isChunkError ? "This page failed to load" : "Something went wrong on this page"}
        </Typography>
        <Typography sx={{ color: "#71727A", mb: 3, maxWidth: 480, lineHeight: 1.6 }}>
          {isChunkError
            ? "A newer version of the app is available. Reload to get it."
            : message}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            sx={{ background: ACCENT, textTransform: "none", fontWeight: 700, px: 3, py: 1.25, borderRadius: 2, "&:hover": { background: "#D4820F" } }}
          >
            Reload
          </Button>
          <Button
            variant="outlined"
            onClick={() => { this.setState({ error: null }); window.location.assign("/admin/home"); }}
            sx={{ textTransform: "none", fontWeight: 700, px: 3, py: 1.25, borderRadius: 2 }}
          >
            Go to Home
          </Button>
        </Box>
      </Box>
    );
  }
}

export default ErrorBoundary;
