import React, { useState } from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import BusinessOutlined from '@mui/icons-material/BusinessOutlined';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import SettingsSearch, { NoResultsMessage } from './SettingsSearch';
import { useSettings } from '../context/SettingsContext';
import useSettingsVisibility from '../hooks/useSettingsVisibility';

const iconMap = {
  PersonOutlined,
  LockOutlined,
  ShieldOutlined,
  BusinessOutlined,
  GroupOutlined,
  CreditCardOutlined,
  AccountBalanceOutlined,
  PaletteOutlined,
  NotificationsOutlined,
  VisibilityOffOutlined,
};

const navStyles = {
  sidebar: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  list: {
    padding: '8px',
    flex: 1,
  },
  navItem: (isActive) => ({
    borderRadius: '8px',
    padding: '10px 16px',
    marginBottom: '2px',
    backgroundColor: isActive ? '#EEF2FF' : 'transparent',
    color: isActive ? '#4F46E5' : '#374151',
    '&:hover': {
      backgroundColor: isActive ? '#EEF2FF' : '#F3F4F6',
    },
  }),
  navIcon: (isActive) => ({
    minWidth: '32px',
    color: isActive ? '#4F46E5' : '#6B7280',
  }),
  navText: (isActive) => ({
    '& .MuiTypography-root': {
      fontSize: '14px',
      fontWeight: isActive ? 600 : 400,
    },
  }),
};

const SettingsNav = () => {
  const { state } = useSettings();
  const { visibleSections } = useSettingsVisibility();
  const [filteredSections, setFilteredSections] = useState(null);
  const { activeSection } = state;

  const displaySections = filteredSections !== null ? filteredSections : visibleSections;

  const handleNavClick = (sectionId) => {
    window.location.hash = sectionId;
  };

  const handleFilterChange = (filtered) => {
    setFilteredSections(filtered);
  };

  return (
    <Box sx={navStyles.sidebar} data-testid="settings-nav">
      <SettingsSearch
        sections={visibleSections}
        onFilterChange={handleFilterChange}
      />

      {displaySections.length === 0 && filteredSections !== null ? (
        <NoResultsMessage />
      ) : (
        <List sx={navStyles.list}>
          {displaySections.map((section) => {
            const IconComponent = iconMap[section.icon];
            const isActive = activeSection === section.id;

            return (
              <ListItemButton
                key={section.id}
                sx={navStyles.navItem(isActive)}
                onClick={() => handleNavClick(section.id)}
                data-testid={`nav-item-${section.id}`}
                selected={isActive}
              >
                <ListItemIcon sx={navStyles.navIcon(isActive)}>
                  {IconComponent && <IconComponent fontSize="small" />}
                </ListItemIcon>
                <ListItemText
                  primary={section.label}
                  sx={navStyles.navText(isActive)}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
};

export default SettingsNav;
