import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SettingsCard from '../components/SettingsCard';
import { useSettings } from '../context/SettingsContext';
import { getUserSessions, revokeSession, getSessionId, parseUserAgent } from '../../../services/sessionService';
import { parseJwt } from '../../../utils/common';
import { toast } from 'react-toastify';

const tableStyles = {
  headerCell: {
    fontWeight: 600,
    fontSize: '13px',
    color: '#6B7280',
    borderBottom: '1px solid #E5E7EB',
    padding: '10px 12px',
  },
  bodyCell: {
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
    padding: '12px',
  },
};

const statBoxStyle = {
  flex: 1,
  backgroundColor: '#FAFBFC',
  borderRadius: '10px',
  padding: '20px 16px',
  textAlign: 'center',
};

const SecuritySection = () => {
  const { state } = useSettings();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [lastLogin, setLastLogin] = useState('');
  const currentSessionId = getSessionId();

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken'));
        if (!userId) {
          setLoading(false);
          return;
        }
        const data = await getUserSessions(userId);
        if (data?.sessions) {
          setSessions(data.sessions);
        }
      } catch (err) {
        console.log('Could not fetch sessions');
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();

    // Get last login time from token
    try {
      const token = localStorage.getItem('idToken');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.auth_time) {
          const loginDate = new Date(payload.auth_time * 1000);
          const now = new Date();
          const diffMs = now - loginDate;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          if (diffMins < 5) setLastLogin('Just now');
          else if (diffMins < 60) setLastLogin(`${diffMins} min ago`);
          else if (diffHours < 24) setLastLogin(`${diffHours} hours ago`);
          else setLastLogin(`${diffDays} days ago`);
        }
      }
    } catch (e) {
      setLastLogin('Unknown');
    }
  }, [state.user?.userId]);

  const handleRevoke = async (sessionId) => {
    try {
      const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken'));
      await revokeSession(userId, sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      toast.success('Session revoked');
    } catch (err) {
      toast.error('Failed to revoke session');
    }
  };

  const handleSignOutAll = () => {
    setSignOutDialogOpen(true);
  };

  const confirmSignOut = () => {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('refToken');
    localStorage.removeItem('username');
    localStorage.removeItem('sessionId');
    setSignOutDialogOpen(false);
    window.location.href = '/login';
  };

  // If no sessions from API, show current browser session
  const displaySessions = sessions.length > 0 ? sessions : [{
    sessionId: currentSessionId,
    device: parseUserAgent().device,
    browser: parseUserAgent().browser,
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  }];

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Box data-testid="section-security">
      {/* Security Status */}
      <SettingsCard title="Security Status" subtitle="Overview of your account security">
        <Box sx={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }} data-testid="security-status-grid">
          <Box sx={statBoxStyle}>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#22C55E', mb: '4px' }}>
              ✓ Active
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>Account Status</Typography>
          </Box>
          <Box sx={statBoxStyle}>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827', mb: '4px' }}>
              {lastLogin || '—'}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>Last Login</Typography>
          </Box>
          <Box sx={statBoxStyle}>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827', mb: '4px' }}>
              {displaySessions.length}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>Active Sessions</Typography>
          </Box>
        </Box>
      </SettingsCard>

      {/* Active Sessions */}
      <SettingsCard title="Active Sessions" subtitle="Devices currently signed in to your account" loading={loading}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" data-testid="sessions-table">
            <TableHead>
              <TableRow>
                <TableCell sx={tableStyles.headerCell}>Device</TableCell>
                <TableCell sx={tableStyles.headerCell}>Browser</TableCell>
                <TableCell sx={tableStyles.headerCell}>Last Active</TableCell>
                <TableCell sx={tableStyles.headerCell}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displaySessions.map((session) => {
                const isCurrent = session.sessionId === currentSessionId;
                return (
                  <TableRow key={session.sessionId}>
                    <TableCell sx={tableStyles.bodyCell}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {session.device || 'Unknown'}
                        {isCurrent && (
                          <Chip
                            label="This device"
                            size="small"
                            sx={{ backgroundColor: '#ECFDF5', color: '#059669', fontWeight: 500, fontSize: '11px', height: '22px' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>{session.browser || 'Unknown'}</TableCell>
                    <TableCell sx={tableStyles.bodyCell}>{formatTime(session.lastActive)}</TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {!isCurrent ? (
                        <Button
                          size="small"
                          onClick={() => handleRevoke(session.sessionId)}
                          sx={{ textTransform: 'none', fontSize: '13px', color: '#EF4444', fontWeight: 500, padding: '4px 10px', '&:hover': { backgroundColor: '#FEF2F2' } }}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Typography sx={{ fontSize: '13px', color: '#9CA3AF' }}>Current</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #F3F4F6' }}>
          <Button
            variant="outlined"
            onClick={handleSignOutAll}
            sx={{
              textTransform: 'none', fontWeight: 500, fontSize: '14px', borderRadius: '8px', padding: '9px 18px',
              color: '#EF4444', borderColor: '#FECACA',
              '&:hover': { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
            }}
          >
            Sign out (end session)
          </Button>
        </Box>
      </SettingsCard>

      {/* Security Tips */}
      <SettingsCard title="Security Recommendations" subtitle="Tips to keep your account secure">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { icon: '🔒', title: 'Use a strong password', desc: 'At least 8 characters with uppercase, lowercase, numbers, and symbols' },
            { icon: '📱', title: 'Enable MFA (coming soon)', desc: 'Add an extra layer of security with multi-factor authentication' },
            { icon: '🔄', title: 'Change password regularly', desc: 'Update your password every 90 days for better security' },
          ].map((tip, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#FAFBFC', borderRadius: '8px' }}>
              <Typography sx={{ fontSize: '20px' }}>{tip.icon}</Typography>
              <Box>
                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{tip.title}</Typography>
                <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>{tip.desc}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </SettingsCard>

      {/* Sign Out Dialog */}
      <Dialog open={signOutDialogOpen} onClose={() => setSignOutDialogOpen(false)} PaperProps={{ sx: { borderRadius: '12px', padding: '8px' } }}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '18px' }}>Sign out?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: '#6B7280' }}>
            This will end your current session and redirect you to the login page.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSignOutDialogOpen(false)} sx={{ textTransform: 'none', color: '#6B7280' }}>Cancel</Button>
          <Button variant="contained" onClick={confirmSignOut} sx={{ textTransform: 'none', backgroundColor: '#EF4444', '&:hover': { backgroundColor: '#DC2626' }, borderRadius: '8px' }}>
            Sign out
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecuritySection;
