import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Select, MenuItem } from '@mui/material';
import SettingsCard from '../components/SettingsCard';
import SettingsFieldGroup from '../components/SettingsFieldGroup';
import SettingsToggle from '../components/SettingsToggle';
import { useSettings } from '../context/SettingsContext';
import { getUserById, updateUser, getUserExistance } from '../../../services/userService';
import { formatPhone, unformatPhone } from '../../../utils/phoneMask';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
];

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

const selectStyle = {
  borderRadius: '8px',
  fontSize: '14px',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#E5E7EB',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#D1D5DB',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#4F46E5',
  },
  '& .MuiSelect-select': {
    padding: '9px 12px',
    fontSize: '14px',
  },
};

const ProfileSection = () => {
  const { state } = useSettings();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    username: '',
    phoneNumber: '',
    timezone: 'America/New_York',
    language: 'en-US',
  });
  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarDirty, setAvatarDirty] = useState(false);

  const debounceTimers = useRef({});

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      // Wait for SettingsContext to finish resolving the JWT before deciding
      // there's no user. Without this guard, the effect fires on mount with
      // state.user === null, bails early, and shows empty fields for a flash
      // before the context dispatches SET_USER and the effect re-runs.
      if (state.loading) return;

      const userId = state.user?.userId || state.user?.cognitoId || localStorage.getItem('username');
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const response = await getUserById(userId);
        const userData = response.data || response;
        const loaded = {
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          displayName: userData.displayName || '',
          email: userData.email || '',
          username: userData.username || '',
          phoneNumber: userData.phoneNumber || '',
          timezone: userData.timezone || 'America/New_York',
          language: userData.language || 'en-US',
        };
        setFormData(loaded);
        setOriginalData(loaded);
        if (userData.avatarUrl) {
          setAvatarPreview(userData.avatarUrl);
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, [state.user?.userId, state.user?.cognitoId, state.loading]);

  // Check if form is dirty
  const isFormDirty = originalData
    ? Object.keys(formData).some((key) => formData[key] !== originalData[key])
    : false;

  // Debounced uniqueness check
  const checkUniqueness = useCallback((attribute, value) => {
    if (debounceTimers.current[attribute]) {
      clearTimeout(debounceTimers.current[attribute]);
    }
    debounceTimers.current[attribute] = setTimeout(async () => {
      if (!value || value === originalData?.[attribute]) {
        setErrors((prev) => ({ ...prev, [attribute]: '' }));
        return;
      }
      try {
        const result = await getUserExistance({ attribute, value });
        if (result && result.exists) {
          setErrors((prev) => ({
            ...prev,
            [attribute]: `This ${attribute} is already taken`,
          }));
        } else {
          setErrors((prev) => ({ ...prev, [attribute]: '' }));
        }
      } catch (err) {
        // If the API returns an error indicating existence, handle it
        if (err?.response?.status === 409 || err?.enhancedMessage?.includes('exists')) {
          setErrors((prev) => ({
            ...prev,
            [attribute]: `This ${attribute} is already taken`,
          }));
        }
      }
    }, 500);
  }, [originalData]);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    // Debounced uniqueness check for email and username
    if (field === 'email' || field === 'username') {
      checkUniqueness(field, value);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0 && !errors.email && !errors.username;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      throw new Error('Please fix the validation errors before saving');
    }
    const userId = state.user?.userId || state.user?.cognitoId || localStorage.getItem('username');
    const payload = {
      ...formData,
      userId,
    };
    await updateUser(payload);
    setOriginalData({ ...formData });
  };

  const handleCancel = () => {
    if (originalData) {
      setFormData({ ...originalData });
      setErrors({});
    }
  };

  // Avatar handling
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    // Validate type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setAvatarError('Only JPEG and PNG files are accepted');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('File size must be 5MB or less');
      return;
    }

    setAvatarFile(file);
    setAvatarDirty(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarSave = async () => {
    if (!avatarFile) {
      throw new Error('No file selected');
    }
    // In a real implementation, this would upload to S3/CDN
    // For now, we simulate the save
    const payload = {
      userId: state.user?.userId,
      avatarUrl: avatarPreview,
    };
    await updateUser(payload);
    setAvatarDirty(false);
  };

  const handleAvatarCancel = () => {
    setAvatarFile(null);
    setAvatarPreview(originalData?.avatarUrl || null);
    setAvatarError('');
    setAvatarDirty(false);
  };

  const getInitials = () => {
    const first = formData.firstName?.[0] || '';
    const last = formData.lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  return (
    <Box data-testid="section-profile">
      {/* Personal Information Card */}
      <SettingsCard
        title="Personal Information"
        subtitle="Update your personal details"
        loading={loading}
        dirty={isFormDirty}
        onSave={handleSave}
        onCancel={handleCancel}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: '16px',
          }}
        >
          {/* Row 1: First Name | Last Name */}
          <SettingsFieldGroup label="First Name" required error={errors.firstName}>
            <input
              type="text"
              value={formData.firstName}
              onChange={handleChange('firstName')}
              placeholder="Enter first name"
              style={{
                ...inputStyle,
                borderColor: errors.firstName ? '#EF4444' : '#E5E7EB',
              }}
              data-testid="input-firstName"
            />
          </SettingsFieldGroup>

          <SettingsFieldGroup label="Last Name" required error={errors.lastName}>
            <input
              type="text"
              value={formData.lastName}
              onChange={handleChange('lastName')}
              placeholder="Enter last name"
              style={{
                ...inputStyle,
                borderColor: errors.lastName ? '#EF4444' : '#E5E7EB',
              }}
              data-testid="input-lastName"
            />
          </SettingsFieldGroup>

          {/* Row 2: Display Name | Username */}
          <SettingsFieldGroup label="Display Name">
            <input
              type="text"
              value={formData.displayName}
              onChange={handleChange('displayName')}
              placeholder="Enter display name"
              style={inputStyle}
              data-testid="input-displayName"
            />
          </SettingsFieldGroup>

          <SettingsFieldGroup label="Username" required error={errors.username}>
            <input
              type="text"
              value={formData.username}
              onChange={handleChange('username')}
              placeholder="Enter username"
              style={{
                ...inputStyle,
                borderColor: errors.username ? '#EF4444' : '#E5E7EB',
              }}
              data-testid="input-username"
            />
          </SettingsFieldGroup>

          {/* Row 3: Email | Phone Number */}
          <SettingsFieldGroup label="Email" required error={errors.email}>
            <input
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              placeholder="Enter email address"
              style={{
                ...inputStyle,
                borderColor: errors.email ? '#EF4444' : '#E5E7EB',
              }}
              data-testid="input-email"
            />
          </SettingsFieldGroup>

          <SettingsFieldGroup label="Phone Number">
            <input
              type="tel"
              value={formatPhone(formData.phoneNumber)}
              onChange={(e) => handleChange('phoneNumber')({ target: { value: unformatPhone(e.target.value) } })}
              placeholder="(281) 555-1234"
              style={inputStyle}
              data-testid="input-phoneNumber"
            />
          </SettingsFieldGroup>

          {/* Row 4: Timezone | Language */}
          <SettingsFieldGroup label="Timezone">
            <Select
              value={formData.timezone}
              onChange={handleChange('timezone')}
              size="small"
              fullWidth
              sx={selectStyle}
              data-testid="select-timezone"
            >
              {TIMEZONES.map((tz) => (
                <MenuItem key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Select>
          </SettingsFieldGroup>

          <SettingsFieldGroup label="Language">
            <Select
              value={formData.language}
              onChange={handleChange('language')}
              size="small"
              fullWidth
              sx={selectStyle}
              data-testid="select-language"
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang.value} value={lang.value}>
                  {lang.label}
                </MenuItem>
              ))}
            </Select>
          </SettingsFieldGroup>
        </Box>
      </SettingsCard>

      {/* Avatar Card */}
      <SettingsCard
        title="Avatar"
        subtitle="Upload a profile picture"
        dirty={avatarDirty}
        onSave={avatarDirty ? handleAvatarSave : undefined}
        onCancel={avatarDirty ? handleAvatarCancel : undefined}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Circular preview */}
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '2px solid #E5E7EB',
              flexShrink: 0,
            }}
            data-testid="avatar-preview"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Typography
                sx={{ fontSize: '24px', fontWeight: 600, color: '#4F46E5' }}
              >
                {getInitials()}
              </Typography>
            )}
          </Box>

          <Box>
            <Typography sx={{ fontSize: '14px', color: '#374151', mb: 1 }}>
              Upload a new avatar
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#9CA3AF', mb: 1.5 }}>
              JPEG or PNG, max 5MB
            </Typography>
            <label
              htmlFor="avatar-upload"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Choose File
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
              data-testid="avatar-file-input"
            />
            {avatarError && (
              <Typography
                sx={{ fontSize: '13px', color: '#EF4444', mt: 1 }}
                data-testid="avatar-error"
              >
                {avatarError}
              </Typography>
            )}
          </Box>
        </Box>
      </SettingsCard>

      {/* Activity & Email Visibility */}
      <SettingsCard title="Visibility" subtitle="Control how others see you">
        <SettingsToggle label="Activity Status" description="Show when you're online to other users" checked={true} onChange={() => {}} />
        <SettingsToggle label="Email Visibility" description="Allow other users to see your email address" checked={false} onChange={() => {}} />
      </SettingsCard>
    </Box>
  );
};

export default ProfileSection;
