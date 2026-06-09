import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Alert,
} from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import GoogleIcon from "@mui/icons-material/Google";
import AppleIcon from "@mui/icons-material/Apple";
import FacebookIcon from "@mui/icons-material/Facebook";
import { toast } from "react-toastify";
import http from "../../utils/axios/http";
import {
  GOOGLE_CLIENT_ID,
  APPLE_CLIENT_ID,
  FACEBOOK_APP_ID,
} from "../../services/webSocialAuth";

/**
 * Provider metadata for display and OAuth flows.
 */
const PROVIDERS = [
  {
    id: "google",
    label: "Google",
    icon: <GoogleIcon />,
    color: "#4285F4",
  },
  {
    id: "apple",
    label: "Apple",
    icon: <AppleIcon />,
    color: "#000000",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: <FacebookIcon />,
    color: "#1877F2",
  },
];

/**
 * LinkedAccountsView — Settings page showing linked social providers
 * with link/unlink functionality for the keeptabs.app web portal.
 *
 * Uses /authWeb/ prefixed endpoints for web-specific auth operations.
 */
export default function LinkedAccountsView() {
  const [linkedProviders, setLinkedProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [unlinkDialog, setUnlinkDialog] = useState({ open: false, provider: null });
  const [error, setError] = useState(null);

  /**
   * Fetch currently linked providers on mount.
   */
  const fetchLinkedProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await http.get("authWeb/linked-providers");
      setLinkedProviders(response.data.providers || []);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to load linked accounts.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinkedProviders();
  }, [fetchLinkedProviders]);

  /**
   * Get Google credential via popup using the Google Identity Services API.
   * Returns the id_token (credential) string.
   */
  const getGoogleCredential = () => {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.id) {
        // Load the GIS script dynamically
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = () => {
          initGoogleAndPrompt(resolve, reject);
        };
        script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
        document.head.appendChild(script);
      } else {
        initGoogleAndPrompt(resolve, reject);
      }
    });
  };

  const initGoogleAndPrompt = (resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response.credential) {
          resolve(response.credential);
        } else {
          reject(new Error("No credential received from Google."));
        }
      },
      cancel_on_tap_outside: false,
    });
    // Use prompt() to show the One Tap or popup
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: render a hidden button and click it
        const btn = document.createElement("div");
        btn.id = "g_id_signin_link";
        btn.style.display = "none";
        document.body.appendChild(btn);
        window.google.accounts.id.renderButton(btn, {
          type: "standard",
          size: "large",
        });
        // Try clicking the rendered button
        const inner = btn.querySelector('[role="button"]') || btn.firstChild;
        if (inner) {
          inner.click();
        } else {
          document.body.removeChild(btn);
          reject(new Error("Google sign-in popup could not be displayed."));
        }
        // Clean up
        setTimeout(() => {
          if (document.body.contains(btn)) {
            document.body.removeChild(btn);
          }
        }, 60000);
      }
    });
  };

  /**
   * Get Apple credential via popup using Apple JS SDK.
   * Returns the id_token string from Apple's authorization response.
   */
  const getAppleCredential = async () => {
    // Load Apple SDK if not present
    if (!window.AppleID) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Apple Sign-In SDK."));
        document.head.appendChild(script);
      });
    }

    window.AppleID.auth.init({
      clientId: APPLE_CLIENT_ID,
      scope: "name email",
      redirectURI: window.location.origin + "/auth/apple/callback",
      usePopup: true,
    });

    const appleResponse = await window.AppleID.auth.signIn();
    const idToken = appleResponse?.authorization?.id_token;
    if (!idToken) {
      throw new Error("No identity token received from Apple.");
    }
    return idToken;
  };

  /**
   * Get Facebook credential via popup using Facebook JS SDK.
   * Returns the access token string.
   */
  const getFacebookCredential = async () => {
    // Load Facebook SDK if not present
    if (!window.FB) {
      await new Promise((resolve, reject) => {
        window.fbAsyncInit = () => {
          window.FB.init({
            appId: FACEBOOK_APP_ID,
            cookie: true,
            xfbml: false,
            version: "v19.0",
          });
          resolve();
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        script.onerror = () => reject(new Error("Failed to load Facebook SDK."));
        document.head.appendChild(script);
      });
    }

    const fbResponse = await new Promise((resolve, reject) => {
      window.FB.login(
        (response) => {
          if (response.status === "connected") {
            resolve(response);
          } else {
            reject(new Error("Facebook sign-in was cancelled."));
          }
        },
        { scope: "email,public_profile" }
      );
    });

    const accessToken = fbResponse.authResponse?.accessToken;
    if (!accessToken) {
      throw new Error("No access token received from Facebook.");
    }
    return accessToken;
  };

  /**
   * Initiate linking a provider. Triggers the provider's OAuth popup,
   * obtains the credential/token, then sends to the backend.
   */
  const handleLink = async (providerId) => {
    setActionLoading(providerId);
    try {
      let idToken;

      switch (providerId) {
        case "google":
          idToken = await getGoogleCredential();
          break;
        case "apple":
          idToken = await getAppleCredential();
          break;
        case "facebook":
          idToken = await getFacebookCredential();
          break;
        default:
          throw new Error("Unknown provider.");
      }

      const response = await http.post("authWeb/link-provider", {
        provider: providerId,
        idToken,
      });

      setLinkedProviders(
        response.data.linkedProviders?.map((p) =>
          typeof p === "string" ? { provider: p } : p
        ) || []
      );
      toast.success(`${getProviderLabel(providerId)} linked successfully.`);
    } catch (err) {
      // User cancelled — no error toast
      if (
        err.message?.includes("cancelled") ||
        err.type === "popup_closed_by_user" ||
        err.error === "popup_closed_by_user"
      ) {
        // Silently ignore cancellation
      } else if (err.response?.status === 409) {
        toast.error(
          err.response?.data?.error ||
            `This ${getProviderLabel(providerId)} account is already linked to another user.`
        );
      } else {
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          `Failed to link ${getProviderLabel(providerId)}.`;
        toast.error(message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Open the unlink confirmation dialog.
   */
  const handleUnlinkClick = (providerId) => {
    setUnlinkDialog({ open: true, provider: providerId });
  };

  /**
   * Confirm unlinking a provider.
   */
  const handleUnlinkConfirm = async () => {
    const providerId = unlinkDialog.provider;
    setUnlinkDialog({ open: false, provider: null });
    setActionLoading(providerId);

    try {
      const response = await http.post("authWeb/unlink-provider", {
        provider: providerId,
      });

      setLinkedProviders(
        response.data.linkedProviders?.map((p) =>
          typeof p === "string" ? { provider: p } : p
        ) || []
      );
      toast.success(`${getProviderLabel(providerId)} unlinked.`);
    } catch (err) {
      if (err.response?.status === 400) {
        toast.error(
          err.response?.data?.error ||
            "Cannot remove your only login method. Link another provider first."
        );
      } else {
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          `Failed to unlink ${getProviderLabel(providerId)}.`;
        toast.error(message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Close the unlink dialog without action.
   */
  const handleUnlinkCancel = () => {
    setUnlinkDialog({ open: false, provider: null });
  };

  /**
   * Check if a provider is currently linked.
   */
  const isProviderLinked = (providerId) => {
    return linkedProviders.some((p) => p.provider === providerId);
  };

  /**
   * Get the linked email for a provider (if available).
   */
  const getLinkedEmail = (providerId) => {
    const found = linkedProviders.find((p) => p.provider === providerId);
    return found?.email || null;
  };

  /**
   * Get display label for a provider.
   */
  const getProviderLabel = (providerId) => {
    const found = PROVIDERS.find((p) => p.id === providerId);
    return found?.label || providerId;
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Linked Accounts
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <List disablePadding>
            {PROVIDERS.map((provider, index) => {
              const linked = isProviderLinked(provider.id);
              const email = getLinkedEmail(provider.id);
              const isLoading = actionLoading === provider.id;

              return (
                <ListItem
                  key={provider.id}
                  divider={index < PROVIDERS.length - 1}
                  sx={{ py: 2, px: 3 }}
                >
                  <ListItemIcon sx={{ color: provider.color, minWidth: 40 }}>
                    {provider.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {provider.label}
                        </Typography>
                        {linked && (
                          <Chip
                            label="Linked"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={linked && email ? email : linked ? "Connected" : "Not connected"}
                  />
                  <ListItemSecondaryAction>
                    {isLoading ? (
                      <CircularProgress size={24} />
                    ) : linked ? (
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<LinkOffIcon />}
                        onClick={() => handleUnlinkClick(provider.id)}
                      >
                        Unlink
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() => handleLink(provider.id)}
                        sx={{
                          backgroundColor: provider.color,
                          "&:hover": {
                            backgroundColor: provider.color,
                            opacity: 0.9,
                          },
                        }}
                      >
                        Link
                      </Button>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Link your social accounts to sign in faster. You must keep at least one login method active.
      </Typography>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={unlinkDialog.open} onClose={handleUnlinkCancel}>
        <DialogTitle>Unlink {getProviderLabel(unlinkDialog.provider)}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure? You won't be able to sign in with{" "}
            {getProviderLabel(unlinkDialog.provider)} anymore. Make sure you have another
            login method available.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUnlinkCancel}>Cancel</Button>
          <Button onClick={handleUnlinkConfirm} color="error" variant="contained">
            Unlink
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
