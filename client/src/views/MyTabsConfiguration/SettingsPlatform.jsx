import React, { lazy, Suspense, useEffect } from 'react';
import { Box, Tabs, Tab, Skeleton, useMediaQuery } from '@mui/material';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import SettingsNav from './components/SettingsNav';
import useSettingsVisibility from './hooks/useSettingsVisibility';

// Lazy-loaded section components
const ProfileSection = lazy(() => import('./sections/ProfileSection'));
const AccountSection = lazy(() => import('./sections/AccountSection'));
const SecuritySection = lazy(() => import('./sections/SecuritySection'));
const OrganizationSection = lazy(() => import('./sections/OrganizationSection'));
const TeamSection = lazy(() => import('./sections/TeamSection'));
const BillingSection = lazy(() => import('./sections/BillingSection'));
const AppearanceSection = lazy(() => import('./sections/AppearanceSection'));
const NotificationsSection = lazy(() => import('./sections/NotificationsSection'));
const PrivacySection = lazy(() => import('./sections/PrivacySection'));

const sectionComponents = {
  profile: ProfileSection,
  account: AccountSection,
  security: SecuritySection,
  organization: OrganizationSection,
  team: TeamSection,
  billing: BillingSection,
  appearance: AppearanceSection,
  notifications: NotificationsSection,
  privacy: PrivacySection,
};

const platformStyles = {
  container: {
    width: '100%',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: '24px',
    boxSizing: 'border-box',
    background: 'linear-gradient(135deg, #e8f4fd 0%, #dbeeff 35%, #f0f8ff 65%, #e2eeff 100%)',
    minHeight: '100%',
    flex: 1,
  },
  wrapper: {
    width: '100%',
    background: 'transparent',
    borderRadius: '10px',
    padding: '0',
    boxSizing: 'border-box',
    display: 'flex',
    gap: '24px',
    flex: 1,
    maxWidth: '1200px',
    margin: '0 auto',
  },
  navPanel: {
    width: '220px',
    flexShrink: 0,
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(18px)',
    border: '1.5px solid rgba(200,220,240,0.6)',
    borderRadius: '14px',
    padding: '16px 0',
    height: 'fit-content',
    position: 'sticky',
    top: '24px',
    boxShadow: '0 4px 20px rgba(0,100,180,0.06)',
  },
  content: {
    flex: 1,
    maxWidth: 720,
    minWidth: 0,
  },
  mobileContainer: {
    width: '100%',
    height: '100%',
    padding: '16px',
    boxSizing: 'border-box',
    background: 'linear-gradient(135deg, #e8f4fd 0%, #dbeeff 35%, #f0f8ff 65%, #e2eeff 100%)',
    minHeight: 'calc(100vh - 44px)',
  },
  mobileWrapper: {
    width: '100%',
    background: 'transparent',
    borderRadius: '10px',
    padding: '0',
    boxSizing: 'border-box',
  },
  mobileTabsContainer: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(18px)',
    border: '1.5px solid rgba(200,220,240,0.6)',
    borderRadius: '14px',
    marginBottom: '16px',
    boxShadow: '0 4px 20px rgba(0,100,180,0.06)',
  },
  tabs: {
    '& .MuiTab-root': {
      textTransform: 'none',
      fontSize: '13px',
      fontWeight: 500,
      minWidth: 'auto',
      padding: '10px 16px',
      color: '#374151',
    },
    '& .Mui-selected': {
      color: '#0077cc',
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#0077cc',
    },
  },
  loadingFallback: {
    padding: '24px 0',
  },
};

const LoadingFallback = () => (
  <Box sx={platformStyles.loadingFallback}>
    <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
    <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: '12px' }} />
  </Box>
);

const SettingsContent = () => {
  const { state, dispatch } = useSettings();
  const { visibleSections } = useSettingsVisibility();
  const isMobile = useMediaQuery('(max-width:768px)');
  const { activeSection } = state;

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || 'profile';
      dispatch({ type: 'SET_ACTIVE_SECTION', payload: hash });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [dispatch]);

  const handleMobileTabChange = (event, newValue) => {
    window.location.hash = newValue;
  };

  const ActiveComponent = sectionComponents[activeSection];

  if (isMobile) {
    return (
      <Box sx={platformStyles.mobileContainer}>
        <Box sx={platformStyles.mobileWrapper}>
          <Box sx={platformStyles.mobileTabsContainer}>
            <Tabs
              value={activeSection}
              onChange={handleMobileTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={platformStyles.tabs}
            >
              {visibleSections.map((section) => (
                <Tab
                  key={section.id}
                  label={section.label}
                  value={section.id}
                  data-testid={`mobile-tab-${section.id}`}
                />
              ))}
            </Tabs>
          </Box>
          <Suspense fallback={<LoadingFallback />}>
            {ActiveComponent && <ActiveComponent />}
          </Suspense>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={platformStyles.container}>
      <Box sx={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ fontSize: '26px', fontWeight: 1000, color: '#0d1b35', fontFamily: "'Nunito', sans-serif" }}>
            Configuration <span style={{ color: '#f97316' }}>Management</span>
          </Box>
          <Box sx={{ fontSize: '13px', color: '#2a4a6e', fontWeight: 600, mt: 0.5 }}>
            Manage your account settings, security, notifications, and preferences
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: '24px' }}>
          <Box sx={platformStyles.navPanel}>
            <SettingsNav />
          </Box>
          <Box sx={platformStyles.content}>
            <Suspense fallback={<LoadingFallback />}>
              {ActiveComponent && <ActiveComponent />}
            </Suspense>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const SettingsPlatform = () => {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  );
};

export default SettingsPlatform;
