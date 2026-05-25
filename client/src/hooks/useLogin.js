import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate} from "react-router-dom";
import { getToken } from "../services/authService";
import { getCustomerSubscription } from "../services/paymentService";
import { getMyOrganizations } from "../services/organizationService";
import { parseJwt } from "../utils/common";
import { isValidReturnUrl, buildAuthenticatedReturnUrl } from "../utils/authUtils";
import { registerSession } from "../services/sessionService";
import http from "../utils/axios/http";

// Helper: check subscription or org membership before redirecting
const checkSubscriptionOrOrg = async (userIdFromToken, navigate) => {
  try {
    const subscriptionResponse = await getCustomerSubscription({ userId: userIdFromToken });
    if (subscriptionResponse.data.hasSubscription && subscriptionResponse.data.priceId) {
      navigate("/admin/home");
      return;
    }
  } catch (e) { /* no subscription */ }

  // No individual subscription — check if user is part of an org
  try {
    const myOrgsRes = await getMyOrganizations();
    const orgs = myOrgsRes?.data?.organizations || myOrgsRes?.data || [];
    if (orgs.length > 0) {
      navigate("/admin/home");
      return;
    }
  } catch (e) { /* no org */ }

  // No subscription and no org — go to subscription page
  navigate("/subscription");
};

const useLogin = () => {
  const navigate = useNavigate();
  const [invalid, setInvalid] = useState({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [returnUrl, setReturnUrl] = useState(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSession, setMfaSession] = useState(null);
  const [mfaUsername, setMfaUsername] = useState(null);
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  // Extract returnUrl from query parameters on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedReturnUrl = params.get('returnUrl');
    if (encodedReturnUrl) {
      try {
        const decodedReturnUrl = decodeURIComponent(encodedReturnUrl);
        setReturnUrl(decodedReturnUrl);
        console.log('📍 Return URL detected:', decodedReturnUrl);
      } catch (error) {
        console.error('Failed to decode returnUrl:', error);
      }
    }
  }, []);

  const goToPasswordRecovery = () => {
    navigate("/password-recovery");
  };

  const handleUsername = (value) => {
    if (invalid.username) {
      setInvalid({ ...invalid, username: undefined });
    }
    setUsername(value);
  };

  const handlePassword = (value) => {
    if (invalid.password) {
      setInvalid({ ...invalid, password: undefined });
    }
    setPassword(value);
  };

  const handleLogin = async () => {
    if (isLoading) {
      return;
    }

    const _invalid = {
      username: username.trim() ? undefined : "Please enter your email or username",
      password: password ? undefined : "Please enter your password",
    };

    if (_invalid.username || _invalid.password) {
      return setInvalid(_invalid);
    }

    try {
      setIsLoading(true);
      let res = await getToken({ username: username.trim(), password: password });

      // Check if password change is required
      if (res.challengeName === 'NEW_PASSWORD_REQUIRED') {
        console.log('🔐 Password change required - redirecting to change password page');
        
        // Store challenge data in sessionStorage
        sessionStorage.setItem('passwordChallenge', JSON.stringify({
          username: res.username,
          session: res.session,
          challengeParameters: res.challengeParameters
        }));
        
        // Redirect to change password page with returnUrl if present
        if (returnUrl) {
          navigate(`/change-password?returnUrl=${encodeURIComponent(returnUrl)}`);
        } else {
          navigate('/change-password');
        }
        return;
      }

      // Check if MFA is required
      if (res.challengeName === 'SOFTWARE_TOKEN_MFA') {
        console.log('🔐 MFA required - showing code input');
        setMfaRequired(true);
        setMfaSession(res.session);
        setMfaUsername(res.username);
        setIsLoading(false);
        return;
      }

      localStorage.setItem("refToken", res.RefreshToken);
      localStorage.setItem("idToken", res.IdToken);
      localStorage.setItem("accessToken", res.AccessToken);
      localStorage.setItem("username", username.trim());
      toast.success("Welcome!");

      // Parse the full JWT payload to get user info
      const token = res.IdToken;
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      const tokenPayload = JSON.parse(jsonPayload);
      
      // Extract userId - try custom:user_id first, then sub (Cognito user ID), then email
      // FIX v2: Properly extract userId from JWT payload (not calling .sub on string)
      const userIdFromToken = tokenPayload["custom:user_id"] || tokenPayload.sub || tokenPayload.email || username.trim();
      console.log('🔑 [useLogin v2] Extracted userId from token:', userIdFromToken, 'type:', typeof userIdFromToken);

      // Register session for security tracking (non-blocking)
      registerSession(userIdFromToken).catch(() => {});

      // Check if user is a team member (verifier role) — check from org membership, not Cognito attribute
      const userRole = tokenPayload["custom:role"];
      const cognitoGroups = tokenPayload["cognito:groups"] || [];
      // Only treat as verifier if custom:role is set AND they're not in an org group
      const isInOrg = cognitoGroups.some(g => g.startsWith('org-'));
      const isTeamMember = (userRole === "verifier" || userRole === "scanner") && !isInOrg;
      
      console.log('👤 User role:', userRole, 'isTeamMember:', isTeamMember, 'isInOrg:', isInOrg);

      // If returnUrl exists, validate and redirect there with auth parameters
      if (returnUrl) {
        // Validate returnUrl to prevent open redirect attacks
        if (!isValidReturnUrl(returnUrl)) {
          console.error('❌ Invalid returnUrl - redirecting to dashboard');
          toast.warning("Invalid return URL - redirecting to dashboard");
          navigate("/admin/home");
          return;
        }
        
        // Build authenticated URL with token and userId
        const authenticatedUrl = buildAuthenticatedReturnUrl(returnUrl, token, userIdFromToken);
        
        console.log('🔐 Redirecting to verification with auth:', authenticatedUrl);
        window.location.href = authenticatedUrl;
        return; // CRITICAL: Stop execution here to prevent subscription check
      } else {
        // Team members (verifiers/scanners) should always go to verify.keeptabs.app
        if (isTeamMember) {
          console.log("Team member login - redirecting to verify.keeptabs.app");
          const verifyUrl = `https://verify.keeptabs.app?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userIdFromToken)}`;
          window.location.href = verifyUrl;
          return;
        }

        // Check subscription or org membership
        await checkSubscriptionOrOrg(userIdFromToken, navigate);
      }
    } catch (error) {
      // Distinguish network errors from authentication errors
      const errorMsg = error.message || '';
      if (!navigator.onLine || errorMsg.includes('Network Error') || errorMsg.includes('ERR_INTERNET_DISCONNECTED') || errorMsg.includes('Failed to fetch')) {
        toast.error("Unable to connect. Please check your internet connection and try again.");
      } else {
        toast.error("Invalid user and/or password");
      }
      console.error("Login failed:", error);
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    try {
      setIsLoading(true);
      const response = await http.post("auth/mfa-verify-login", {
        session: mfaSession,
        username: mfaUsername,
        code: mfaCode,
      });
      const res = response.data;

      // MFA verified — now we have tokens
      localStorage.setItem("refToken", res.RefreshToken);
      localStorage.setItem("idToken", res.IdToken);
      localStorage.setItem("accessToken", res.AccessToken);
      localStorage.setItem("username", username.trim());

      setMfaRequired(false);
      toast.success("Welcome!");

      // Continue with normal post-login flow
      const token = res.IdToken;
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      );
      const tokenPayload = JSON.parse(jsonPayload);
      const userIdFromToken = tokenPayload["custom:user_id"] || tokenPayload.sub || tokenPayload.email || username.trim();

      // Register session
      registerSession(userIdFromToken).catch(() => {});

      // Check subscription or org membership
      await checkSubscriptionOrOrg(userIdFromToken, navigate);
    } catch (error) {
      const msg = error.response?.data?.error || "Invalid code. Please try again.";
      toast.error(msg);
      if (msg.includes('expired') || msg.includes('Session')) {
        setMfaRequired(false);
        setMfaCode("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaCodeChange = (value) => {
    setMfaCode(value.replace(/[^0-9]/g, '').slice(0, 6));
  };

  const handleShowBackupCode = () => {
    setShowBackupCode(true);
  };

  const handleBackToMfa = () => {
    setShowBackupCode(false);
    setBackupCode("");
  };

  const handleBackupCodeChange = (value) => {
    setBackupCode(value);
  };

  const handleBackupCodeVerify = async () => {
    if (!backupCode.trim()) {
      toast.error("Please enter your backup code");
      return;
    }
    // Use the backup code as the MFA code (Cognito accepts it the same way)
    // For now, attempt to verify with the backup code as if it were a TOTP code
    try {
      setIsLoading(true);
      const response = await http.post("auth/mfa-verify-login", {
        session: mfaSession,
        username: mfaUsername,
        code: backupCode.trim(),
      });
      const res = response.data;

      localStorage.setItem("refToken", res.RefreshToken);
      localStorage.setItem("idToken", res.IdToken);
      localStorage.setItem("accessToken", res.AccessToken);
      localStorage.setItem("username", username.trim());

      setMfaRequired(false);
      setShowBackupCode(false);
      toast.success("Welcome!");

      const token = res.IdToken;
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      );
      const tokenPayload = JSON.parse(jsonPayload);
      const userIdFromToken = tokenPayload["custom:user_id"] || tokenPayload.sub || tokenPayload.email || username.trim();

      registerSession(userIdFromToken).catch(() => {});

      await checkSubscriptionOrOrg(userIdFromToken, navigate);
    } catch (error) {
      const msg = error.response?.data?.error || "Invalid backup code.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToSignIn = () => {
    setMfaRequired(false);
    setShowBackupCode(false);
    setMfaCode("");
    setBackupCode("");
  };

  const handleSignUp = () => {
    navigate("/register");
  };

  return {
    username,
    password,
    invalid,
    isLoading,
    mfaRequired,
    mfaCode,
    showBackupCode,
    backupCode,
    handleMfaCodeChange,
    handleMfaVerify,
    handleShowBackupCode,
    handleBackToMfa,
    handleBackupCodeChange,
    handleBackupCodeVerify,
    handleReturnToSignIn,
    goToPasswordRecovery,
    handleUsername,
    handlePassword,
    handleLogin,
    handleSignUp,
  };
};

export default useLogin;
