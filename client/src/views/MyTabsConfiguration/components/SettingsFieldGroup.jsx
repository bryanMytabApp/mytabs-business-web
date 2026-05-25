import React from 'react';
import { Typography, FormControl } from '@mui/material';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#111827',
  },
  required: {
    color: '#EF4444',
    marginLeft: '2px',
  },
  error: {
    fontSize: '13px',
    color: '#EF4444',
  },
  description: {
    fontSize: '12px',
    color: '#9CA3AF',
  },
};

const SettingsFieldGroup = ({ label, description, children, error, required }) => {
  return (
    <FormControl fullWidth sx={styles.container} error={!!error} data-testid="settings-field-group">
      <Typography component="label" sx={styles.label}>
        {label}
        {required && <span style={styles.required}>*</span>}
      </Typography>

      {children}

      {error && (
        <Typography sx={styles.error} data-testid="field-error">
          {error}
        </Typography>
      )}

      {description && !error && (
        <Typography sx={styles.description} data-testid="field-description">
          {description}
        </Typography>
      )}
    </FormControl>
  );
};

export default SettingsFieldGroup;
