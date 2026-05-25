import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Chip, Switch, CircularProgress } from '@mui/material';
import SettingsCard from '../components/SettingsCard';
import SettingsFieldGroup from '../components/SettingsFieldGroup';
import { changePassword } from '../../../services/authService';
import { toast } from 'react-toastify';
import http from '../../../utils/axios/http';

const inputStyle = {
  width: '100%',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  padding: '9px 12px',
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
};

// Password strength calculation
export const calculatePasswordStrength = (password) => {
  const rules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const metCount = Object.values(rules).filter(Boolean).length;

  let label = 'Weak';
  let color = '#EF4444'; // red
  if (metCount >= 4) {
    label = 'Strong';
    color = '#22C55E'; // green
  } else if (metCount >= 2) {
    label = 'Medium';
    color = '#F97316'; // orange
  }

  return { rules, metCount, label, color };
};

const PasswordStrengthIndicator = ({ password }) => {
  const { metCount, label, color } = calculatePasswordStrength(password);

  if (!password) return null;

  return (
    <Box sx={{ mt: 1 }} data-testid="password-strength-indicator">
      <Box sx={{ display: 'flex', gap: '4px', mb: '6px' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: i < metCount ? color : '#E5E7EB',
              transition: 'background-color 0.2s',
            }}
            data-testid={`strength-bar-${i}`}
          />
        ))}
      </Box>
      <Typography sx={{ fontSize: '12px', color, fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
  );
};

const MfaSetup = () => {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState('idle'); // idle, qrCode, verify, done
  const [secretCode, setSecretCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');

  const accessToken = localStorage.getItem('accessToken');
  const username = localStorage.getItem('username') || 'user';

  // Check MFA status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await http.post('auth/mfa', { action: 'status', accessToken });
        setMfaEnabled(res.data?.mfaEnabled || false);
      } catch (e) {
        // If fails, assume not enabled
      } finally {
        setLoading(false);
      }
    };
    if (accessToken) checkStatus();
    else setLoading(false);
  }, [accessToken]);

  const handleToggle = async () => {
    if (mfaEnabled) {
      // Disable MFA (only if it was actually enabled)
      try {
        await http.post('auth/mfa', { action: 'disable', accessToken });
        setMfaEnabled(false);
        setSetupStep('idle');
        toast.success('MFA disabled');
      } catch (e) {
        toast.error('Failed to disable MFA');
      }
    } else if (setupStep !== 'idle') {
      // Cancel setup (haven't verified yet, just close)
      setSetupStep('idle');
      setSecretCode('');
      setVerifyCode('');
      setError('');
    } else {
      // Start setup
      setError('');
      try {
        const res = await http.post('auth/mfa', { action: 'setup', accessToken });
        setSecretCode(res.data?.secretCode || '');
        setSetupStep('qrCode');
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to start MFA setup');
      }
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      setError('Enter a 6-digit code');
      return;
    }
    setError('');
    try {
      await http.post('auth/mfa', { action: 'verify', accessToken, code: verifyCode });
      setMfaEnabled(true);
      setSetupStep('done');
      toast.success('MFA enabled successfully!');
    } catch (e) {
      setError(e.response?.data?.error || 'Invalid code. Try again.');
    }
  };

  // Generate otpauth URI for QR code
  const otpauthUri = secretCode
    ? `otpauth://totp/KeepTabs:${username}?secret=${secretCode}&issuer=KeepTabs`
    : '';

  if (loading) return <CircularProgress size={24} />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
            Enable MFA
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
            Require a verification code from your authenticator app when signing in
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Chip
            label={mfaEnabled ? 'Enabled' : 'Disabled'}
            size="small"
            sx={{
              backgroundColor: mfaEnabled ? '#ECFDF5' : '#F3F4F6',
              color: mfaEnabled ? '#059669' : '#6B7280',
              fontWeight: 500, fontSize: '12px',
            }}
          />
          <Switch
            checked={mfaEnabled || setupStep !== 'idle'}
            onChange={handleToggle}
            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4F46E5' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#4F46E5' } }}
          />
        </Box>
      </Box>

      {/* QR Code Step */}
      {setupStep === 'qrCode' && secretCode && (
        <Box sx={{ mt: 1, p: 2, backgroundColor: '#F9FAFB', borderRadius: '10px' }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', mb: 1 }}>
            Step 1: Scan QR Code
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#6B7280', mb: 2 }}>
            Open your authenticator app (Google Authenticator, Authy, etc.) and scan this code, or enter the secret manually.
          </Typography>

          {/* QR Code using a free API */}
          <Box sx={{ mb: 2 }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`}
              alt="MFA QR Code"
              style={{ width: 200, height: 200, borderRadius: 8 }}
            />
          </Box>

          <Typography sx={{ fontSize: '12px', color: '#6B7280', mb: 1 }}>
            Or enter this secret manually:
          </Typography>
          <Box sx={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '8px 12px', fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-all', mb: 2 }}>
            {secretCode}
          </Box>

          <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', mb: 1 }}>
            Step 2: Enter Verification Code
          </Typography>
          <Box sx={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => { setVerifyCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
              placeholder="6-digit code"
              maxLength={6}
              style={{ width: '140px', padding: '9px 12px', fontSize: '16px', fontFamily: 'monospace', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none', letterSpacing: '4px', textAlign: 'center' }}
            />
            <Button
              variant="contained"
              onClick={handleVerify}
              disabled={verifyCode.length !== 6}
              disableElevation
              sx={{ backgroundColor: '#4F46E5', textTransform: 'none', fontWeight: 500, borderRadius: '8px', '&:hover': { backgroundColor: '#4338CA' } }}
            >
              Verify & Enable
            </Button>
          </Box>
          {error && <Typography sx={{ fontSize: '13px', color: '#EF4444', mt: 1 }}>{error}</Typography>}

          <Button
            onClick={() => { setSetupStep('idle'); setSecretCode(''); setVerifyCode(''); setError(''); }}
            sx={{ textTransform: 'none', color: '#6B7280', fontSize: '13px', mt: 1, width: 'fit-content' }}
          >
            Cancel Setup
          </Button>
        </Box>
      )}

      {/* Success */}
      {setupStep === 'done' && (
        <Box sx={{ p: 2, backgroundColor: '#ECFDF5', borderRadius: '10px' }}>
          <Typography sx={{ fontSize: '14px', color: '#059669', fontWeight: 500 }}>
            ✓ MFA is enabled. You'll need your authenticator app code each time you sign in.
          </Typography>
        </Box>
      )}

      {/* Already enabled info */}
      {mfaEnabled && setupStep === 'idle' && (
        <Box sx={{ p: 2, backgroundColor: '#ECFDF5', borderRadius: '10px' }}>
          <Typography sx={{ fontSize: '14px', color: '#059669', fontWeight: 500 }}>
            ✓ MFA is active. Your account is protected with authenticator app verification.
          </Typography>
        </Box>
      )}

      {error && setupStep === 'idle' && <Typography sx={{ fontSize: '13px', color: '#EF4444' }}>{error}</Typography>}
    </Box>
  );
};

const AccountSection = () => {
  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // MFA state (placeholder for future)

  // --- Change Password handlers ---
  const handleChangePassword = async () => {
    setPasswordError('');
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }
    const { metCount } = calculatePasswordStrength(newPassword);
    if (metCount < 4) {
      setPasswordError('Password does not meet strength requirements');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (err) {
      const msg = err?.message || err?.error || 'Failed to change password. Please log out and log back in, then try again.';
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Box data-testid="section-account">
      {/* Change Password Card */}
      <SettingsCard
        title="Change Password"
        subtitle="Update your password to keep your account secure"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '480px' }}>
          {passwordSuccess ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', py: 2 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '16px', color: '#059669', lineHeight: 1 }}>✓</Typography>
              </Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#059669', flex: 1 }}>
                Password Changed Successfully
              </Typography>
              <Button
                variant="contained"
                onClick={() => setPasswordSuccess(false)}
                disableElevation
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '14px',
                  borderRadius: '8px',
                  padding: '7px 20px',
                  backgroundColor: '#4F46E5',
                  '&:hover': { backgroundColor: '#4338CA' },
                }}
              >
                OK
              </Button>
            </Box>
          ) : (
            <>
              <SettingsFieldGroup label="Current Password" required>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); }}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  style={inputStyle}
                  data-testid="input-currentPassword"
                />
              </SettingsFieldGroup>

              <SettingsFieldGroup label="New Password" required>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  style={inputStyle}
                  data-testid="input-newPassword"
                />
                <PasswordStrengthIndicator password={newPassword} />
              </SettingsFieldGroup>

              <SettingsFieldGroup label="Confirm New Password" required>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  style={inputStyle}
                  data-testid="input-confirmPassword"
                />
              </SettingsFieldGroup>

              <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>
                Requirements: 8+ characters, uppercase, lowercase, number, special character
              </Typography>

              {passwordError && (
                <Typography sx={{ fontSize: '13px', color: '#EF4444' }}>{passwordError}</Typography>
              )}

              <Button
                variant="contained"
                onClick={handleChangePassword}
                disabled={passwordLoading}
                disableElevation
                sx={{
                  backgroundColor: '#4F46E5', textTransform: 'none', fontWeight: 500, fontSize: '14px',
                  borderRadius: '8px', padding: '9px 18px', width: 'fit-content',
                  '&:hover': { backgroundColor: '#4338CA' },
                }}
              >
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </>
          )}
        </Box>
      </SettingsCard>

      {/* MFA Setup Card */}
      <SettingsCard
        title="Multi-Factor Authentication"
        subtitle="Add an extra layer of security to your account"
      >
        <MfaSetup />
      </SettingsCard>
    </Box>
  );
};

export default AccountSection;
