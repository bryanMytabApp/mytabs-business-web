import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import LockIcon from "@mui/icons-material/Lock";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import http from "../../utils/axios/http";
import {
  GOOGLE_CLIENT_ID,
  APPLE_CLIENT_ID,
  FACEBOOK_APP_ID,
} from "../../services/webSocialAuth";

const STEPS = ["Confirm Deletion", "Re-authenticate", "Delete Account"];

/**
 * DeleteAccountView — Settings page for permanent account deletion flow.
 *
 * Flow:
 * 1. User confirms they understand permanent data removal
 * 2. User re-authenticates (password or social provider re-auth)
 * 3. Backend deletes the account
 * 4. Clear localStorage, navigate to login
 *
 * Uses /authWeb/ prefixed endpoints.
 */
export default function DeleteAccountView() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [soleOwnerWarning, setSoleOwnerWarning] = useState(false);

  /**
   * Step 1: User confirms they want to proceed with deletion.
   */
  const handleConfirmProceed = () => {
    setActiveStep(1);
    setError(null);
  };

  /**
   * Re-authenticate with password and proceed to deletion.
   */
  const handlePasswordReAuth = async () => {
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }
    setConfirmDialog(true);
  };

  /**
   * Re-authenticate with a social provider (Google/Apple/Facebook).
   * Opens the provider popup to get a fresh credential as re-auth proof.
   */
  const handleSocialReAuth = async (provider) => {
    setLoading(true);
    setError(null);

    try {
      let reAuthToken;

      switch (provider) {
        case "google":
          reAuthToken = await getGoogleReAuthToken();
          break;
        case "apple":
          reAuthToken = await getAppleReAuthToken();
          break;
        case "facebook":
          reAuthToken = await getFacebookReAuthToken();
          break;
        default:
          throw new Error("Unknown provider.");
      }

      setConfirmDialog(true);
      // Store the token for use in the final deletion call
      setReAuthData({ type: "social", provider, token: reAuthToken });
    } catch (err) {
      if (
        err.message?.includes("cancelled") ||
        err.type === "popup_closed_by_user"
      ) {
        // User cancelled — silent
      } else {
        setError(err.message || "Social re-authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const [reAuthData, setReAuthData] = useState(null);

  /**
   * Final deletion — called after the confirm dialog.
   */
  const handleFinalDelete = async () => {
    setConfirmDialog(false);
    setLoading(true);
    setError(null);

    try {
      const payload = {};

      if (reAuthData?.type === "social") {
        payload.reAuthToken = reAuthData.token;
        payload.provider = reAuthData.provider;
      } else {
        payload.reAuthToken = password;
        payload.type = "password";
      }

      await http.delete("authWeb/delete-account", { data: payload });

      // Clear all local + session state
      localStorage.clear();
      sessionStorage.clear();

      toast.success("Your account has been deleted.");
      navigate("/login");
    } catch (err) {
      if (err.response?.status === 403) {
        // Sole org owner warning
        setSoleOwnerWarning(true);
        setError(
          err.response?.data?.error ||
            "You are the sole owner of an organization. Please transfer ownership or delete the organization before deleting your account."
        );
      } else if (err.response?.status === 401) {
        setError("Re-authentication failed. Please enter the correct password.");
      } else {
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Account deletion failed. Please try again.";
        setError(message);
      }
    } finally {
      setLoading(false);
      setActiveStep(1);
    }
  };

  /**
   * Get a fresh Google credential for re-auth.
   */
  const getGoogleReAuthToken = () => {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.id) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = () => promptGoogle(resolve, reject);
        script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
        document.head.appendChild(script);
      } else {
        promptGoogle(resolve, reject);
      }
    });
  };

  const promptGoogle = (resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response.credential) {
          resolve(response.credential);
        } else {
          reject(new Error("No credential received from Google."));
        }
      },
    });
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error("Google re-auth popup could not be displayed."));
      }
    });
  };

  /**
   * Get a fresh Apple credential for re-auth.
   */
  const getAppleReAuthToken = async () => {
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
   * Get a fresh Facebook credential for re-auth.
   */
  const getFacebookReAuthToken = async () => {
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
            reject(new Error("Facebook re-auth was cancelled."));
          }
        },
        { scope: "email,public_profile", auth_type: "reauthenticate" }
      );
    });

    const accessToken = fbResponse.authResponse?.accessToken;
    if (!accessToken) {
      throw new Error("No access token received from Facebook.");
    }
    return accessToken;
  };

  /**
   * Render Step 0: Confirmation
   */
  const renderConfirmation = () => (
    <Box sx={{ mt: 3 }}>
      <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
          This action is permanent and cannot be undone.
        </Typography>
        <Typography variant="body2">
          Deleting your account will permanently remove:
        </Typography>
        <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
          <li>Your profile information and settings</li>
          <li>All events you have created</li>
          <li>Your ticket purchases and history</li>
          <li>Organization memberships</li>
          <li>All linked social accounts</li>
        </Box>
      </Alert>

      <Button
        variant="contained"
        color="error"
        size="large"
        fullWidth
        startIcon={<DeleteForeverIcon />}
        onClick={handleConfirmProceed}
      >
        I understand, proceed with deletion
      </Button>
    </Box>
  );

  /**
   * Render Step 1: Re-authentication
   */
  const renderReAuth = () => (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body1" sx={{ mb: 2 }}>
        For security, please verify your identity before deleting your account.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {soleOwnerWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You are the sole owner of one or more organizations. Please transfer
          ownership or delete the organization before proceeding.
        </Alert>
      )}

      {/* Password re-auth */}
      <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <LockIcon fontSize="small" /> Re-authenticate with password
        </Typography>
        <TextField
          type="password"
          label="Enter your password"
          variant="outlined"
          size="small"
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter") handlePasswordReAuth();
          }}
        />
        <Button
          variant="contained"
          color="error"
          size="small"
          sx={{ mt: 1.5 }}
          onClick={handlePasswordReAuth}
          disabled={loading || !password.trim()}
        >
          {loading ? <CircularProgress size={20} /> : "Verify & Delete"}
        </Button>
      </Card>

      <Divider sx={{ my: 2 }}>or re-authenticate with</Divider>

      {/* Social re-auth options */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => handleSocialReAuth("google")}
          disabled={loading}
          startIcon={<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSIjRkZDMTA3IiBkPSJNNDMuNjExIDIwLjA4M0g0MlYyMEgyNHY4aDExLjMwM2MtMS42NDkgNC42NTctNi4wOCA4LTExLjMwMyA4LTYuNjI3IDAtMTItNS4zNzMtMTItMTJzNS4zNzMtMTIgMTItMTJjMy4wNTkgMCA1Ljg0MiAxLjE1NCA3Ljk2MSAzLjAzOWw1LjY1Ny01LjY1N0MzNC4wNDYgNi4wNTMgMjkuMjY4IDQgMjQgNCA5LjM3NCA0IDAgMTMuMzc0IDAgMjRzOS4zNzQgMjAgMjAgMjAgMjAtOS4zNzQgMjAtMjBjMC0xLjM0LS4xMzgtMi42NS0uMzg5LTMuOTE3eiIvPjxwYXRoIGZpbGw9IiNGRjNEMDAiIGQ9Ik02LjMwNiAxNC42OTFsNi41NzEgNC44MTlDMTQuNjU1IDE1LjEwOCAxOC45NjEgMTIgMjQgMTJjMy4wNTkgMCA1Ljg0MiAxLjE1NCA3Ljk2MSAzLjAzOWw1LjY1Ny01LjY1N0MzNC4wNDYgNi4wNTMgMjkuMjY4IDQgMjQgNCAxNS4xODIgNCA3LjY1MiA4Ljk1NiA2LjMwNiAxNC42OTF6Ii8+PHBhdGggZmlsbD0iIzRDQUY1MCIgZD0iTTI0IDQ0YzUuMTY2IDAgOS44Ni0xLjk3NyAxMy40MDktNS4xOTJsLTYuMTktNS4yMzhBMTEuOTEgMTEuOTEgMCAwIDEgMjQgMzZjLTUuMjAyIDAtOS42MTktMy4zMTctMTEuMjgzLTcuOTQ2bC02LjUyMiA1LjAyNUM5LjUwNSAzOS4wNTYgMTYuMjI3IDQ0IDI0IDQ0eiIvPjxwYXRoIGZpbGw9IiMxOTc2RDIiIGQ9Ik00My42MTEgMjAuMDgzSDQyVjIwSDI0djhoMTEuMzAzYTEyLjA0IDEyLjA0IDAgMCAxLTQuMDg3IDUuNTcxbC4wMDMtLjAwMiA2LjE5IDUuMjM4QzM2LjQ3MSAzOS44MDEgNDQgMzQgNDQgMjRjMC0xLjM0LS4xMzgtMi42NS0uMzg5LTMuOTE3eiIvPjwvc3ZnPg==" alt="" style={{ width: 18, height: 18 }} />}
        >
          Google
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => handleSocialReAuth("apple")}
          disabled={loading}
          sx={{ color: "#000", borderColor: "#000" }}
        >
          Apple
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => handleSocialReAuth("facebook")}
          disabled={loading}
          sx={{ color: "#1877F2", borderColor: "#1877F2" }}
        >
          Facebook
        </Button>
      </Box>

      <Button
        variant="text"
        sx={{ mt: 3 }}
        onClick={() => {
          setActiveStep(0);
          setError(null);
          setSoleOwnerWarning(false);
        }}
      >
        ← Go Back
      </Button>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600, color: "error.main" }}>
        Delete Account
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Permanently delete your keeptabs account and all associated data.
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Card variant="outlined">
        <CardContent>
          {activeStep === 0 && renderConfirmation()}
          {activeStep === 1 && renderReAuth()}
        </CardContent>
      </Card>

      {/* Final Confirmation Dialog */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>
          Delete your account permanently?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This is your final confirmation. All your data will be permanently
            deleted and cannot be recovered. Are you absolutely sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)}>Cancel</Button>
          <Button
            onClick={handleFinalDelete}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <DeleteForeverIcon />}
          >
            Delete My Account
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
