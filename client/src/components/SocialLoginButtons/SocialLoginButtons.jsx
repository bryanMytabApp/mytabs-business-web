import React, { useState, useCallback } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import {
  GOOGLE_CLIENT_ID,
  signInWithGoogle,
  signInWithApple,
  signInWithFacebook,
} from "../../services/webSocialAuth";

/**
 * AppleIcon — inline Apple logo SVG for the "Continue with Apple" button.
 */
const AppleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 17 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M13.312 10.563c-.02-2.078 1.696-3.076 1.773-3.124-0.965-1.412-2.467-1.605-3.003-1.627-1.278-.13-2.495.753-3.144.753-.648 0-1.652-.733-2.715-.714-1.397.02-2.685.812-3.404 2.064-1.451 2.518-.371 6.25 1.043 8.295.691 1 1.515 2.123 2.598 2.083 1.042-.042 1.436-.674 2.695-.674 1.26 0 1.613.674 2.714.653 1.122-.02 1.833-1.02 2.52-2.024.794-1.16 1.122-2.284 1.142-2.343-.025-.01-2.19-.84-2.21-3.333zM11.223 3.997c.574-.696.962-1.662.856-2.625-.827.034-1.83.551-2.424 1.247-.532.616-.998 1.6-.873 2.544.923.072 1.865-.469 2.441-1.166z" />
  </svg>
);

/**
 * FacebookIcon — inline Facebook "f" logo SVG for the "Continue with Facebook" button.
 */
const FacebookIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="#FFFFFF"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

/**
 * SocialLoginButtons — renders Google, Apple, and Facebook sign-in buttons
 * for the keeptabs.app web login page.
 *
 * All flows use popup window (user stays on keeptabs.app tab).
 * No phone/SMS button — that's mobile-only per requirement 25.10.
 *
 * @param {object} props
 * @param {function} props.onSuccess - Called with auth response data on successful sign-in
 * @param {function} props.onError - Called with error object on sign-in failure
 * @param {boolean} props.disabled - Externally disable all buttons
 * @param {boolean} props.loading - External loading state
 */
export default function SocialLoginButtons({
  onSuccess = () => {},
  onError = () => {},
  disabled = false,
  loading = false,
}) {
  const [activeProvider, setActiveProvider] = useState(null);

  const isAuthInProgress = activeProvider !== null || loading;

  /**
   * Handle successful Google credential response from GoogleLogin component.
   */
  const handleGoogleSuccess = useCallback(
    async (credentialResponse) => {
      setActiveProvider("google");
      try {
        const data = await signInWithGoogle(credentialResponse.credential);
        onSuccess(data);
      } catch (error) {
        onError(error);
      } finally {
        setActiveProvider(null);
      }
    },
    [onSuccess, onError]
  );

  /**
   * Handle Google sign-in error (popup closed or other failure).
   */
  const handleGoogleError = useCallback(() => {
    onError(new Error("Google sign-in was cancelled or failed."));
  }, [onError]);

  /**
   * Handle Apple sign-in via popup.
   */
  const handleAppleClick = useCallback(async () => {
    if (isAuthInProgress || disabled) return;
    setActiveProvider("apple");
    try {
      const data = await signInWithApple();
      onSuccess(data);
    } catch (error) {
      if (error.code !== "CANCELLED") {
        onError(error);
      }
    } finally {
      setActiveProvider(null);
    }
  }, [isAuthInProgress, disabled, onSuccess, onError]);

  /**
   * Handle Facebook sign-in via popup.
   */
  const handleFacebookClick = useCallback(async () => {
    if (isAuthInProgress || disabled) return;
    setActiveProvider("facebook");
    try {
      const data = await signInWithFacebook();
      onSuccess(data);
    } catch (error) {
      if (error.code !== "CANCELLED") {
        onError(error);
      }
    } finally {
      setActiveProvider(null);
    }
  }, [isAuthInProgress, disabled, onSuccess, onError]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          width: "100%",
        }}
      >
        {/* Google — uses @react-oauth/google's GoogleLogin component (renders its own button) */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            opacity: isAuthInProgress && activeProvider !== "google" ? 0.6 : 1,
            pointerEvents: disabled || isAuthInProgress ? "none" : "auto",
          }}
        >
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false}
            type="standard"
            theme="outline"
            size="large"
            text="continue_with"
            shape="rectangular"
            width="100%"
            logo_alignment="left"
          />
          {activeProvider === "google" && (
            <CircularProgress
              size={20}
              sx={{
                position: "absolute",
                right: 16,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#4285F4",
              }}
            />
          )}
        </Box>

        {/* Apple — custom styled button (black background, white text per Apple guidelines) */}
        <Button
          fullWidth
          variant="contained"
          disabled={disabled || isAuthInProgress}
          onClick={handleAppleClick}
          startIcon={
            activeProvider === "apple" ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              <AppleIcon />
            )
          }
          sx={{
            backgroundColor: "#000",
            color: "#fff",
            textTransform: "none",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            borderRadius: "4px",
            height: 40,
            "&:hover": {
              backgroundColor: "#1a1a1a",
            },
            "&:disabled": {
              backgroundColor: "#000",
              color: "rgba(255, 255, 255, 0.6)",
              opacity: 0.6,
            },
          }}
        >
          Continue with Apple
        </Button>

        {/* Facebook — custom styled button (blue #1877F2 background per Meta guidelines) */}
        <Button
          fullWidth
          variant="contained"
          disabled={disabled || isAuthInProgress}
          onClick={handleFacebookClick}
          startIcon={
            activeProvider === "facebook" ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              <FacebookIcon />
            )
          }
          sx={{
            backgroundColor: "#1877F2",
            color: "#fff",
            textTransform: "none",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            borderRadius: "4px",
            height: 40,
            "&:hover": {
              backgroundColor: "#166FE5",
            },
            "&:disabled": {
              backgroundColor: "#1877F2",
              color: "rgba(255, 255, 255, 0.6)",
              opacity: 0.6,
            },
          }}
        >
          Continue with Facebook
        </Button>
      </Box>
    </GoogleOAuthProvider>
  );
}
