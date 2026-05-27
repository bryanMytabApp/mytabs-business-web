import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, MenuItem, CircularProgress, Tabs, Tab, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SettingsCard from '../components/SettingsCard';
import SettingsToggle from '../components/SettingsToggle';
import SettingsFieldGroup from '../components/SettingsFieldGroup';
import { useSettings } from '../context/SettingsContext';
import { getBusiness, updateBusiness } from '../../../services/businessService';
import { getMyOrganizations, getOrganizationBusinesses, getOrganization } from '../../../services/organizationService';
import { getUserById } from '../../../services/userService';
import { getEventsByUserId } from '../../../services/eventService';
import { parseJwt } from '../../../utils/common';

const orgVisibilityOptions = [
  { id: 'public', label: 'Public', desc: 'Visible to every Tabs customer and public apps' },
  { id: 'private', label: 'Private', desc: 'Only visible to members of your organization' },
];

const businessVisibilityOptions = [
  { id: 'public', label: 'Public', desc: 'Visible to every Tabs customer and public apps' },
  { id: 'organization', label: 'Organization Only', desc: 'Only visible to members of your organization on Tabs' },
  { id: 'private', label: 'Private', desc: 'Only visible to members of this business' },
];

const radioStyle = (isSelected) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 16px',
  borderRadius: '8px',
  border: `1px solid ${isSelected ? '#4F46E5' : '#E5E7EB'}`,
  backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
  cursor: 'pointer',
  transition: 'all 0.2s',
});

const PrivacySection = () => {
  const { state } = useSettings();
  const [loading, setLoading] = useState(true);
  const [, setSaving] = useState(false);
  const [privacyTab, setPrivacyTab] = useState(0);
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [showLocation, setShowLocation] = useState(true);

  // Business visibility (org owner feature)
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const [orgRole, setOrgRole] = useState(null); // 'owner', 'admin', 'member'
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [businessVisibility, setBusinessVisibility] = useState('public');
  const [businessShowLocation, setBusinessShowLocation] = useState(true);
  const [businessData, setBusinessData] = useState(null);
  const [businessDirty, setBusinessDirty] = useState(false);

  const [originalProfile, setOriginalProfile] = useState({});
  const [profileDirty, setProfileDirty] = useState(false);

  // Event visibility summary state
  const [businessEvents, setBusinessEvents] = useState([]);
  const [customVisibilityCount, setCustomVisibilityCount] = useState(0);

  // Confirmation dialog state for bulk event visibility update
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);
  const [pendingVisibilityChange, setPendingVisibilityChange] = useState(null);

  // Data export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [lastExported, setLastExported] = useState(() => {
    return localStorage.getItem('dataExportLastDate') || null;
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const userId = parseJwt(localStorage.getItem('idToken'));
        if (!userId) { setLoading(false); return; }

        // Load user's business for profile visibility
        const bizRes = await getBusiness(userId);
        const biz = bizRes?.data;
        if (biz) {
          const vis = biz.visibility || 'public';
          setProfileVisibility(vis);
          setShowLocation(biz.showLocation !== false);
          setOriginalProfile({ visibility: vis, showLocation: biz.showLocation !== false });
        }

        // Check if org owner
        try {
          const orgsRes = await getMyOrganizations();
          const orgs = orgsRes?.data?.organizations || orgsRes?.data || [];
          if (orgs.length > 0) {
            const role = orgs[0].role || 'member';
            setOrgRole(role);
            if (role === 'owner') {
              setIsOrgOwner(true);
              const orgId = orgs[0].organizationId || orgs[0].id;
              const bizListRes = await getOrganizationBusinesses(orgId);
              const bizList = bizListRes?.data?.businesses || bizListRes?.data || [];
              setBusinesses([{ linkedBusinessId: orgId, name: orgs[0].name + ' (Primary)' }, ...bizList]);
            } else if (role === 'admin') {
              // Admin can manage their assigned business visibility
              setIsOrgOwner(false);
            }
          }
        } catch (e) { /* not in org */ }
      } catch (err) {
        console.error('Failed to load privacy settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [state.user?.userId]);

  // Track profile dirty state
  useEffect(() => {
    const dirty = profileVisibility !== originalProfile.visibility || showLocation !== originalProfile.showLocation;
    setProfileDirty(dirty);
  }, [profileVisibility, showLocation, originalProfile]);

  // Load business visibility when a business is selected (or auto-load for admins)
  useEffect(() => {
    const loadBizVisibility = async () => {
      const userId = parseJwt(localStorage.getItem('idToken'));
      if (!userId) return;

      // For admins: auto-load their assigned business
      if (orgRole === 'admin' && !selectedBusinessId) {
        try {
          const res = await getBusiness(userId);
          const biz = res?.data;
          if (Array.isArray(biz)) {
            setBusinessData(biz[0]);
            setBusinessVisibility(biz[0]?.visibility || 'public');
            setBusinessShowLocation(biz[0]?.showLocation !== false);
          } else if (biz) {
            setBusinessData(biz);
            setBusinessVisibility(biz.visibility || 'public');
            setBusinessShowLocation(biz.showLocation !== false);
          }
          setBusinessDirty(false);
        } catch (e) { console.error('Failed to load business for admin:', e); }
        return;
      }

      // For org owners: load selected business
      if (!selectedBusinessId) return;
      try {
        const res = await getBusiness(userId, selectedBusinessId);
        const biz = res?.data;
        if (biz) {
          setBusinessData(biz);
          setBusinessVisibility(biz.visibility || 'public');
          setBusinessShowLocation(biz.showLocation !== false);
          setBusinessDirty(false);
        }
      } catch (e) { console.error('Failed to load business:', e); }
    };
    loadBizVisibility();
  }, [selectedBusinessId, orgRole]);

  // Fetch events for the selected business and compute custom visibility count
  useEffect(() => {
    const fetchBusinessEvents = async () => {
      if (!businessData) {
        setBusinessEvents([]);
        setCustomVisibilityCount(0);
        return;
      }
      try {
        const userId = businessData.userId || parseJwt(localStorage.getItem('idToken'));
        if (!userId) return;
        const eventsRes = await getEventsByUserId(userId);
        const events = eventsRes?.data || [];
        setBusinessEvents(events);
        const currentBizVisibility = businessData.visibility || 'public';
        const count = events.filter(evt => evt.visibility && evt.visibility !== currentBizVisibility).length;
        setCustomVisibilityCount(count);
      } catch (e) {
        console.error('Failed to fetch events for visibility summary:', e);
        setBusinessEvents([]);
        setCustomVisibilityCount(0);
      }
    };
    fetchBusinessEvents();
  }, [businessData]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const userId = parseJwt(localStorage.getItem('idToken'));
      const bizRes = await getBusiness(userId);
      const biz = bizRes?.data;
      if (biz) {
        await updateBusiness({ ...biz, visibility: profileVisibility, showLocation });
        setOriginalProfile({ visibility: profileVisibility, showLocation });
      }
    } catch (err) {
      console.error('Failed to save privacy settings:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusinessVisibility = async () => {
    if (!businessData) return;

    // Check if visibility is changing and there are events to potentially update
    const originalVisibility = businessData.visibility || 'public';
    if (businessVisibility !== originalVisibility && businessEvents.length > 0) {
      setPendingVisibilityChange(businessVisibility);
      setShowBulkUpdateDialog(true);
      return;
    }

    // No visibility change or no events — save directly
    setSaving(true);
    try {
      await updateBusiness({ ...businessData, visibility: businessVisibility, showLocation: businessShowLocation });
      setBusinessData({ ...businessData, visibility: businessVisibility, showLocation: businessShowLocation });
      setBusinessDirty(false);
    } catch (err) {
      console.error('Failed to save business visibility:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdateConfirm = async (updateEvents) => {
    setShowBulkUpdateDialog(false);
    setSaving(true);
    try {
      const payload = {
        ...businessData,
        visibility: pendingVisibilityChange,
        showLocation: businessShowLocation,
      };
      if (updateEvents) {
        payload.updateEventVisibility = true;
      }
      await updateBusiness(payload);
      setBusinessData({ ...businessData, visibility: pendingVisibilityChange, showLocation: businessShowLocation });
      setBusinessDirty(false);

      // Refresh event count after bulk update
      if (updateEvents) {
        setCustomVisibilityCount(0);
      }
    } catch (err) {
      console.error('Failed to save business visibility:', err);
      throw err;
    } finally {
      setSaving(false);
      setPendingVisibilityChange(null);
    }
  };

  const handleDownloadData = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const userId = parseJwt(localStorage.getItem('idToken'));
      if (!userId) throw new Error('Not authenticated');

      // Fetch all user data from existing live endpoints in parallel
      const [userRes, eventsRes, businessRes, orgsRes] = await Promise.all([
        getUserById(userId).catch(() => null),
        getEventsByUserId(userId).catch(() => null),
        getBusiness(userId).catch(() => null),
        getMyOrganizations().catch(() => null),
      ]);

      const user = userRes?.data;
      const events = eventsRes?.data || [];
      const business = businessRes?.data;
      const orgs = orgsRes?.data?.organizations || orgsRes?.data || [];

      // Fetch full organization details + all businesses for each org
      let organizationData = [];
      let allBusinessDetails = [];
      for (const org of orgs) {
        const orgId = org.organizationId || org.id;
        try {
          const [orgDetailRes, orgBizRes] = await Promise.all([
            getOrganization(orgId).catch(() => null),
            getOrganizationBusinesses(orgId).catch(() => null),
          ]);
          const orgDetail = orgDetailRes?.data || org;
          const orgBusinesses = orgBizRes?.data?.businesses || orgBizRes?.data || [];

          // Fetch full details for each business in the org
          for (const orgBiz of orgBusinesses) {
            const bizId = orgBiz.linkedBusinessId || orgBiz._id;
            if (bizId) {
              try {
                const bizDetailRes = await getBusiness(userId, bizId);
                const bizDetail = bizDetailRes?.data;
                if (bizDetail && bizDetail._id) {
                  allBusinessDetails.push(bizDetail);
                }
              } catch (e) {
                // If we can't fetch details, use what we have from org list
                allBusinessDetails.push(orgBiz);
              }
            }
          }

          organizationData.push({
            name: orgDetail.name || null,
            description: orgDetail.description || null,
            role: org.role || null,
            accountType: orgDetail.accountType || null,
            taxId: orgDetail.taxId || null,
            taxRate: orgDetail.taxRate || null,
            taxJurisdiction: orgDetail.taxJurisdiction || null,
            createdAt: orgDetail.createdAt || null,
            businesses: orgBusinesses.map(b => ({
              name: b.name || null,
              status: b.status || null,
              inheritTax: b.inheritTax,
              linkedAt: b.linkedAt || null,
            })),
          });
        } catch (e) {
          organizationData.push({ name: org.name || null, role: org.role || null });
        }
      }

      // If no org businesses were found, fall back to the primary business
      if (allBusinessDetails.length === 0 && business && business._id) {
        allBusinessDetails.push(business);
      }

      // Sanitize business data - only customer-provided fields
      const sanitizedBusinesses = allBusinessDetails.map(biz => ({
        name: biz.name || null,
        description: biz.description || null,
        address1: biz.address1 || null,
        city: biz.city || null,
        state: biz.state || null,
        zipCode: biz.zipCode || null,
        phoneNumber: biz.phoneNumber || null,
        website: biz.website || null,
        designation: biz.designation || null,
        categories: biz.categories || [],
        type: biz.type || null,
        visibility: biz.visibility || null,
        showLocation: biz.showLocation !== false,
        status: biz.status || null,
        createdAt: biz.createdAt || null,
      }));

      // Build export with only customer-provided data (no proprietary/derived fields)
      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: user ? {
          email: user.email || null,
          username: user.username || null,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          displayName: user.displayName || null,
          phoneNumber: user.phoneNumber || null,
          address1: user.address1 || null,
          address2: user.address2 || null,
          zipCode: user.zipCode || null,
          city: user.city || null,
          state: user.state || null,
          timezone: user.timezone || null,
          language: user.language || null,
          interests: user.interests || [],
          profilePictureUrl: user.profilePictureUrl || null,
          isPrivate: user.isPrivate || false,
          showInAttendeeList: user.showInAttendeeList !== false,
          createdAt: user.createdAt || null,
        } : null,
        organizations: organizationData.length > 0 ? organizationData : null,
        businesses: sanitizedBusinesses.length > 0 ? sanitizedBusinesses : null,
        events: (Array.isArray(events) ? events : []).map(evt => ({
          name: evt.name || null,
          description: evt.description || null,
          startDate: evt.startDate || null,
          endDate: evt.endDate || null,
          address1: evt.address1 || null,
          city: evt.city || null,
          state: evt.state || null,
          zipCode: evt.zipCode || null,
          categories: evt.categories || [],
          hasTickets: evt.hasTickets || false,
          tickets: (evt.tickets || []).map(t => ({
            type: t.type || null,
            option: t.option || null,
            customLabel: t.customLabel || null,
            description: t.description || null,
          })),
          createdAt: evt.createdAt || null,
        })),
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Track last export date
      const now = new Date().toISOString();
      localStorage.setItem('dataExportLastDate', now);
      setLastExported(now);
    } catch (err) {
      console.error('Data export failed:', err);
      setExportError('Failed to export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Box data-testid="section-privacy" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Members cannot access privacy settings at all
  if (orgRole === 'member') {
    return (
      <Box data-testid="section-privacy" sx={{ py: 4 }}>
        <SettingsCard title="Privacy Settings" subtitle="Access restricted">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <Typography sx={{ fontSize: '48px' }}>🔒</Typography>
            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
              Not Authorized
            </Typography>
            <Typography sx={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', maxWidth: 400 }}>
              You do not have permission to update privacy settings. Only business admins and organization owners can manage these settings.
            </Typography>
          </Box>
        </SettingsCard>
      </Box>
    );
  }

  // Determine which tabs to show based on role
  const showOrgTab = isOrgOwner; // Only org owners see the Organization tab
  const showBusinessTab = isOrgOwner || orgRole === 'admin'; // Owners and admins see Business tab

  return (
    <Box data-testid="section-privacy">
      <Tabs
        value={privacyTab}
        onChange={(e, v) => setPrivacyTab(v)}
        sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontSize: '14px', fontWeight: 500, minWidth: 'auto', padding: '8px 16px' }, '& .Mui-selected': { color: '#4F46E5' }, '& .MuiTabs-indicator': { backgroundColor: '#4F46E5' } }}
      >
        {showOrgTab && <Tab label="Organization" />}
        {showBusinessTab && <Tab label="Business" />}
        <Tab label="Data Export" />
      </Tabs>

      {/* Organization Visibility (org owners only) */}
      {showOrgTab && privacyTab === 0 && (
      <SettingsCard
        title="Visibility Settings"
        subtitle="Control who can see your information"
        dirty={profileDirty}
        onSave={handleSaveProfile}
        onCancel={() => { setProfileVisibility(originalProfile.visibility); setShowLocation(originalProfile.showLocation); }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SettingsFieldGroup label="Profile Visibility">
            <Box sx={{ display: 'flex', gap: '12px' }} role="radiogroup" aria-label="Profile visibility">
              {orgVisibilityOptions.map((option) => (
                <Box
                  key={option.id}
                  sx={radioStyle(profileVisibility === option.id)}
                  onClick={() => setProfileVisibility(option.id)}
                  role="radio"
                  aria-checked={profileVisibility === option.id}
                  tabIndex={0}
                >
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${profileVisibility === option.id ? '#4F46E5' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {profileVisibility === option.id && <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4F46E5' }} />}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{option.label}</Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>{option.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </SettingsFieldGroup>

          <SettingsToggle label="Show Location" description="Display your business location on your public profile" checked={showLocation} onChange={setShowLocation} />
        </Box>
      </SettingsCard>
      )}

      {/* Business Visibility (org owners and admins) */}
      {showBusinessTab && privacyTab === (showOrgTab ? 1 : 0) && (
      <SettingsCard
        title="Business Visibility"
        subtitle="Control visibility for your business"
        dirty={businessDirty}
        onSave={handleSaveBusinessVisibility}
        onCancel={() => { if (businessData) { setBusinessVisibility(businessData.visibility || 'public'); setBusinessShowLocation(businessData.showLocation !== false); setBusinessDirty(false); } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Org owners see a business selector; admins see their assigned business directly */}
          {isOrgOwner && businesses.length > 0 && (
            <TextField select label="Select Business" fullWidth size="small" value={selectedBusinessId} onChange={(e) => setSelectedBusinessId(e.target.value)} InputProps={{ sx: { borderRadius: '8px' } }}>
              <MenuItem value="">— Select a business —</MenuItem>
              {businesses.filter(b => b.linkedBusinessId !== (businesses[0]?.linkedBusinessId)).map(b => (<MenuItem key={b.linkedBusinessId || b._id} value={b.linkedBusinessId || b._id}>{b.name}</MenuItem>))}
            </TextField>
          )}

          {!selectedBusinessId && !businessData && isOrgOwner && (
            <Typography sx={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', py: 2 }}>Select a business above to manage its visibility settings</Typography>
          )}

          {(selectedBusinessId || businessData) && businessData && (
            <>
              <SettingsFieldGroup label={`Visibility for ${businessData.name || 'Business'}`}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }} role="radiogroup">
                  {businessVisibilityOptions.map((option) => (
                    <Box key={option.id} sx={radioStyle(businessVisibility === option.id)} onClick={() => { setBusinessVisibility(option.id); setBusinessDirty(true); }} role="radio" aria-checked={businessVisibility === option.id}>
                      <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${businessVisibility === option.id ? '#4F46E5' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {businessVisibility === option.id && <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4F46E5' }} />}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{option.label}</Typography>
                        <Typography sx={{ fontSize: '11px', color: '#6B7280' }}>{option.desc}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </SettingsFieldGroup>
              <SettingsToggle label="Show Business Location" description="Display this business's location on the public listing" checked={businessShowLocation} onChange={(v) => { setBusinessShowLocation(v); setBusinessDirty(true); }} />

              {/* Event visibility summary */}
              {customVisibilityCount > 0 && (
                <Box sx={{ mt: 1, px: 2, py: 1.5, backgroundColor: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
                    {customVisibilityCount} {customVisibilityCount === 1 ? 'event has' : 'events have'} custom visibility settings
                  </Typography>
                </Box>
              )}
            </>
          )}

        </Box>
      </SettingsCard>
      )}

      {/* Data Export tab */}
      {privacyTab === ((showOrgTab ? 1 : 0) + (showBusinessTab ? 1 : 0)) && (
      <SettingsCard title="Data Export" subtitle="Download a copy of your personal data">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Typography sx={{ fontSize: '14px', color: '#6B7280' }}>
            Request a copy of all data associated with your account. This includes your profile information, activity history, and preferences.
          </Typography>
          {exportError && (
            <Alert severity="error" onClose={() => setExportError(null)} sx={{ borderRadius: '8px' }}>
              {exportError}
            </Alert>
          )}
          <Box>
            <Button
              variant="contained"
              onClick={handleDownloadData}
              disabled={exporting}
              sx={{ backgroundColor: '#4F46E5', textTransform: 'none', fontWeight: 500, fontSize: '14px', borderRadius: '8px', padding: '9px 18px', '&:hover': { backgroundColor: '#4338CA' }, '&:disabled': { backgroundColor: '#A5B4FC' } }}
              disableElevation
            >
              {exporting ? <><CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} /> Preparing Export...</> : 'Download My Data'}
            </Button>
          </Box>
          <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>
            Last exported: {lastExported ? new Date(lastExported).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
          </Typography>
        </Box>
      </SettingsCard>
      )}

      {/* Bulk event visibility update confirmation dialog */}
      <Dialog
        open={showBulkUpdateDialog}
        onClose={() => { setShowBulkUpdateDialog(false); setPendingVisibilityChange(null); }}
        aria-labelledby="bulk-update-dialog-title"
      >
        <DialogTitle id="bulk-update-dialog-title">Update Event Visibility</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: '#374151' }}>
            Would you like to update all events to match the new business visibility?
          </Typography>
          {customVisibilityCount > 0 && (
            <Typography sx={{ fontSize: '13px', color: '#6B7280', mt: 1 }}>
              {customVisibilityCount} {customVisibilityCount === 1 ? 'event currently has' : 'events currently have'} custom visibility settings that will be overwritten.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleBulkUpdateConfirm(false)}
            sx={{ textTransform: 'none', color: '#6B7280' }}
          >
            No, keep event settings
          </Button>
          <Button
            onClick={() => handleBulkUpdateConfirm(true)}
            variant="contained"
            sx={{ textTransform: 'none', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}
            disableElevation
          >
            Yes, update all events
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrivacySection;
