import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import logo from "../../assets/logo.png";
import "./LoginView.css";
import useLogin from "../../hooks/useLogin.js";
import {MTBButton, MTBInput} from "../../components/";
import SSOLogin from "../../components/SSOLogin/SSOLogin";
import { APP_VERSION } from "../../config/version";
import { getCustomerSubscription } from "../../services/paymentService";
import { getMyOrganizations } from "../../services/organizationService";
import { registerSession } from "../../services/sessionService";

export default function LoginView() {
  const navigate = useNavigate();
  const [showSSO, setShowSSO] = useState(false);
  const {
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
    handleBackupCodeChange,
    handleBackupCodeVerify,
    handleReturnToSignIn,
    goToPasswordRecovery,
    handleUsername,
    handlePassword,
    handleLogin,
    handleSignUp } = useLogin();

  document.title = "My Tabs - Log In";

  /**
   * Handle successful social login.
   * Tokens are already stored in localStorage by webSocialAuth.js.
   * Navigate to the appropriate page based on subscription/org status.
   */
  const handleSocialSuccess = useCallback(async (data) => {
    toast.success("Welcome!");

    // Extract userId from the response
    const userId = data.userId || data.user?.id || data.user?.email;

    // Register session (non-blocking)
    if (userId) {
      registerSession(userId).catch(() => {});
    }

    // Check subscription or org membership to determine navigation
    try {
      const subscriptionResponse = await getCustomerSubscription({ userId });
      if (subscriptionResponse.data.hasSubscription && subscriptionResponse.data.priceId) {
        navigate("/admin/home");
        return;
      }
    } catch (e) { /* no subscription */ }

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
  }, [navigate]);

  /**
   * Handle social login error — show a user-friendly toast message.
   */
  const handleSocialError = useCallback((error) => {
    const message = error?.message || "Sign-in failed. Please try again.";
    toast.error(message);
  }, []);

  return (
    <div className='Login-view'>
      <img
        style={{borderRadius: 20, top: "10%", left: "5%", position: "absolute"}}
        src={logo}
        alt='logo'
      />

      <div className='Container-box-responsive'>
        <div className='Headers'>
          <div className='Sign-up-account-text'>
            Don't have an account? &nbsp; &nbsp;
            <span className='Sign-up-underline' onClick={handleSignUp}>
              Sign up
            </span>
          </div>
        </div>
        <form
          className='Body'
          onSubmit={(e) => {
            e.preventDefault();
            if (showBackupCode) handleBackupCodeVerify();
            else if (mfaRequired) handleMfaVerify();
            else handleLogin();
          }}>
          {showBackupCode ? (
            <>
              <div className='Account-details' style={{ fontSize: '22px' }}>Do you have your backup code?</div>
              <p style={{ fontSize: '14px', color: '#555', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                If you lost access to your two-step authentication methods, you can temporarily remove them by entering your <strong style={{ color: '#5C6BC0' }}>backup code</strong>.
              </p>
              <p style={{ fontSize: '14px', color: '#555', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                Always verify you are on keeptabs.app before entering this code, and <strong>never share it with anyone</strong>. If you do not have your backup code, use <span onClick={goToPasswordRecovery} style={{ color: '#5C6BC0', cursor: 'pointer' }}>another option</span> to recover your account.
              </p>
              <div style={{ marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Backup code</div>
              <input
                type="text"
                value={backupCode}
                onChange={(e) => handleBackupCodeChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '16px',
                  border: '2px solid #E0E0E0',
                  borderRadius: '10px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
            </>
          ) : mfaRequired ? (
            <>
              <div className='Account-details'>Enter Verification Code</div>
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 10px 0' }}>
                Enter the 6-digit verification code generated by <strong>your authenticator app</strong>.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '20px 0' }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <React.Fragment key={i}>
                    {i === 3 && <span style={{ fontSize: '20px', color: '#ccc', margin: '0 4px' }}>–</span>}
                    <input
                      id={`mfa-digit-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={mfaCode[i] || ''}
                      autoFocus={i === 0}
                      style={{
                        width: '48px',
                        height: '56px',
                        textAlign: 'center',
                        fontSize: '22px',
                        fontWeight: '600',
                        border: '2px solid #E0E0E0',
                        borderRadius: '10px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#90CAF9'; e.target.style.boxShadow = '0 0 0 3px rgba(144,202,249,0.3)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#E0E0E0'; e.target.style.boxShadow = 'none'; }}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val) {
                          const newCode = mfaCode.split('');
                          newCode[i] = val[0];
                          handleMfaCodeChange(newCode.join(''));
                          // Auto-focus next
                          if (i < 5) {
                            document.getElementById(`mfa-digit-${i + 1}`)?.focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !mfaCode[i] && i > 0) {
                          const newCode = mfaCode.split('');
                          newCode[i - 1] = '';
                          handleMfaCodeChange(newCode.join(''));
                          document.getElementById(`mfa-digit-${i - 1}`)?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
                        if (pasted) {
                          handleMfaCodeChange(pasted);
                          const focusIdx = Math.min(pasted.length, 5);
                          document.getElementById(`mfa-digit-${focusIdx}`)?.focus();
                        }
                      }}
                    />
                  </React.Fragment>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className='Account-details'>Sign in</div>
              <MTBInput
                placeholder='Email or username'
                autoComplete='username'
                value={username}
                disabled={isLoading}
                onChange={handleUsername}
                onEnterPress={handleLogin}
                helper={
                  invalid.username && {
                    type: "warning",
                    text: invalid.username,
                  }
                }
              />

              <MTBInput
                placeholder='Password'
                autoComplete='current-password'
                type='password'
                value={password}
                disabled={isLoading}
                onChange={handlePassword}
                onEnterPress={handleLogin}
                helper={
                  invalid.password && {
                    type: "warning",
                    text: invalid.password,
                  }
                }
              />
              <div onClick={goToPasswordRecovery} className='Forgot-password'>
                Forgot your password?
              </div>

              {/* Organization SSO section */}
              {!showSSO && (
                <div
                  onClick={() => setShowSSO(true)}
                  style={{
                    textAlign: 'center',
                    marginTop: '8px',
                    cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '14px',
                    color: '#5C6BC0',
                  }}
                >
                  Sign in with your Organization
                </div>
              )}

              {showSSO && (
                <div style={{ marginTop: '8px' }}>
                  <SSOLogin
                    onSuccess={handleSocialSuccess}
                    onError={handleSocialError}
                    onBack={() => setShowSSO(false)}
                  />
                </div>
              )}
            </>
          )}
        </form>

        <div className='Actions'></div>
        <div className='Footer'>
          <div
            style={{
              display: "flex",
              flex: 5,
              marginLeft: "10px",
              boxSizing: "border-box",
              alignItems: "center",
              paddingLeft: "20px",
            }}>
            <span>
              <span class='agree-text'>By continuing, you agree to My Tabs </span>
              <a href="https://www.mytabs.app/terms-comnditions" target="_blank" rel="noopener noreferrer">
                <span class='agree-text-underline'>terms of service</span>
              </a>
              <span class='agree-text'> </span>
              <span class='agree-text'>and </span>
              <a href="https://www.mytabs.app/privacy" target="_blank" rel="noopener noreferrer">
                <span class='agree-text-underline'> privacy notice</span>
              </a>
              <span class='agree-text'>.</span>
            </span>
          </div>
          <MTBButton
            style={{borderRadius: "16px", width: "10px", flex: 1}}
            onClick={showBackupCode ? handleBackupCodeVerify : mfaRequired ? handleMfaVerify : handleLogin}
            isLoading={isLoading}>
            {showBackupCode ? 'Continue' : mfaRequired ? 'Verify' : 'Log In'}
          </MTBButton>
          {mfaRequired && !showBackupCode && (
            <div style={{ textAlign: 'center', marginTop: '12px', width: '100%' }}>
              <span
                onClick={handleShowBackupCode}
                style={{ fontSize: '14px', color: '#5C6BC0', cursor: 'pointer' }}
              >
                Sign in with backup code
              </span>
            </div>
          )}
          {showBackupCode && (
            <div style={{ textAlign: 'center', marginTop: '12px', width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <span
                onClick={goToPasswordRecovery}
                style={{ fontSize: '14px', color: '#5C6BC0', cursor: 'pointer' }}
              >
                I don't have a backup code
              </span>
              <span
                onClick={handleReturnToSignIn}
                style={{ fontSize: '14px', color: '#5C6BC0', cursor: 'pointer' }}
              >
                Return to sign-in
              </span>
            </div>
          )}
          <div className="Sign-up-account-text-responsive Sign-up-account-text">Don't have an account? &nbsp; &nbsp;<span className="Sign-up-underline" onClick={handleSignUp}>Sign up</span></div>
 
        </div>

      </div>
      <div class='welcome-back'>Welcome back!</div>
      <div class='log-in-to-your-account'>Log in to your account</div>
      
      {/* Version Info */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        fontSize: '11px',
        color: '#999',
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontFamily: 'monospace'
      }}>
        v{APP_VERSION}
      </div>
    </div>
  );
}
