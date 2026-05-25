import React from 'react';
import { Box, Typography, Switch } from '@mui/material';

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #F9FAFB',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#111827',
  },
  description: {
    fontSize: '12px',
    color: '#6B7280',
    marginTop: '2px',
  },
  switch: {
    marginLeft: '16px',
    '& .MuiSwitch-switchBase.Mui-checked': {
      color: '#4F46E5',
    },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
      backgroundColor: '#4F46E5',
    },
  },
};

const SettingsToggle = ({ label, description, checked, onChange, disabled }) => {
  const handleChange = (event) => {
    if (onChange) {
      onChange(event.target.checked);
    }
  };

  return (
    <Box sx={styles.row} data-testid="settings-toggle">
      <Box sx={styles.info}>
        <Typography sx={styles.label}>{label}</Typography>
        {description && (
          <Typography sx={styles.description} data-testid="toggle-description">
            {description}
          </Typography>
        )}
      </Box>
      <Switch
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        sx={styles.switch}
        inputProps={{ 'aria-label': label }}
      />
    </Box>
  );
};

export default SettingsToggle;
