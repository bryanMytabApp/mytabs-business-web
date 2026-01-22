import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate} from "react-router-dom";
import { getToken } from "../services/authService";
import { getCustomerSubscription } from "../services/paymentService";
import { parseJwt } from "../utils/common";
import { isValidReturnUrl, buildAuthenticatedReturnUrl } from "../utils/authUtils";


const useLogin = () => {
  const navigate = useNavigate();
  const [invalid, setInvalid] = useState({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [returnUrl, setReturnUrl] = useState(null);

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

      localStorage.setItem("refToken", res.RefreshToken);
      localStorage.setItem("idToken", res.IdToken);
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
      } else {
        // Skip subscription check for now - allow all users to access
        // TODO: Re-enable subscription enforcement when ready
        console.log("Subscription check disabled - allowing access");
        navigate("/admin/home");
      }
    } catch (error) {
      toast.error("Invalid user and/or password");
      console.error("Login failed:", error);
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    navigate("/register");
  };

  return {
    username,
    password,
    invalid,
    isLoading,
    goToPasswordRecovery,
    handleUsername,
    handlePassword,
    handleLogin,
    handleSignUp,
  };
};

export default useLogin;