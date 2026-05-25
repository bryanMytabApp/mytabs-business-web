import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import SettingsCard from '../components/SettingsCard';
import SettingsToggle from '../components/SettingsToggle';

const defaultPreferences = {
  muteAll: false,
  categories: [
    { id: 'security', label: 'Security Alerts', locked: true },
    { id: 'account', label: 'Account', locked: false, email: true, inApp: true },
    { id: 'billing', label: 'Billing', locked: false, email: true, inApp: false },
    { id: 'team', label: 'Team', locked: false, email: false, inApp: true },
    { id: 'events', label: 'Events', locked: false, email: true, inApp: true },
    { id: 'marketing', label: 'Marketing', locked: false, email: false, inApp: false },
  ],
};

const tableStyles = {
  headerCell: {
    fontWeight: 600,
    fontSize: '12px',
    color: '#6B7280',
    textTransform: 'uppercase',
    padding: '10px 12px',
    borderBottom: '2px solid #E5E7EB',
  },
  bodyRow: {
    borderBottom: '1px solid #F3F4F6',
  },
  bodyCell: {
    fontSize: '14px',
    color: '#111827',
    padding: '12px',
    verticalAlign: 'middle',
  },
  lockedText: {
    fontSize: '12px',
    color: '#6B7280',
    fontStyle: 'italic',
  },
};

const NotificationsSection = () => {
  const [muteAll, setMuteAll] = useState(defaultPreferences.muteAll);
  const [categories, setCategories] = useState(defaultPreferences.categories);

  const handleMuteAll = (checked) => {
    setMuteAll(checked);
  };

  const handleToggle = (categoryId, channel, value) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, [channel]: value } : cat
      )
    );
  };

  return (
    <Box data-testid="section-notifications">
      {/* Quick Actions Card */}
      <SettingsCard title="Quick Actions" subtitle="Global notification controls">
        <SettingsToggle
          label="Mute All"
          description="Temporarily disable all non-critical notifications"
          checked={muteAll}
          onChange={handleMuteAll}
        />
      </SettingsCard>

      {/* Notification Preferences Card */}
      <SettingsCard title="Notification Preferences" subtitle="Choose how you want to be notified">
        <Box sx={{ overflowX: 'auto' }} data-testid="notification-preferences-grid">
          <Box
            component="table"
            sx={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ ...tableStyles.headerCell, textAlign: 'left' }}>
                  Category
                </Box>
                <Box component="th" sx={{ ...tableStyles.headerCell, textAlign: 'center', width: 100 }}>
                  Email
                </Box>
                <Box component="th" sx={{ ...tableStyles.headerCell, textAlign: 'center', width: 100 }}>
                  In-App
                </Box>
              </Box>
            </Box>
            <Box component="tbody">
              {categories.map((category) => (
                <Box
                  component="tr"
                  key={category.id}
                  sx={tableStyles.bodyRow}
                  data-testid={`notification-row-${category.id}`}
                >
                  <Box component="td" sx={tableStyles.bodyCell}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                      {category.label}
                    </Typography>
                  </Box>
                  {category.locked ? (
                    <Box
                      component="td"
                      colSpan={2}
                      sx={{ ...tableStyles.bodyCell, textAlign: 'center' }}
                    >
                      <Typography sx={tableStyles.lockedText}>
                        🔒 Always on
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Box component="td" sx={{ ...tableStyles.bodyCell, textAlign: 'center' }}>
                        <SettingsToggle
                          label=""
                          checked={muteAll ? false : category.email}
                          onChange={(val) => handleToggle(category.id, 'email', val)}
                          disabled={muteAll}
                        />
                      </Box>
                      <Box component="td" sx={{ ...tableStyles.bodyCell, textAlign: 'center' }}>
                        <SettingsToggle
                          label=""
                          checked={muteAll ? false : category.inApp}
                          onChange={(val) => handleToggle(category.id, 'inApp', val)}
                          disabled={muteAll}
                        />
                      </Box>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </SettingsCard>
    </Box>
  );
};

export default NotificationsSection;
