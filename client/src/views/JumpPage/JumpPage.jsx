import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Box, Typography, CircularProgress, Button } from "@mui/material";

const APP_STORE_URL = "https://apps.apple.com/us/app/my-tabs-app/id6503323982";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.keeptabs.mytabs&hl=en";
const API_BASE = "https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod";
const REDIRECT_TIMEOUT = 3000; // Show button after 3 seconds if redirect didn't work
const VERSION = "1.0.3"; // Visible version for debugging

/**
 * JumpPage - QR code resolution page.
 * Auto-redirects to the app store. Shows download button only if redirect fails after 3s.
 */
export default function JumpPage() {
  const params = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState(null);
  const [error, setError] = useState(null);
  const [showButtons, setShowButtons] = useState(false);

  const pathPrefix = location.pathname.split("/")[1];
  const code = params.code || params["*"];

  useEffect(() => {
    if (!code || !pathPrefix) {
      setError("Invalid QR code URL");
      setLoading(false);
      return;
    }

    const resolve = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/resolve/${pathPrefix}/${code}`);

        if (response.status === 404) {
          setError("This content is no longer available.");
          setLoading(false);
          return;
        }
        if (response.status >= 500) {
          setError("Something went wrong. Please try again.");
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (data.type === "event" && data.isActive === false) {
          setError("This event is no longer active.");
          setLoading(false);
          return;
        }

        if (data.type === "menu" && !data.menuUrl) {
          setError("This menu is not currently available.");
          setLoading(false);
          return;
        }

        setEntity(data);
        setLoading(false);

        // Store deferred deep link
        try {
          localStorage.setItem("tabs_deferred_deeplink", JSON.stringify({
            type: data.type,
            id: data.businessId || data.eventId || data.menuCode,
            deepLink: data.deepLink,
            timestamp: Date.now(),
          }));
        } catch (e) { /* ignore */ }

        // Auto-redirect to the appropriate store
        autoRedirect();

      } catch (err) {
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
    };

    resolve();
  }, [code, pathPrefix]);

  const autoRedirect = () => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);

    let storeUrl = null;
    if (isIOS) {
      storeUrl = APP_STORE_URL;
    } else if (isAndroid) {
      storeUrl = PLAY_STORE_URL;
    }

    if (storeUrl) {
      // Use replace for immediate redirect (works better in Firefox)
      window.location.replace(storeUrl);
    }

    // If we're still on the page after 3 seconds, the redirect didn't work — show buttons
    setTimeout(() => {
      setShowButtons(true);
    }, REDIRECT_TIMEOUT);
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 2, p: 3 }}>
        <Typography variant="h5" fontWeight={700}>Tabs</Typography>
        <CircularProgress sx={{ color: "#FF5D00" }} />
        <Typography variant="body2" color="text.secondary">Opening your experience...</Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 2, p: 3, textAlign: "center" }}>
        <Typography variant="h5" fontWeight={700}>Tabs</Typography>
        <Typography variant="h6">{error}</Typography>
        <Button variant="contained" href="https://keeptabs.app" sx={{ mt: 2, backgroundColor: "#FF5D00" }}>
          Go to Tabs Homepage
        </Button>
      </Box>
    );
  }

  // Resolved state — show entity name + redirecting message, buttons only after 3s
  const displayName = entity?.name || entity?.eventName || entity?.businessName || entity?.menuLabel || "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 2, p: 3, textAlign: "center" }}>
      <Typography variant="h5" fontWeight={700}>Tabs</Typography>
      {displayName && (
        <Typography variant="h6" fontWeight={600}>{displayName}</Typography>
      )}

      {!showButtons && (
        <>
          <CircularProgress size={24} sx={{ color: "#FF5D00" }} />
          <Typography variant="body2" color="text.secondary">
            Redirecting to app store...
          </Typography>
        </>
      )}

      {showButtons && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
            Download the Tabs app to view this content
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 2, width: "100%", maxWidth: 280 }}>
            <Button
              variant="contained"
              href={APP_STORE_URL}
              sx={{ backgroundColor: "#000", "&:hover": { backgroundColor: "#333" }, textTransform: "none", fontWeight: 600 }}
            >
              Download on App Store
            </Button>
            <Button
              variant="contained"
              href={PLAY_STORE_URL}
              sx={{ backgroundColor: "#1A73E8", "&:hover": { backgroundColor: "#1557B0" }, textTransform: "none", fontWeight: 600 }}
            >
              Get it on Google Play
            </Button>
          </Box>
        </>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ position: "fixed", bottom: 8, right: 8 }}>
        v{VERSION}
      </Typography>
    </Box>
  );
}
