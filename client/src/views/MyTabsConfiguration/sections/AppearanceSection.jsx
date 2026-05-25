import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import SettingsCard from '../components/SettingsCard';

const THEME_KEY = 'settings-theme';

const themeOptions = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const previewStyles = {
  light: {
    width: '100%',
    height: 60,
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #FFFFFF 0%, #F3F4F6 100%)',
    border: '1px solid #E5E7EB',
  },
  dark: {
    width: '100%',
    height: 60,
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
  },
  system: {
    width: '100%',
    height: 60,
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
  },
};

const themeOptionStyle = (isSelected) => ({
  flex: 1,
  border: `2px solid ${isSelected ? '#4F46E5' : '#E5E7EB'}`,
  borderRadius: '12px',
  padding: '16px',
  cursor: 'pointer',
  backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
  transition: 'all 0.2s',
});

const colorSwatchStyle = (color) => ({
  width: 40,
  height: 40,
  borderRadius: '8px',
  backgroundColor: color,
});

const AppearanceSection = () => {
  const [selectedTheme, setSelectedTheme] = useState(() => {
    return localStorage.getItem(THEME_KEY) || 'system';
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, selectedTheme);
  }, [selectedTheme]);

  const handleThemeSelect = (themeId) => {
    setSelectedTheme(themeId);
  };

  return (
    <Box data-testid="section-appearance">
      {/* Theme Card */}
      <SettingsCard title="Theme" subtitle="Choose your preferred color scheme">
        <Box sx={{ display: 'flex', gap: '16px' }} data-testid="theme-options">
          {themeOptions.map((option) => (
            <Box
              key={option.id}
              sx={themeOptionStyle(selectedTheme === option.id)}
              onClick={() => handleThemeSelect(option.id)}
              data-testid={`theme-option-${option.id}`}
              role="button"
              aria-pressed={selectedTheme === option.id}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleThemeSelect(option.id);
                }
              }}
            >
              {/* Preview Box */}
              {option.id === 'system' ? (
                <Box sx={previewStyles.system}>
                  <Box
                    sx={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #FFFFFF 0%, #F3F4F6 100%)',
                      borderRight: '1px solid #E5E7EB',
                    }}
                  />
                  <Box
                    sx={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                    }}
                  />
                </Box>
              ) : (
                <Box sx={previewStyles[option.id]} />
              )}
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#111827',
                  mt: '12px',
                  textAlign: 'center',
                }}
              >
                {option.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </SettingsCard>

      {/* Brand Colors Card (role-gated placeholder) */}
      <SettingsCard title="Brand Colors" subtitle="Customize your organization's brand identity">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Color Swatches */}
          <Box sx={{ display: 'flex', gap: '24px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Box sx={colorSwatchStyle('#4F46E5')} data-testid="swatch-primary" />
              <Box>
                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                  Primary
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>
                  #4F46E5
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Box sx={colorSwatchStyle('#7C3AED')} data-testid="swatch-secondary" />
              <Box>
                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                  Secondary
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>
                  #7C3AED
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: '12px' }}>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#4F46E5',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '14px',
                borderRadius: '8px',
                padding: '9px 18px',
                '&:hover': { backgroundColor: '#4338CA' },
              }}
              disableElevation
              data-testid="save-colors-btn"
            >
              Save Colors
            </Button>
            <Button
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '14px',
                borderRadius: '8px',
                padding: '9px 18px',
                color: '#6B7280',
                borderColor: '#E5E7EB',
                '&:hover': { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' },
              }}
              data-testid="reset-colors-btn"
            >
              Reset to Default
            </Button>
          </Box>

          {/* Logo Upload Area */}
          <Box
            sx={{
              border: '2px dashed #E5E7EB',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              '&:hover': { borderColor: '#4F46E5' },
            }}
            data-testid="logo-upload-area"
          >
            <Typography sx={{ fontSize: '14px', color: '#6B7280' }}>
              Drag & drop your logo here, or click to browse
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#9CA3AF', mt: 1 }}>
              PNG or JPEG, max 5MB
            </Typography>
          </Box>
        </Box>
      </SettingsCard>
    </Box>
  );
};

export default AppearanceSection;
