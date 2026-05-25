import React, { useState } from 'react';
import {
  Card,
  Box,
  Typography,
  IconButton,
  Button,
  Collapse,
  Skeleton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { toast } from 'react-toastify';

const cardStyles = {
  card: {
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #F3F4F6',
    marginBottom: '24px',
    transition: 'box-shadow 0.2s',
    '&:hover': {
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6B7280',
    marginTop: '2px',
  },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#F59E0B',
  },
  collapseIcon: (expanded) => ({
    transition: 'transform 0.2s',
    transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
    color: '#9CA3AF',
    fontSize: '20px',
  }),
  footer: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #F3F4F6',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    color: '#fff',
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '14px',
    borderRadius: '8px',
    padding: '9px 18px',
    '&:hover': {
      backgroundColor: '#4338CA',
      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
    },
  },
  cancelButton: {
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '14px',
    borderRadius: '8px',
    padding: '9px 18px',
    color: '#6B7280',
    borderColor: '#E5E7EB',
    '&:hover': {
      backgroundColor: '#F9FAFB',
      borderColor: '#D1D5DB',
    },
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    padding: '10px 14px',
    backgroundColor: '#FEF2F2',
    borderRadius: '8px',
    border: '1px solid #FECACA',
  },
  errorText: {
    fontSize: '13px',
    color: '#EF4444',
    flex: 1,
  },
  retryButton: {
    textTransform: 'none',
    fontSize: '13px',
    color: '#EF4444',
    fontWeight: 500,
    minWidth: 'auto',
    padding: '2px 8px',
  },
};

const SettingsCard = ({
  title,
  subtitle,
  collapsible = false,
  defaultExpanded = true,
  loading = false,
  dirty = false,
  onSave,
  onCancel,
  headerAction,
  children,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleToggle = () => {
    if (collapsible) {
      setExpanded((prev) => !prev);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave();
      toast.success('Changes saved successfully');
    } catch (err) {
      const message = err?.message || 'Failed to save changes. Please try again.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    handleSave();
  };

  const handleCancel = () => {
    setError(null);
    if (onCancel) {
      onCancel();
    }
  };

  if (loading) {
    return (
      <Card sx={cardStyles.card} elevation={0} data-testid="settings-card-loading">
        <Box sx={cardStyles.header}>
          <Box sx={cardStyles.headerLeft}>
            <Skeleton variant="text" width={160} height={24} />
          </Box>
        </Box>
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" width="100%" height={20} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="80%" height={20} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="60%" height={20} />
        </Box>
      </Card>
    );
  }

  return (
    <Card sx={cardStyles.card} elevation={0} data-testid="settings-card">
      {/* Header */}
      <Box
        sx={cardStyles.header}
        onClick={handleToggle}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? expanded : undefined}
        data-testid="settings-card-header"
      >
        <Box sx={cardStyles.headerLeft}>
          <Box>
            <Typography sx={cardStyles.title}>{title}</Typography>
            {subtitle && (
              <Typography sx={cardStyles.subtitle}>{subtitle}</Typography>
            )}
          </Box>
          {dirty && (
            <Box
              sx={cardStyles.dirtyDot}
              data-testid="dirty-indicator"
              aria-label="Unsaved changes"
            />
          )}
        </Box>
        {collapsible && (
          <IconButton size="small" aria-label={expanded ? 'Collapse' : 'Expand'}>
            <ExpandMoreIcon sx={cardStyles.collapseIcon(expanded)} />
          </IconButton>
        )}
        {headerAction && (
          <Box>{headerAction}</Box>
        )}
      </Box>

      {/* Content */}
      <Collapse in={collapsible ? expanded : true} timeout={300}>
        <Box sx={{ mt: 2 }} data-testid="settings-card-content">
          {children}
        </Box>

        {/* Error display */}
        {error && (
          <Box sx={cardStyles.errorContainer} data-testid="settings-card-error">
            <Typography sx={cardStyles.errorText}>{error}</Typography>
            <Button
              sx={cardStyles.retryButton}
              onClick={handleRetry}
              size="small"
            >
              Retry
            </Button>
          </Box>
        )}

        {/* Footer with Save/Cancel — only show when dirty */}
        {onSave && dirty && (
          <Box sx={cardStyles.footer} data-testid="settings-card-footer">
            <Button
              variant="contained"
              sx={cardStyles.saveButton}
              onClick={handleSave}
              disabled={saving}
              disableElevation
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            {onCancel && (
              <Button
                variant="outlined"
                sx={cardStyles.cancelButton}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
          </Box>
        )}
      </Collapse>
    </Card>
  );
};

export default SettingsCard;
