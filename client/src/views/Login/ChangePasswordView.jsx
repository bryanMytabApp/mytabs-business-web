import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import logo from "../../assets/logo.png";
import { MTBButton, MTBInput } from "../../components/";
import { changePassword, completeNewPasswordChallenge } from "../../services/authService";
import "./ChangePasswordView.css";

export default function ChangePasswordView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invalid, setInvalid] = useState({});
  const [returnUrl, setReturnUrl] = useState(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [challengeData, setChallengeData] = useState(null);

  useEffect(() => {
    // Check if this is a forced password change (NEW_PASSWORD_REQUIRED challenge)
    const storedChallenge = sessionStorage.getItem('passwordChallenge');
    if (storedChallenge) {
      try {
        const challenge = JSON.parse(storedChallenge);
        setChallengeData(challenge);
        setIsFirstLogin(true);
        console.log('🔐 First login detected - password change required');
      } catch (error) {
        console.error('Failed to parse password challenge:', error);
      }
    } else {
      // Regular password change - check if user is logged in
      const idToken = localStorage.getItem("idToken");
      if (!idToken) {
        toast.error("Please log in first");
        navigate("/login");
        return;
      }
    }

    // Extract returnUrl from query parameters
    const params = new URLSearchParams(location.search);
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
  }, [navigate, location]);

  const handleOldPassword = (value) => {
    if (invalid.oldPassword) {
      setInvalid({ ...invalid, oldPassword: undefined });
    }
    setOldPassword(value);
  };

  const handleNewPassword = (value) => {
    if (invalid.newPassword) {
      setInvalid({ ...invalid, newPassword: undefined });
    }
    setNewPassword(value);
  };

  const handleConfirmPassword = (value) => {
    if (invalid.confirmPassword) {
      setInvalid({ ...invalid, confirmPassword: undefined });
    }
    setConfirmPassword(value);
  };

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);

    if (password.length < minLength) {
      return "Password must be at least 8 characters long";
    }
    if (!hasUpperCase) {
      return "Password must contain at least one uppercase letter";
    }
    if (!hasLowerCase) {
      return "Password must contain at least one lowercase letter";
    }
    if (!hasNumber) {
      return "Password must contain at least one number";
    }
    if (!hasSpecialChar) {
      return "Password must contain at least one special character (!@#$%^&*)";
    }
    return null;
  };

  const handleChangePassword = async () => {
    if (isLoading) {
      return;
    }

    // Validation for first login (no old password needed)
    if (isFirstLogin) {
      const _invalid = {
        newPassword: newPassword ? validatePassword(newPassword) : "Please enter a new password",
        confirmPassword: !confirmPassword
          ? "Please confirm your new password"
          : confirmPassword !== newPassword
          ? "Passwords do not match"
          : undefined,
      };

      if (_invalid.newPassword || _invalid.confirmPassword) {
        return setInvalid(_invalid);
      }
    } else {
      // Validation for regular password change
      const _invalid = {
        oldPassword: oldPassword ? undefined : "Please enter your current password",
        newPassword: newPassword ? validatePassword(newPassword) : "Please enter a new password",
        confirmPassword: !confirmPassword
          ? "Please confirm your new password"
          : confirmPassword !== newPassword
          ? "Passwords do not match"
          : undefined,
      };

      if (_invalid.oldPassword || _invalid.newPassword || _invalid.confirmPassword) {
        return setInvalid(_invalid);
      }
    }

    try {
      setIsLoading(true);

      if (isFirstLogin && challengeData) {
        // Complete NEW_PASSWORD_REQUIRED challenge
        const result = await completeNewPasswordChallenge({
          username: challengeData.username,
          newPassword: newPassword,
          session: challengeData.session
        });

        // Store tokens
        localStorage.setItem("refToken", result.RefreshToken);
        localStorage.setItem("idToken", result.IdToken);
        localStorage.setItem("username", challengeData.username);

        // Clear challenge data
        sessionStorage.removeItem('passwordChallenge');

        toast.success("Password changed successfully!");

        // Parse token to get userId for redirect
        const base64Url = result.IdToken.split(".")[1];
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
        const userId = tokenPayload["custom:user_id"] || tokenPayload.sub || tokenPayload.email;

        // Redirect based on returnUrl
        if (returnUrl) {
          const separator = returnUrl.includes('?') ? '&' : '?';
          const authenticatedUrl = `${returnUrl}${separator}token=${encodeURIComponent(result.IdToken)}&userId=${encodeURIComponent(userId)}`;
          
          console.log('🔐 Redirecting to:', authenticatedUrl);
          
          setTimeout(() => {
            window.location.href = authenticatedUrl;
          }, 1500);
        } else {
          setTimeout(() => {
            navigate("/admin/home");
          }, 1500);
        }
      } else {
        // Regular password change
        await changePassword({ oldPassword, newPassword });
        
        toast.success("Password changed successfully!");

        // If returnUrl exists, redirect there with auth parameters
        if (returnUrl) {
          const idToken = localStorage.getItem("idToken");
          const username = localStorage.getItem("username");
          
          // Parse token to get userId
          const base64Url = idToken.split(".")[1];
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
          const userId = tokenPayload["custom:user_id"] || tokenPayload.sub || tokenPayload.email || username;

          // Build authenticated URL
          const separator = returnUrl.includes('?') ? '&' : '?';
          const authenticatedUrl = `${returnUrl}${separator}token=${encodeURIComponent(idToken)}&userId=${encodeURIComponent(userId)}`;
          
          console.log('🔐 Redirecting to:', authenticatedUrl);
          
          // Redirect to return URL
          setTimeout(() => {
            window.location.href = authenticatedUrl;
          }, 1500);
        } else {
          // No return URL, go to dashboard
          setTimeout(() => {
            navigate("/admin/home");
          }, 1500);
        }
      }
    } catch (error) {
      console.error("Password change failed:", error);
      
      if (error.code === "NotAuthorizedException") {
        toast.error("Current password is incorrect");
        setInvalid({ oldPassword: "Current password is incorrect" });
      } else if (error.code === "InvalidPasswordException") {
        toast.error("New password does not meet requirements");
        setInvalid({ newPassword: error.message });
      } else if (error.code === "LimitExceededException") {
        toast.error("Too many attempts. Please try again later");
      } else {
        toast.error("Failed to change password. Please try again");
      }
      
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isFirstLogin) {
      // Clear challenge data and go back to login
      sessionStorage.removeItem('passwordChallenge');
      if (returnUrl) {
        navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      } else {
        navigate("/login");
      }
    } else {
      if (returnUrl) {
        // If there's a return URL, go back to login with it
        navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      } else {
        navigate("/admin/home");
      }
    }
  };

  document.title = "My Tabs - Change Password";

  return (
    <div className='Login-view'>
      <img
        style={{ borderRadius: 20, top: "10%", left: "5%", position: "absolute" }}
        src={logo}
        alt='logo'
      />

      <div className='Container-box-responsive'>
        <div className='Headers'>
          <div className='Sign-up-account-text'>
            {isFirstLogin 
              ? "Set your new password to continue" 
              : returnUrl 
                ? "Change your password to continue" 
                : "Change your password"}
          </div>
        </div>
        <form
          className='Body'
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}>
          <div className='Account-details'>
            {isFirstLogin ? "First Login - Set New Password" : "Change Password"}
          </div>
          
          {!isFirstLogin && (
            <MTBInput
              placeholder='Current Password'
              autoComplete='current-password'
              type='password'
              value={oldPassword}
              disabled={isLoading}
              onChange={handleOldPassword}
              helper={
                invalid.oldPassword && {
                  type: "warning",
                  text: invalid.oldPassword,
                }
              }
            />
          )}

          <MTBInput
            placeholder='New Password'
            autoComplete='new-password'
            type='password'
            value={newPassword}
            disabled={isLoading}
            onChange={handleNewPassword}
            helper={
              invalid.newPassword && {
                type: "warning",
                text: invalid.newPassword,
              }
            }
          />

          <MTBInput
            placeholder='Confirm New Password'
            autoComplete='new-password'
            type='password'
            value={confirmPassword}
            disabled={isLoading}
            onChange={handleConfirmPassword}
            onEnterPress={handleChangePassword}
            helper={
              invalid.confirmPassword && {
                type: "warning",
                text: invalid.confirmPassword,
              }
            }
          />

          <div className='password-requirements'>
            <p>Password must contain:</p>
            <ul>
              <li>At least 8 characters</li>
              <li>One uppercase letter</li>
              <li>One lowercase letter</li>
              <li>One number</li>
              <li>One special character (!@#$%^&*)</li>
            </ul>
          </div>
        </form>

        <div className='Footer'>
          <MTBButton
            style={{ borderRadius: "16px", width: "10px", flex: 1, marginRight: "10px" }}
            onClick={handleCancel}
            disabled={isLoading}
            variant="secondary">
            Cancel
          </MTBButton>
          <MTBButton
            style={{ borderRadius: "16px", width: "10px", flex: 1 }}
            onClick={handleChangePassword}
            isLoading={isLoading}>
            {isFirstLogin ? "Set Password" : "Change Password"}
          </MTBButton>
        </div>
      </div>
      <div className='welcome-back'>
        {isFirstLogin ? "Welcome!" : "Secure Your Account"}
      </div>
      <div className='log-in-to-your-account'>
        {isFirstLogin ? "Please set a new password" : "Update your password"}
      </div>
    </div>
  );
}
