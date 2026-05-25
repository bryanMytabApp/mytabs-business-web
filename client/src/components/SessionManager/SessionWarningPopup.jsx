import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/**
 * Formats seconds into a "M:SS" display string.
 * @param {number} seconds - Remaining seconds to format
 * @returns {string} Formatted time string (e.g., "1:45")
 */
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * SessionWarningPopup component.
 * Displays a modal warning before session expiry with countdown and action buttons.
 *
 * @param {object} props
 * @param {number} props.remainingSeconds - Current countdown value in seconds
 * @param {number} props.warningDuration - Total warning duration in seconds for progress calculation
 * @param {function} props.onStayOn - Handler for "Stay On" button click
 * @param {function} props.onCancel - Handler for "Cancel" button click
 */
const SessionWarningPopup = ({ remainingSeconds, warningDuration, onStayOn, onCancel }) => {
  const progressValue = (remainingSeconds / warningDuration) * 100;

  return (
    <Dialog open={true} aria-labelledby="session-warning-title">
      <DialogTitle id="session-warning-title">Session Timeout Warning</DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Your session is about to expire
        </Typography>
        <Box sx={{ my: 2 }}>
          <LinearProgress variant="determinate" value={progressValue} />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {formatTime(remainingSeconds)} remaining
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="secondary">
          Cancel
        </Button>
        <Button onClick={onStayOn} variant="contained" color="primary">
          Stay On
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionWarningPopup;
