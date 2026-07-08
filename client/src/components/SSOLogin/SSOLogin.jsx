import React, { useState, useCallback } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BusinessIcon from "@mui/icons-material/Business";
import { checkSSODomain, ssoAuth } from "../../services/ssoService";

/**
 * SSO Login flow steps:
 * 1. "email" — user enters their organization email
 * 2. "code" — user enters the verification code sent to their email
 */
const STEPS = {
  EMAIL: "email",
  CODE: "code",
};

/**
 * SSOLogin — Organization SSO login component for the web portal.
 *
 * Flow:
 * 1. User enters their organization email address
 * 2. Domain is extracted and checked via GET /authWeb/sso-check
 * 3. If SSO is enabled (email-verification type):
 *    - Backend sends a verification code to the email
 *    - User enters the code
 *    - Backend verifies and returns auth tokens
 * 4. If SSO is not enabled: shows an error message
 *
 * @param {object} props
 * @param {function} props.onSuccess - Called with auth response on successful SSO login
 * @param {function} props.onError - Called with error on SSO failure
 * @param {function} props.onBack - Called when user clicks back to return to main login
 */
export default function SSOLogin({ onSuccess, onError, onBack }) {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Extract domain from email address.
   */
  const getDomain = (emailAddress) => {
    const parts = emailAddress.split("@");
    return parts.length === 2 ? parts[1].toLowerCase() : "";
  };

  /**
   * Handle email submission — check domain and initiate SSO flow.
   */
  const handleEmailSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      setError("");

      const trimmedEmail = email.trim();
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setError("Please enter a valid organization email address.");
        return;
      }

      const domain = getDomain(trimmedEmail);
      if (!domain) {
        setError("Please enter a valid organization email address.");
        return;
      }

      setLoading(true);
      try {
        // Step 1: Check if domain is SSO-enabled
        const ssoConfig = await checkSSODomain(domain);

        if (!ssoConfig.ssoEnabled) {
          setError(
            "No SSO configured for this domain. Please use email/password or social login."
          );
          setLoading(false);
          return;
        }

        // Step 2: For email-verification type, send the verification code
        if (ssoConfig.type === "email-verification") {
          const sendResult = await ssoAuth(trimmedEmail, "send-code");
          setSessionId(sendResult.sessionId);
          setStep(STEPS.CODE);
        } else {
          // For SAML/OIDC, redirect to the auth URL if provided
          if (ssoConfig.authUrl) {
            window.location.href = ssoConfig.authUrl;
          } else {
            setError(
              "SSO configuration is incomplete. Please contact your organization administrator."
            );
          }
        }
      } catch (err) {
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to check SSO configuration. Please try again.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  /**
   * Handle verification code submission — verify code and complete auth.
   */
  const handleCodeSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      setError("");

      const trimmedCode = code.trim();
      if (!trimmedCode || trimmedCode.length < 4) {
        setError("Please enter a valid verification code.");
        return;
      }

      setLoading(true);
      try {
        const data = await ssoAuth(
          email.trim(),
          "verify-code",
          trimmedCode,
          sessionId
        );

        // Store tokens in localStorage (matching existing web auth pattern)
        if (data.IdToken) {
          localStorage.setItem("idToken", data.IdToken);
        }
        if (data.AccessToken) {
          localStorage.setItem("accessToken", data.AccessToken);
        }
        if (data.RefreshToken) {
          localStorage.setItem("refToken", data.RefreshToken);
        }
        if (data.user?.email) {
          localStorage.setItem("username", data.user.email);
        }

        onSuccess(data);
      } catch (err) {
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Verification failed. Please check your code and try again.";
        setError(message);
        if (onError) onError(err);
      } finally {
        setLoading(false);
      }
    },
    [code, email, sessionId, onSuccess, onError]
  );

  /**
   * Handle resending the verification code.
   */
  const handleResendCode = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const sendResult = await ssoAuth(email.trim(), "send-code");
      setSessionId(sendResult.sessionId);
      setCode("");
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to resend code. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  /**
   * Navigate back — either to email step from code step, or to main login.
   */
  const handleBack = () => {
    if (step === STEPS.CODE) {
      setStep(STEPS.EMAIL);
      setCode("");
      setSessionId(null);
      setError("");
    } else {
      onBack();
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: "100%",
      }}
    >
      {/* Header with back button */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton onClick={handleBack} size="small" aria-label="Go back">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <BusinessIcon sx={{ color: "#5C6BC0", fontSize: 20 }} />
        <Typography
          variant="subtitle1"
          sx={{
            fontFamily: "Outfit, sans-serif",
            fontWeight: 600,
            color: "#2C2C2C",
            fontSize: "16px",
          }}
        >
          Organization SSO
        </Typography>
      </Box>

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ fontSize: "13px" }}>
          {error}
        </Alert>
      )}

      {/* Step 1: Email input */}
      {step === STEPS.EMAIL && (
        <form onSubmit={handleEmailSubmit}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "Outfit, sans-serif",
                color: "#555",
                fontSize: "13px",
              }}
            >
              Enter your organization email to sign in via SSO.
            </Typography>
            <TextField
              fullWidth
              type="email"
              placeholder="you@your-organization.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              size="small"
              autoFocus
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  fontFamily: "Outfit, sans-serif",
                  fontSize: "14px",
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading || !email.trim()}
              sx={{
                backgroundColor: "#5C6BC0",
                color: "#fff",
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 500,
                fontFamily: "Outfit, sans-serif",
                borderRadius: "8px",
                height: 40,
                "&:hover": {
                  backgroundColor: "#4a5ab5",
                },
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: "#fff" }} />
              ) : (
                "Continue"
              )}
            </Button>
          </Box>
        </form>
      )}

      {/* Step 2: Verification code input */}
      {step === STEPS.CODE && (
        <form onSubmit={handleCodeSubmit}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "Outfit, sans-serif",
                color: "#555",
                fontSize: "13px",
              }}
            >
              We sent a verification code to <strong>{email.trim()}</strong>.
              Enter it below to sign in.
            </Typography>
            <TextField
              fullWidth
              type="text"
              placeholder="Enter verification code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={loading}
              size="small"
              autoFocus
              inputProps={{ maxLength: 8 }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  fontFamily: "Outfit, sans-serif",
                  fontSize: "14px",
                  letterSpacing: "2px",
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading || !code.trim()}
              sx={{
                backgroundColor: "#5C6BC0",
                color: "#fff",
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 500,
                fontFamily: "Outfit, sans-serif",
                borderRadius: "8px",
                height: 40,
                "&:hover": {
                  backgroundColor: "#4a5ab5",
                },
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: "#fff" }} />
              ) : (
                "Verify & Sign In"
              )}
            </Button>
            <Typography
              variant="body2"
              onClick={loading ? undefined : handleResendCode}
              sx={{
                fontFamily: "Outfit, sans-serif",
                color: "#5C6BC0",
                fontSize: "13px",
                textAlign: "center",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.5 : 1,
                "&:hover": {
                  textDecoration: loading ? "none" : "underline",
                },
              }}
            >
              Didn't receive a code? Resend
            </Typography>
          </Box>
        </form>
      )}
    </Box>
  );
}
