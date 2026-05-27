import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  IconButton,
  Slider,
  Autocomplete,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SettingsCard from '../components/SettingsCard';
import { useSettings } from '../context/SettingsContext';
import { getBusiness, getPresignedUrlForBusiness, updateBusiness } from '../../../services/businessService';
import { getBusinessPicture } from '../../../utils/common';
import {
  getOrganization,
  getOrganizationBusinesses,
  getOrganizationMembers,
  getMyOrganizations,
  linkBusiness,
  unlinkBusiness,
  addMember,
  changeMemberRole,
  submitOrgRequest,
} from '../../../services/organizationService';
import { parseJwt } from '../../../utils/common';
import { formatPhone, unformatPhone } from '../../../utils/phoneMask';
import categoriesData from '../../../utils/data/categories';

const statBoxStyle = {
  flex: 1,
  backgroundColor: '#FAFBFC',
  borderRadius: '10px',
  padding: '20px 16px',
  textAlign: 'center',
};

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  fontSize: '14px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  outline: 'none',
  fontFamily: 'inherit',
};

const tableStyles = {
  headerCell: {
    fontWeight: 600,
    fontSize: '11px',
    color: '#6B7280',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB',
    padding: '8px 8px',
    backgroundColor: '#F9FAFB',
    whiteSpace: 'nowrap',
  },
  bodyCell: {
    fontSize: '13px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
    padding: '8px',
    whiteSpace: 'nowrap',
  },
};

// Pricing: $50/business, 0.25% discount per bundle of 10 (matches admin SubscriptionSetupForm)
const calculateSubscriptionPrice = (count, interval) => {
  const bundle = Math.floor((count - 1) / 10);
  const discount = 1 - (bundle * 0.0025);
  const perBiz = 50 * discount;
  const monthly = count * perBiz;
  if (interval === 'yearly') return monthly * 12;
  if (interval === 'quarterly') return monthly * 3;
  return monthly;
};

const dialogStyles = {
  paper: {
    borderRadius: '12px',
    padding: '8px',
    maxWidth: '480px',
    width: '100%',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
    padding: '16px 24px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    padding: '16px 24px',
  },
  actions: {
    padding: '12px 24px 20px',
    gap: '12px',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    color: '#fff',
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '14px',
    borderRadius: '8px',
    padding: '9px 20px',
    '&:hover': { backgroundColor: '#4338CA' },
    '&:disabled': { backgroundColor: '#C7D2FE', color: '#fff' },
  },
  cancelButton: {
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '14px',
    borderRadius: '8px',
    padding: '9px 20px',
    color: '#6B7280',
    borderColor: '#E5E7EB',
    '&:hover': { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' },
  },
};

const OrganizationSection = () => {
  const { state } = useSettings();
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [members, setMembers] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [hasOrg, setHasOrg] = useState(false);
  const [orgLogo, setOrgLogo] = useState(null);

  // Add Business Dialog state
  const [addBusinessOpen, setAddBusinessOpen] = useState(false);
  const [businessMode, setBusinessMode] = useState('create'); // 'create' | 'invite'
  const [businessForm, setBusinessForm] = useState({
    name: '',
    address1: '',
    city: '',
    state: '',
    zipCode: '',
    designation: '',
    categories: [],
  });
  const [inviteForm, setInviteForm] = useState({ businessId: '', message: '' });
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [businessError, setBusinessError] = useState('');
  const businessAddressRef = useRef(null);
  const businessAutocompleteRef = useRef(null);

  // Add Member Dialog state
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberMode, setMemberMode] = useState('existing'); // 'existing' | 'invite' | 'create'
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'member', businessId: '' });
  const [createMemberForm, setCreateMemberForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Inline edit member state
  const [editingMember, setEditingMember] = useState(null); // userId of member being edited
  const [editMemberForm, setEditMemberForm] = useState({ role: '', businessId: '' });
  const [editMemberSaving, setEditMemberSaving] = useState(false);

  // Subscription change state
  const [showSubscriptionChange, setShowSubscriptionChange] = useState(false);
  const [subInterval, setSubInterval] = useState('monthly');
  const [subLocationCount, setSubLocationCount] = useState(1);
  const [subMessage, setSubMessage] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);
  const subscriptionCardRef = useRef(null);

  // Copy code feedback state
  const [codeCopied, setCodeCopied] = useState(null);
  const [orgTab, setOrgTab] = useState(0); // stores the code that was just copied

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken'));
        if (!userId) {
          setLoading(false);
          return;
        }

        // Get the user's organization ID
        let orgId = null;
        try {
          const myOrgsRes = await getMyOrganizations();
          const orgs = myOrgsRes?.data?.organizations || myOrgsRes?.data || [];
          if (orgs.length > 0) {
            orgId = orgs[0].organizationId || orgs[0].id || orgs[0]._id;
          }
        } catch (e) {
          // Fallback: get org ID from the user's business
          try {
            const businessRes = await getBusiness(userId);
            const business = businessRes?.data;
            if (business) {
              orgId = business.organizationId || (business.accountType === 'organization' ? business._id : null);
            }
          } catch (bizErr) { /* no business */ }
        }

        if (!orgId) {
          setHasOrg(false);
          setLoading(false);
          return;
        }

        // Fetch org details, businesses, and members in parallel
        const [orgRes, bizRes, memRes] = await Promise.all([
          getOrganization(orgId).catch(() => null),
          getOrganizationBusinesses(orgId).catch(() => null),
          getOrganizationMembers(orgId).catch(() => null),
        ]);

        const org = orgRes?.data;
        if (!org) {
          setHasOrg(false);
          setLoading(false);
          return;
        }

        setOrgData({
          id: org.organizationId || orgId,
          name: org.name || 'My Organization',
          createdAt: org.createdAt ? new Date(org.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A',
          memberCount: org.memberCount || 0,
          activeBusiness: org.linkedBusinessCount || 0,
          plan: org.plan || 'custom',
          interval: org.interval || 'monthly',
          businessLimit: org.businessLimit || 1,
          stripeSubscriptionId: org.stripeSubscriptionId || null,
          amount: org.amount || null,
          orgCode: org.orgCode || null,
          userRole: org.userRole || 'member',
        });
        console.log('[OrgSection] Org data from API:', { orgCode: org.orgCode, businessCode: org.businessCode, name: org.name });
        setNameValue(org.name || '');
        setHasOrg(true);

        // Set businesses
        if (bizRes?.data) {
          const bizList = bizRes.data.businesses || bizRes.data;
          console.log('[OrgSection] Businesses from API:', JSON.stringify(bizList));
          const bizArray = Array.isArray(bizList) ? bizList : [];
          // The list endpoint already returns businessCode + status per
          // business (see mytabs-backend/.../getOrgBusinesses.js), so set
          // them once. Earlier we had an N+1 fan-out here that called
          // getBusiness() per linked business — that made the page feel
          // slow on orgs with several businesses and was redundant.
          setBusinesses(bizArray);
        }

        // Set members
        if (memRes?.data) {
          const memList = memRes.data.members || memRes.data;
          setMembers(Array.isArray(memList) ? memList : []);
        }
      } catch (err) {
        console.error('Failed to fetch org data:', err);
        setHasOrg(false);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgData();
  }, [state.user?.userId]);

  // Initialize Google Places Autocomplete when Add Business dialog opens
  useEffect(() => {
    if (!addBusinessOpen) return;

    // Ensure .pac-container appears above MUI Dialog (z-index 1300)
    if (!document.getElementById('pac-container-zindex')) {
      const style = document.createElement('style');
      style.id = 'pac-container-zindex';
      style.textContent = '.pac-container { z-index: 1500 !important; }';
      document.head.appendChild(style);
    }

    // Wait for dialog to fully render and input ref to be available
    const timer = setTimeout(() => {
      const input = businessAddressRef.current;
      if (!input) {
        console.warn('Address input not available');
        return;
      }

      import('../../../utils/googleMaps').then(({ loadGoogleMaps }) => loadGoogleMaps()).then(() => {
        if (!businessAddressRef.current) return;
        console.log('Initializing Google Places Autocomplete on address input');

        businessAutocompleteRef.current = new window.google.maps.places.Autocomplete(
          businessAddressRef.current,
          {
            types: ['address'],
            componentRestrictions: { country: 'us' },
          }
        );

        businessAutocompleteRef.current.addListener('place_changed', () => {
          const place = businessAutocompleteRef.current.getPlace();
          if (!place.address_components) return;

          let streetNumber = '';
          let route = '';
          let city = '';
          let state = '';
          let zipCode = '';

          place.address_components.forEach(component => {
            const types = component.types;
            if (types.includes('street_number')) streetNumber = component.long_name;
            if (types.includes('route')) route = component.long_name;
            if (types.includes('locality')) {
              city = component.long_name;
            } else if (!city && types.includes('sublocality_level_1')) {
              city = component.long_name;
            } else if (!city && types.includes('sublocality')) {
              city = component.long_name;
            } else if (!city && types.includes('postal_town')) {
              city = component.long_name;
            } else if (!city && types.includes('administrative_area_level_3')) {
              city = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) state = component.long_name;
            if (types.includes('postal_code')) zipCode = component.long_name;
          });

          const fullAddress = `${streetNumber} ${route}`.trim();
          setBusinessForm(prev => ({
            ...prev,
            address1: fullAddress,
            city,
            state,
            zipCode,
          }));
        });
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      if (businessAutocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(businessAutocompleteRef.current);
        businessAutocompleteRef.current = null;
      }
    };
  }, [addBusinessOpen]);

  const handleSaveOrgName = async () => {
    // Update org name
    setOrgData(prev => prev ? { ...prev, name: nameValue } : prev);
    setEditingName(false);

    // Upload org logo if changed
    if (orgLogo) {
      try {
        const userId = parseJwt(localStorage.getItem('idToken'));
        console.log('[OrgLogo] userId:', userId);
        console.log('[OrgLogo] orgLogo length:', orgLogo?.length);
        if (!userId) throw new Error('No userId from parseJwt');
        const res = await getPresignedUrlForBusiness(userId);
        console.log('[OrgLogo] presigned URL response:', res);
        const presignedUrl = res.data;
        console.log('[OrgLogo] presignedUrl:', presignedUrl);
        const base64Response = await fetch(orgLogo);
        const blob = await base64Response.blob();
        console.log('[OrgLogo] blob size:', blob.size, 'type:', blob.type);
        const uploadRes = await fetch(presignedUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'image/png' } });
        console.log('[OrgLogo] upload status:', uploadRes.status, uploadRes.statusText);
      } catch (err) {
        console.error('[OrgLogo] Failed to upload org logo:', err);
      }
    }
    setOrgLogo(null);
  };

  // --- Add Business Dialog handlers ---
  const handleOpenAddBusiness = () => {
    setBusinessMode('create');
    setBusinessForm({ name: '', address1: '', city: '', state: '', zipCode: '', designation: '', categories: [] });
    setInviteForm({ businessId: '', message: '' });
    setBusinessError('');
    setAddBusinessOpen(true);
  };

  const handleCloseAddBusiness = () => {
    setAddBusinessOpen(false);
    setBusinessError('');
  };

  const handleSubmitBusiness = async () => {
    if (businessMode === 'create') {
      if (!businessForm.name) {
        setBusinessError('Business name is required.');
        return;
      }
    } else {
      if (!inviteForm.businessId) {
        setBusinessError('Business code or ID is required.');
        return;
      }
    }
    setBusinessSubmitting(true);
    setBusinessError('');
    console.log('[OrgSection] Creating business:', { orgId: orgData.id, mode: businessMode, name: businessForm.name, details: businessForm });
    try {
      let res;
      if (businessMode === 'create') {
        res = await linkBusiness(orgData.id, null, businessForm.name, {
          address1: businessForm.address1,
          city: businessForm.city,
          state: businessForm.state,
          zipCode: businessForm.zipCode,
          designation: businessForm.designation,
          categories: businessForm.categories,
        });
      } else {
        // Determine if input is a business code or a UUID/ID
        const input = inviteForm.businessId.trim();
        const isBusinessCode = /^[A-Z0-9]+-.*BIZ-[A-Z0-9]{4}$/i.test(input) || /^BIZ-[A-Z0-9]{4}$/i.test(input);
        if (isBusinessCode) {
          // Link by business code
          res = await linkBusiness(orgData.id, null, null, { businessCode: input.toUpperCase() });
        } else {
          // Link by business ID (existing behavior)
          res = await linkBusiness(orgData.id, input, null);
        }
      }
      if (res?.data) {
        setBusinesses(prev => [...prev, res.data]);
        setOrgData(prev => prev ? { ...prev, activeBusiness: (prev.activeBusiness || 0) + 1 } : prev);
      }
      setAddBusinessOpen(false);
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to add business. Please try again.';
      // Provide user-friendly error messages for code-related errors
      if (errMsg.toLowerCase().includes('not found')) {
        setBusinessError('No business found with that code or ID. Please check and try again.');
      } else if (errMsg.toLowerCase().includes('already linked') || errMsg.toLowerCase().includes('already exists')) {
        setBusinessError('This business is already linked to your organization.');
      } else if (errMsg.toLowerCase().includes('invalid') && errMsg.toLowerCase().includes('code')) {
        setBusinessError('Invalid business code format. Codes look like BIZ-7K2M or URB-HTX-BIZ-293X.');
      } else {
        setBusinessError(errMsg);
      }
    } finally {
      setBusinessSubmitting(false);
    }
  };

  // --- Delete Business handler ---
  const [deleteBusinessConfirm, setDeleteBusinessConfirm] = useState({ open: false, id: null, name: '' });
  const [deleteBusinessLoading, setDeleteBusinessLoading] = useState(false);
  const [deleteBusinessAlso, setDeleteBusinessAlso] = useState(false);

  const handleDeleteBusiness = (businessId, businessName) => {
    setDeleteBusinessAlso(false);
    setDeleteBusinessConfirm({ open: true, id: businessId, name: businessName });
  };

  const handleConfirmDeleteBusiness = async () => {
    setDeleteBusinessLoading(true);
    try {
      await unlinkBusiness(orgData.id, deleteBusinessConfirm.id, deleteBusinessAlso);
      setBusinesses(prev => prev.filter(b => (b.linkedBusinessId || b._id) !== deleteBusinessConfirm.id));
      setOrgData(prev => prev ? { ...prev, activeBusiness: Math.max(0, (prev.activeBusiness || 1) - 1) } : prev);
      setDeleteBusinessConfirm({ open: false, id: null, name: '' });
    } catch (err) {
      console.error('Failed to remove business:', err);
    } finally {
      setDeleteBusinessLoading(false);
    }
  };

  // --- Add Member Dialog handlers ---
  const handleOpenAddMember = () => {
    setMemberMode('existing');
    setMemberForm({ userId: '', role: 'member', businessId: '' });
    setCreateMemberForm({ firstName: '', lastName: '', email: '', phone: '' });
    setMemberError('');
    setAddMemberOpen(true);
  };

  const handleCloseAddMember = () => {
    setAddMemberOpen(false);
    setMemberError('');
  };

  const handleSubmitMember = async () => {
    if (memberMode === 'create') {
      if (!createMemberForm.email) { setMemberError('Email is required.'); return; }
      if (!createMemberForm.firstName) { setMemberError('First name is required.'); return; }
      if (!memberForm.businessId) { setMemberError('Please select a business to link this member to.'); return; }
    } else {
      if (!memberForm.userId) { setMemberError('Please provide the user\'s email or Cognito ID.'); return; }
      if (!memberForm.businessId) { setMemberError('Please select a business to link this member to.'); return; }
    }
    setMemberSubmitting(true);
    setMemberError('');
    try {
      let res;
      if (memberMode === 'create') {
        res = await addMember(orgData.id, null, memberForm.role, memberForm.businessId, {
          mode: 'create',
          firstName: createMemberForm.firstName,
          lastName: createMemberForm.lastName,
          email: createMemberForm.email,
          phone: createMemberForm.phone,
          username: createMemberForm.username || '',
        });
      } else {
        res = await addMember(orgData.id, memberForm.userId, memberForm.role, memberForm.businessId);
      }
      if (res?.data) {
        setMembers(prev => [...prev, res.data]);
        setOrgData(prev => prev ? { ...prev, memberCount: (prev.memberCount || 0) + 1 } : prev);
      }
      setAddMemberOpen(false);
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to add member. Please try again.';
      if (err?.response?.status === 404) {
        setMemberError('User not found. This email is not registered on KeepTabs. The user must create an account first.');
      } else if (err?.response?.status === 409) {
        setMemberError('A user with this email already exists. Use "Add Existing User" instead.');
      } else {
        setMemberError(errMsg);
      }
    } finally {
      setMemberSubmitting(false);
    }
  };

  // --- Subscription change handlers ---
  const handleOpenSubscriptionChange = () => {
    setSubInterval(orgData?.interval || 'monthly');
    setSubLocationCount(orgData?.businessLimit || 1);
    setSubMessage('');
    setShowSubscriptionChange(true);
    setTimeout(() => {
      subscriptionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCloseSubscriptionChange = () => {
    setShowSubscriptionChange(false);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Also try the document's main scrollable elements
      document.querySelector('[data-testid="section-organization"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  const handleSubmitSubscriptionRequest = async () => {
    setSubSubmitting(true);
    try {
      const intervalLabels = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
      const intervalSuffix = { monthly: '/mo', quarterly: '/3mo', yearly: '/yr' };
      const price = calculateSubscriptionPrice(subLocationCount, subInterval);
      const reqMessage = `Plan Change — Businesses: ${subLocationCount}, Interval: ${intervalLabels[subInterval]}, Est. Price: $${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${intervalSuffix[subInterval]}${subMessage ? '\nNote: ' + subMessage : ''}`;
      await submitOrgRequest(orgData.id, 'Plan Change Request', reqMessage);
      setShowSubscriptionChange(false);
      setSubMessage('');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.querySelector('[data-testid="section-organization"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (err) {
      console.error('Failed to submit subscription request:', err);
    } finally {
      setSubSubmitting(false);
    }
  };

  // Copy code to clipboard with visual feedback
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(code);
      setTimeout(() => setCodeCopied(null), 2000);
    });
  };

  if (loading) {
    return (
      <Box data-testid="section-organization" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // No organization state
  if (!hasOrg || !orgData) {
    return (
      <Box data-testid="section-organization">
        <SettingsCard title="No Organization">
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <BusinessOutlinedIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 2 }} />
            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#111827', mb: 1 }}>
              You're not part of an organization yet
            </Typography>
            <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 3 }}>
              Create a new organization or join an existing one to collaborate with your team.
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.href = '/admin/service/organization'}
              sx={{ backgroundColor: '#4F46E5', textTransform: 'none', fontWeight: 600, fontSize: '14px', borderRadius: '8px', padding: '10px 24px', '&:hover': { backgroundColor: '#4338CA' } }}
              disableElevation
            >
              Get Started
            </Button>
          </Box>
        </SettingsCard>
      </Box>
    );
  }

  const isOrgOwner = orgData?.userRole === 'owner';

  // Non-owners only see Subscription tab (read-only view of their plan)
  if (!isOrgOwner) {
    return (
      <Box data-testid="section-organization">
        <SettingsCard title="Organization Membership" subtitle={`You are a member of ${orgData.name}`}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '10px', backgroundColor: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 700 }}>
                {orgData.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{orgData.name}</Typography>
                <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>Role: {orgData.userRole?.charAt(0).toUpperCase() + orgData.userRole?.slice(1)}</Typography>
              </Box>
              {orgData.orgCode && (
                <Box sx={{ ml: 2, padding: '4px 10px', backgroundColor: '#F5F3FF', borderRadius: '6px', border: '1px solid #E9E5FF' }}>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: '#4F46E5' }}>{orgData.orgCode}</Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: '16px' }}>
              <Box sx={{ flex: 1, backgroundColor: '#FAFBFC', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#4F46E5' }}>
                  {orgData.plan ? orgData.plan.charAt(0).toUpperCase() + orgData.plan.slice(1) : 'Custom'}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>Plan</Typography>
              </Box>
              <Box sx={{ flex: 1, backgroundColor: '#FAFBFC', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                  {orgData.interval === 'yearly' ? 'Yearly' : orgData.interval === 'quarterly' ? 'Quarterly' : 'Monthly'}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>Billing</Typography>
              </Box>
              <Box sx={{ flex: 1, backgroundColor: '#FAFBFC', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{orgData.activeBusiness}/{orgData.businessLimit}</Typography>
                <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>Locations</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
              Your subscription is managed by the organization owner. Contact them for plan changes.
            </Typography>
          </Box>
        </SettingsCard>
      </Box>
    );
  }

  return (
    <Box data-testid="section-organization">
      {/* Tabs */}
      <Tabs
        value={orgTab}
        onChange={(e, v) => setOrgTab(v)}
        sx={{
          mb: 2,
          '& .MuiTab-root': { textTransform: 'none', fontSize: '14px', fontWeight: 500, minWidth: 'auto', padding: '8px 16px' },
          '& .Mui-selected': { color: '#4F46E5' },
          '& .MuiTabs-indicator': { backgroundColor: '#4F46E5' },
        }}
      >
        <Tab label="Overview" />
        <Tab label="Subscription" />
        <Tab label="Businesses" />
        <Tab label="Members" />
      </Tabs>

      {/* Tab 0: Organization Info */}
      {orgTab === 0 && (
      <>
      {/* Organization Info Card */}
      <SettingsCard
        title="Organization Info"
        dirty={(editingName && nameValue !== orgData.name) || !!orgLogo}
        onSave={(editingName || orgLogo) ? handleSaveOrgName : undefined}
        onCancel={(editingName || orgLogo) ? () => { setNameValue(orgData.name); setEditingName(false); setOrgLogo(null); } : undefined}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '12px', backgroundColor: '#4F46E5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '20px', fontWeight: 700,
            }}>
              {orgData.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                {orgData.name}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: '#9CA3AF' }}>
                Created on {orgData.createdAt}
              </Typography>
            </Box>
            {/* Org Code — inline next to name */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', ml: 2, padding: '5px 12px', backgroundColor: '#F5F3FF', borderRadius: '8px', border: '1px solid #E9E5FF' }}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#4F46E5', letterSpacing: '1px' }}>
                {orgData.orgCode || (businesses.length > 0 && businesses[0]?.businessCode ? businesses[0].businessCode.split('-BIZ-')[0] : 'ORG-88CP')}
              </Typography>
              <Tooltip title={codeCopied ? 'Copied!' : 'Copy'}>
                <IconButton
                  size="small"
                  onClick={() => handleCopyCode(orgData.orgCode || (businesses.length > 0 && businesses[0]?.businessCode ? businesses[0].businessCode.split('-BIZ-')[0] : 'ORG-88CP'))}
                  sx={{ padding: '2px', color: codeCopied ? '#059669' : '#6B7280' }}
                >
                  <ContentCopyIcon sx={{ fontSize: '14px' }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Organization Name */}
          <Box sx={{ maxWidth: '60%' }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: '6px' }}>
              Organization Name
            </Typography>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => { setNameValue(e.target.value); if (!editingName) setEditingName(true); }}
              style={inputStyle}
            />
          </Box>

          {/* Stat Grid */}
          <Box sx={{ display: 'flex', gap: '16px' }}>
            <Box sx={statBoxStyle}>
              <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827', mb: '4px' }}>
                {members.length || orgData.memberCount}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>Total Members</Typography>
            </Box>
            <Box sx={statBoxStyle}>
              <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827', mb: '4px' }}>
                {businesses.length || orgData.activeBusiness}/{orgData.businessLimit}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>Locations Used</Typography>
            </Box>
            <Box sx={statBoxStyle}>
              <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#4F46E5', mb: '4px' }}>
                {orgData.plan ? orgData.plan.charAt(0).toUpperCase() + orgData.plan.slice(1) : 'Custom'}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
                {orgData.interval === 'yearly' ? 'Yearly' : orgData.interval === 'quarterly' ? 'Quarterly' : 'Monthly'}
              </Typography>
            </Box>
          </Box>

          {/* Logo upload — top right, large area */}
          <Box
            component="label"
            sx={{
              position: 'absolute', top: '-40px', right: 0,
              width: '200px', height: '160px', borderRadius: '12px',
              border: '2px dashed #E5E7EB', cursor: 'pointer',
              overflow: 'hidden', backgroundColor: '#FAFBFC',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              '&:hover': { borderColor: '#4F46E5', backgroundColor: '#F5F3FF' },
            }}
          >
            {orgLogo ? (
              <img src={orgLogo} alt="Org logo" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 2 }} />
            ) : (
              (() => {
                const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken'));
                const imgUrl = userId ? getBusinessPicture(userId) : null;
                return (
                  <img
                    src={imgUrl ? `${imgUrl}?t=${Date.now()}` : ''}
                    alt="Org logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 2 }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                );
              })()
            )}
            <Box sx={{ display: 'flex', width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' }}>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '1px', fontFamily: 'Outfit, sans-serif' }}>
                {orgData?.name || 'UrbanHTX'}
              </Typography>
            </Box>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setOrgLogo(ev.target.result);
                  reader.readAsDataURL(file);
                }
              }}
            />
          </Box>
        </Box>
      </SettingsCard>
      </>
      )}

      {/* Tab 1: Subscription */}
      {orgTab === 1 && (
      <>
      {/* Subscription Card */}
      <Box ref={subscriptionCardRef}>
      <SettingsCard
        title="Subscription"
        subtitle="Your organization billing plan"
      >
        {!showSubscriptionChange ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
            {/* Request Increase button — top right, aligned with card title */}
            {(orgData.businessLimit || 1) < 250 ? (
              <Box sx={{ position: 'absolute', top: '-52px', right: 0 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleOpenSubscriptionChange}
                  sx={{
                    borderColor: '#4F46E5',
                    color: '#4F46E5',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '13px',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    whiteSpace: 'nowrap',
                    '&:hover': { borderColor: '#4338CA', backgroundColor: '#EEF2FF' },
                  }}
                >
                  Request Increase
                </Button>
              </Box>
            ) : (
              <Box sx={{ position: 'absolute', top: '-48px', right: 0 }}>
                <Typography sx={{ fontSize: '12px', color: '#E65100', fontWeight: 600 }}>
                  Maximum reached
                </Typography>
              </Box>
            )}

            {/* Current plan summary */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '32px', flexWrap: 'wrap' }}>
              <Box>
                <Typography sx={{ fontSize: '12px', color: '#6B7280', mb: '4px' }}>Plan</Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                  {orgData.plan ? orgData.plan.charAt(0).toUpperCase() + orgData.plan.slice(1) : 'Custom'}
                  <Typography component="span" sx={{ fontSize: '13px', fontWeight: 400, color: '#6B7280', ml: 1 }}>
                    {orgData.interval === 'yearly' ? 'Yearly' : orgData.interval === 'quarterly' ? 'Quarterly' : 'Monthly'}
                  </Typography>
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', color: '#6B7280', mb: '4px' }}>Locations</Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                  {orgData.businessLimit || 1}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', color: '#6B7280', mb: '4px' }}>Price</Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                  ${calculateSubscriptionPrice(orgData.businessLimit || 1, orgData.interval || 'monthly').toLocaleString()}
                  <Typography component="span" sx={{ fontSize: '12px', fontWeight: 400, color: '#6B7280' }}>
                    {orgData.interval === 'yearly' ? '/yr' : orgData.interval === 'quarterly' ? '/3mo' : '/mo'}
                  </Typography>
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', color: '#6B7280', mb: '4px' }}>Status</Typography>
                <Chip
                  label="Active"
                  size="small"
                  sx={{ backgroundColor: '#E8F5E9', color: '#2E7D32', fontWeight: 500, fontSize: '12px', height: '24px' }}
                />
              </Box>
            </Box>
          </Box>
        ) : (
          /* Subscription change form */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Box>
              <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#111827', mb: '4px' }}>
                Request Plan Increase
              </Typography>
              <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
                Submit a request to increase your business count. Your current plan covers {orgData.businessLimit || 1} businesses.
              </Typography>
            </Box>

            {/* Billing interval toggle */}
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827', mb: 1 }}>Billing plan</Typography>
              <Box sx={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', width: 'fit-content' }}>
                {['monthly', 'quarterly', 'yearly'].map((int) => (
                  <Button
                    key={int}
                    size="small"
                    onClick={() => setSubInterval(int)}
                    sx={{
                      borderRadius: 0,
                      borderRight: int !== 'yearly' ? '1px solid #E5E7EB' : 'none',
                      backgroundColor: subInterval === int ? '#F09925' : '#fff',
                      color: subInterval === int ? '#fff' : '#6B7280',
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '13px',
                      padding: '6px 18px',
                      minWidth: 'auto',
                      '&:hover': { backgroundColor: subInterval === int ? '#d9871e' : '#F9FAFB' },
                    }}
                  >
                    {int === 'monthly' ? 'Monthly' : int === 'quarterly' ? 'Quarterly' : 'Yearly'}
                  </Button>
                ))}
              </Box>
            </Box>

            {/* Location count slider */}
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827', mb: 1 }}>
                Number of planned businesses
              </Typography>
              <Slider
                value={subLocationCount}
                onChange={(e, val) => setSubLocationCount(val)}
                min={orgData.businessLimit || 1}
                max={250}
                step={1}
                sx={{
                  color: '#F09925',
                  '& .MuiSlider-thumb': { width: 16, height: 16 },
                  '& .MuiSlider-track': { height: 6 },
                  '& .MuiSlider-rail': { height: 6, color: '#E5E7EB' },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '11px', color: '#9CA3AF' }}>{orgData.businessLimit || 1}</Typography>
                <Typography sx={{ fontSize: '11px', color: '#9CA3AF' }}>250</Typography>
              </Box>
            </Box>

            {/* Price preview */}
            <Box sx={{
              backgroundColor: '#FFF8E1',
              borderRadius: '10px',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#F09925' }}>
                {subLocationCount} businesses
              </Typography>
              <Typography sx={{ color: '#999' }}>·</Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>
                ${calculateSubscriptionPrice(subLocationCount, subInterval).toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
                {subInterval === 'yearly' ? '/yr' : subInterval === 'quarterly' ? '/3mo' : '/mo'}
              </Typography>
            </Box>

            {subLocationCount > 25 && (
              <Typography sx={{ fontSize: '11px', color: '#6B7280', textAlign: 'center' }}>
                Pricing beyond 25 businesses may have different contract rates. Our team will work with you on custom pricing.
              </Typography>
            )}

            {/* Optional message */}
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827', mb: '6px' }}>
                Anything else? (optional)
              </Typography>
              <TextField
                multiline
                minRows={2}
                fullWidth
                size="small"
                placeholder="Tell us more about your needs..."
                value={subMessage}
                onChange={(e) => setSubMessage(e.target.value)}
                InputProps={{ sx: { borderRadius: '8px', fontSize: '13px' } }}
              />
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="contained"
                onClick={handleSubmitSubscriptionRequest}
                disabled={subSubmitting}
                sx={{
                  backgroundColor: '#F09925',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                  borderRadius: '24px',
                  padding: '10px 24px',
                  '&:hover': { backgroundColor: '#d9871e' },
                  '&:disabled': { backgroundColor: '#FDDCAB', color: '#fff' },
                }}
                disableElevation
              >
                {subSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleCloseSubscriptionChange}
                disabled={subSubmitting}
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '14px',
                  borderRadius: '24px',
                  padding: '10px 24px',
                  color: '#6B7280',
                  borderColor: '#E5E7EB',
                  '&:hover': { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' },
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </SettingsCard>
      </Box>
      </>
      )}

      {/* Tab 2: Businesses */}
      {orgTab === 2 && (
      <>
      {/* Businesses Card */}
      <SettingsCard
        title="Linked Businesses"
        subtitle="Businesses in your organization"
      >
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: '-52px', right: 0, display: 'flex', gap: '8px' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleOpenAddBusiness}
              sx={{
                backgroundColor: '#4F46E5',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '13px',
                borderRadius: '8px',
                padding: '6px 14px',
                '&:hover': { backgroundColor: '#4338CA' },
              }}
              disableElevation
            >
              Add Business
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: '16px' }} />}
              onClick={() => {
                const headers = ['Name', 'Designation', 'Address', 'City', 'State', 'ZipCode', 'Categories', 'Code', 'Status', 'Linked Date'];
                const rows = businesses.map(biz => [
                  biz.name || '', biz.designation || '', biz.address1 || '', biz.city || '',
                  biz.state || '', biz.zipCode || '', (biz.categories || []).join(';'),
                  biz.businessCode || '', biz.status || 'active',
                  biz.linkedAt ? new Date(biz.linkedAt).toLocaleDateString() : '',
                ]);
                const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${orgData.name}-businesses.csv`; a.click();
                URL.revokeObjectURL(url);
              }}
              sx={{
                borderColor: '#4F46E5', color: '#4F46E5', textTransform: 'none', fontWeight: 500,
                fontSize: '13px', borderRadius: '8px', padding: '6px 14px',
                '&:hover': { borderColor: '#4338CA', backgroundColor: '#EEF2FF' },
              }}
            >
              Export
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileUploadOutlinedIcon sx={{ fontSize: '16px' }} />}
              component="label"
              sx={{
                borderColor: '#4F46E5', color: '#4F46E5', textTransform: 'none', fontWeight: 500,
                fontSize: '13px', borderRadius: '8px', padding: '6px 14px',
                '&:hover': { borderColor: '#4338CA', backgroundColor: '#EEF2FF' },
              }}
            >
              Import
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const lines = text.split('\n').filter(l => l.trim());
                  const header = lines[0].toLowerCase();
                  if (!header.includes('name')) { alert('CSV must have a "Name" column'); return; }
                  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
                  const nameIdx = headers.indexOf('name');
                  const desIdx = headers.indexOf('designation');
                  const addrIdx = headers.indexOf('address');
                  const cityIdx = headers.indexOf('city');
                  const stateIdx = headers.indexOf('state');
                  const zipIdx = headers.indexOf('zipcode');
                  const catIdx = headers.indexOf('categories');
                  let imported = 0;
                  for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
                    const name = cols[nameIdx];
                    if (!name) continue;
                    try {
                      const res = await linkBusiness(orgData.id, null, name, {
                        designation: cols[desIdx] || '',
                        address1: cols[addrIdx] || '',
                        city: cols[cityIdx] || '',
                        state: cols[stateIdx] || '',
                        zipCode: cols[zipIdx] || '',
                        categories: cols[catIdx] ? cols[catIdx].split(';') : [],
                      });
                      if (res?.data) { setBusinesses(prev => [...prev, res.data]); imported++; }
                    } catch (err) { console.error(`Failed to import row ${i}:`, err); }
                  }
                  setOrgData(prev => prev ? { ...prev, activeBusiness: (prev.activeBusiness || 0) + imported } : prev);
                  alert(`Imported ${imported} of ${lines.length - 1} businesses`);
                  e.target.value = '';
                }}
              />
            </Button>
          </Box>
        </Box>
        {businesses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography sx={{ color: '#9CA3AF', fontSize: '14px' }}>
              No linked businesses yet. Add a business to your organization.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={tableStyles.headerCell}>Business</TableCell>
                  <TableCell sx={tableStyles.headerCell}>Code</TableCell>
                  <TableCell sx={tableStyles.headerCell}>Status</TableCell>
                  <TableCell sx={tableStyles.headerCell}>Linked</TableCell>
                  <TableCell sx={tableStyles.headerCell}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {businesses.map((biz) => (
                  <TableRow key={biz.linkedBusinessId || biz._id}>
                    <TableCell sx={tableStyles.bodyCell}>
                      <Typography
                        sx={{ fontSize: '14px', fontWeight: 500, color: '#4F46E5', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        onClick={() => window.location.href = `/admin/my-business/${biz.linkedBusinessId || biz._id}`}
                      >
                        {biz.name || biz.businessName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {biz.businessCode ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Typography sx={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: '#374151', letterSpacing: '0.5px', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '4px' }}>
                            {biz.businessCode}
                          </Typography>
                          <Tooltip title={codeCopied === biz.businessCode ? 'Copied!' : 'Copy'}>
                            <IconButton size="small" onClick={() => handleCopyCode(biz.businessCode)} sx={{ padding: '2px', color: codeCopied === biz.businessCode ? '#059669' : '#9CA3AF' }}>
                              <ContentCopyIcon sx={{ fontSize: '14px' }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: '13px', color: '#9CA3AF' }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      <TextField
                        select
                        size="small"
                        value={biz.status || 'active'}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          const bizId = biz.linkedBusinessId || biz._id;
                          setBusinesses(prev => prev.map(b => (b.linkedBusinessId || b._id) === bizId ? { ...b, status: newStatus } : b));
                          const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken'));
                          if (userId) {
                            getBusiness(userId, bizId).then(function(res) { return updateBusiness(Object.assign({}, res.data, { status: newStatus })); }).catch(function() {});
                          }
                        }}
                        sx={{
                          minWidth: '100px',
                          '& .MuiSelect-select': { padding: '4px 8px', fontSize: '12px', fontWeight: 500 },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: (biz.status || 'active') === 'active' ? '#BBF7D0' : '#FECACA' },
                        }}
                        InputProps={{ sx: { borderRadius: '6px', backgroundColor: (biz.status || 'active') === 'active' ? '#ECFDF5' : '#FEF2F2' } }}
                      >
                        <MenuItem value="active" sx={{ fontSize: '13px' }}>Active</MenuItem>
                        <MenuItem value="inactive" sx={{ fontSize: '13px' }}>Inactive</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {biz.linkedAt ? new Date(biz.linkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      <Button
                        size="small"
                        onClick={() => handleDeleteBusiness(biz.linkedBusinessId || biz._id, biz.name || biz.businessName)}
                        sx={{ textTransform: 'none', fontSize: '13px', color: '#EF4444', fontWeight: 500, padding: '4px 10px', '&:hover': { backgroundColor: '#FEF2F2' } }}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </SettingsCard>
      </>
      )}

      {/* Tab 3: Members */}
      {orgTab === 3 && (
      <>
      {/* Members Card */}
      <SettingsCard
        title="Team Members"
        subtitle="People in your organization"
      >
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: '-52px', right: 0 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleOpenAddMember}
              sx={{
                backgroundColor: '#4F46E5',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '13px',
                borderRadius: '8px',
                padding: '6px 14px',
                '&:hover': { backgroundColor: '#4338CA' },
              }}
              disableElevation
            >
              Add Member
            </Button>
          </Box>
        </Box>
        {members.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography sx={{ color: '#9CA3AF', fontSize: '14px' }}>
              No team members found. Invite members to your organization.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={tableStyles.headerCell}>Member</TableCell>
                  <TableCell sx={tableStyles.headerCell}>Business</TableCell>
                  <TableCell sx={tableStyles.headerCell}>Role</TableCell>
                  <TableCell sx={tableStyles.headerCell}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member) => {
                  const isEditing = editingMember === member.userId;
                  const bizName = member.businessId
                    ? (member.businessId === orgData?.id
                      ? (orgData?.name || 'Primary')
                      : (businesses.find(b => (b.linkedBusinessId || b._id) === member.businessId)?.name || member.businessId.slice(0, 8) + '...'))
                    : '—';
                  return (
                  <TableRow key={member.userId}>
                    <TableCell sx={tableStyles.bodyCell}>
                      <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                        {member.email || member.username || state.user?.email || 'Owner'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {isEditing ? (
                        <TextField
                          select
                          size="small"
                          value={editMemberForm.businessId}
                          onChange={(e) => setEditMemberForm(prev => ({ ...prev, businessId: e.target.value }))}
                          sx={{ minWidth: '140px', '& .MuiSelect-select': { padding: '4px 8px', fontSize: '12px' } }}
                        >
                          <MenuItem value={orgData?.id}>{orgData?.name || 'Primary'}</MenuItem>
                          {businesses.map(b => (
                            <MenuItem key={b.linkedBusinessId || b._id} value={b.linkedBusinessId || b._id}>{b.name}</MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <Typography sx={{ fontSize: '13px', color: '#374151' }}>{bizName}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {isEditing ? (
                        <TextField
                          select
                          size="small"
                          value={editMemberForm.role}
                          onChange={(e) => setEditMemberForm(prev => ({ ...prev, role: e.target.value }))}
                          sx={{ minWidth: '100px', '& .MuiSelect-select': { padding: '4px 8px', fontSize: '12px' } }}
                        >
                          <MenuItem value="owner">Owner</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                          <MenuItem value="member">Member</MenuItem>
                        </TextField>
                      ) : (
                        <Chip
                          label={member.role || 'member'}
                          size="small"
                          sx={{
                            backgroundColor: member.role === 'owner' ? '#EEF2FF' : member.role === 'admin' ? '#FEF3C7' : '#ECFDF5',
                            color: member.role === 'owner' ? '#4F46E5' : member.role === 'admin' ? '#D97706' : '#059669',
                            fontWeight: 500, fontSize: '12px', height: '24px', textTransform: 'capitalize',
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {isEditing ? (
                        <Box sx={{ display: 'flex', gap: '6px' }}>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={editMemberSaving}
                            onClick={async () => {
                              setEditMemberSaving(true);
                              try {
                                await changeMemberRole(orgData.id, member.userId, editMemberForm.role, editMemberForm.businessId);
                                setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, role: editMemberForm.role, businessId: editMemberForm.businessId } : m));
                                setEditingMember(null);
                              } catch (err) { console.error('Failed to update member:', err); }
                              finally { setEditMemberSaving(false); }
                            }}
                            sx={{ textTransform: 'none', fontSize: '12px', padding: '3px 10px', borderRadius: '6px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}
                            disableElevation
                          >
                            {editMemberSaving ? '...' : 'Save'}
                          </Button>
                          <Button
                            size="small"
                            onClick={() => setEditingMember(null)}
                            sx={{ textTransform: 'none', fontSize: '12px', padding: '3px 10px', borderRadius: '6px', color: '#6B7280', '&:hover': { backgroundColor: '#F3F4F6' } }}
                          >
                            Cancel
                          </Button>
                        </Box>
                      ) : member.role === 'owner' ? (
                        <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>—</Typography>
                      ) : (
                        <Button
                          size="small"
                          onClick={() => { setEditingMember(member.userId); setEditMemberForm({ role: member.role || 'member', businessId: member.businessId || orgData?.id || '' }); }}
                          sx={{ textTransform: 'none', fontSize: '13px', color: '#4F46E5', fontWeight: 500, padding: '4px 10px', '&:hover': { backgroundColor: '#EEF2FF' } }}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </SettingsCard>
      </>
      )}

      {/* ===== Add Business Dialog ===== */}
      <Dialog
        open={addBusinessOpen}
        onClose={handleCloseAddBusiness}
        PaperProps={{ sx: { ...dialogStyles.paper, maxWidth: '560px' } }}
      >
        <DialogTitle sx={dialogStyles.title}>
          Add a business account
          <IconButton size="small" onClick={handleCloseAddBusiness} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={dialogStyles.content}>
          <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 2 }}>
            You can add a business account to your organization either by creating an account or by linking an existing business.
          </Typography>

          {businessError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {businessError}
            </Alert>
          )}

          {/* Mode selector */}
          <Box sx={{ display: 'flex', gap: '12px', mb: 3 }}>
            <Box
              onClick={() => setBusinessMode('create')}
              sx={{
                flex: 1, padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                border: businessMode === 'create' ? '2px solid #4F46E5' : '1.5px solid #E5E7EB',
                backgroundColor: businessMode === 'create' ? '#EEF2FF' : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Box sx={{
                  width: 16, height: 16, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0,
                  border: businessMode === 'create' ? '5px solid #4F46E5' : '2px solid #D1D5DB',
                }} />
                <Box>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Create a business account</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#6B7280' }}>
                    Create a new business added to your organization.
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box
              onClick={() => setBusinessMode('invite')}
              sx={{
                flex: 1, padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                border: businessMode === 'invite' ? '2px solid #4F46E5' : '1.5px solid #E5E7EB',
                backgroundColor: businessMode === 'invite' ? '#EEF2FF' : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Box sx={{
                  width: 16, height: 16, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0,
                  border: businessMode === 'invite' ? '5px solid #4F46E5' : '2px solid #D1D5DB',
                }} />
                <Box>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Link an existing business</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#6B7280' }}>
                    Link by business code or ID.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Create mode form */}
          {businessMode === 'create' && (
            <Box>
              <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#111827', mb: 2 }}>
                Create a new business account
              </Typography>
              <TextField
                label="Business Name"
                placeholder="e.g. Downtown Coffee Shop"
                fullWidth
                size="small"
                value={businessForm.name}
                onChange={(e) => setBusinessForm(prev => ({ ...prev, name: e.target.value }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
                required
              />
              <Autocomplete
                options={categoriesData.map(cat => cat.name)}
                value={businessForm.designation || null}
                onChange={(e, newValue) => setBusinessForm(prev => ({ ...prev, designation: newValue || '', categories: [] }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Designation / Type"
                    placeholder="Start typing to search..."
                    size="small"
                    InputProps={{ ...params.InputProps, sx: { borderRadius: '8px' } }}
                  />
                )}
                sx={{ mb: 2 }}
                size="small"
              />
              {businessForm.designation && (() => {
                const selectedCat = categoriesData.find(c => c.name === businessForm.designation);
                const subcats = selectedCat?.subcategories || [];
                if (subcats.length === 0) return null;
                return (
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                      Subcategory ({businessForm.categories.length}/3)
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {subcats.map(sub => {
                        const isSelected = businessForm.categories.includes(sub);
                        const isDisabled = !isSelected && businessForm.categories.length >= 3;
                        return (
                          <Chip
                            key={sub}
                            label={sub}
                            size="small"
                            clickable={!isDisabled}
                            onClick={() => {
                              if (isSelected) {
                                setBusinessForm(prev => ({ ...prev, categories: prev.categories.filter(c => c !== sub) }));
                              } else if (businessForm.categories.length < 3) {
                                setBusinessForm(prev => ({ ...prev, categories: [...prev.categories, sub] }));
                              }
                            }}
                            sx={{
                              backgroundColor: isSelected ? '#4F46E5' : '#F3F4F6',
                              color: isSelected ? '#fff' : isDisabled ? '#D1D5DB' : '#374151',
                              fontWeight: 500, fontSize: '12px',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                              '&:hover': { backgroundColor: isSelected ? '#4338CA' : isDisabled ? '#F3F4F6' : '#E5E7EB' },
                            }}
                          />
                        );
                      })}
                    </Box>
                  </Box>
                );
              })()}
              <TextField
                label="Street Address"
                placeholder="Start typing address..."
                fullWidth
                size="small"
                value={businessForm.address1}
                onChange={(e) => setBusinessForm(prev => ({ ...prev, address1: e.target.value }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
                inputProps={{ autoComplete: 'new-password' }}
                inputRef={businessAddressRef}
              />
              <Box sx={{ display: 'flex', gap: '12px', mb: 2 }}>
                <TextField
                  label="City"
                  fullWidth
                  size="small"
                  value={businessForm.city}
                  onChange={(e) => setBusinessForm(prev => ({ ...prev, city: e.target.value }))}
                  InputProps={{ sx: { borderRadius: '8px' } }}
                />
                <TextField
                  label="State"
                  size="small"
                  value={businessForm.state}
                  onChange={(e) => setBusinessForm(prev => ({ ...prev, state: e.target.value }))}
                  InputProps={{ sx: { borderRadius: '8px' } }}
                  sx={{ width: '120px' }}
                />
              </Box>
              <TextField
                label="Zip Code"
                size="small"
                value={businessForm.zipCode}
                onChange={(e) => setBusinessForm(prev => ({ ...prev, zipCode: e.target.value }))}
                InputProps={{ sx: { borderRadius: '8px' } }}
                sx={{ width: '140px', mb: 2 }}
              />
              <Box sx={{ p: 2, backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                <Typography sx={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>
                  ✓ Covered by your organization subscription
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#15803D', mt: '4px' }}>
                  This business will be active immediately under your current plan.
                </Typography>
              </Box>
            </Box>
          )}

          {/* Invite/Link mode form */}
          {businessMode === 'invite' && (
            <Box>
              <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#111827', mb: 1 }}>
                Link an existing business account
              </Typography>
              <Typography sx={{ fontSize: '13px', color: '#6B7280', mb: 2 }}>
                Enter the business code (e.g. BIZ-7K2M or URB-HTX-BIZ-293X) or business ID to link it to your organization.
              </Typography>
              <TextField
                label="Business Code or ID"
                placeholder="e.g. BIZ-7K2M, URB-HTX-BIZ-293X, or UUID"
                fullWidth
                size="small"
                value={inviteForm.businessId}
                onChange={(e) => setInviteForm(prev => ({ ...prev, businessId: e.target.value }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px', fontFamily: inviteForm.businessId.match(/^[A-Z0-9]+-.*BIZ-[A-Z0-9]+$/i) ? 'monospace' : 'inherit' } }}
                required
              />
              <TextField
                label="Message (optional)"
                placeholder="Include a note with your request..."
                fullWidth
                size="small"
                multiline
                minRows={2}
                value={inviteForm.message}
                onChange={(e) => setInviteForm(prev => ({ ...prev, message: e.target.value }))}
                InputProps={{ sx: { borderRadius: '8px' } }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={dialogStyles.actions}>
          <Button
            variant="outlined"
            onClick={handleCloseAddBusiness}
            disabled={businessSubmitting}
            sx={dialogStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitBusiness}
            disabled={businessSubmitting || (businessMode === 'create' ? !businessForm.name : !inviteForm.businessId)}
            sx={dialogStyles.submitButton}
            disableElevation
          >
            {businessSubmitting ? 'Adding...' : businessMode === 'create' ? 'Create Account' : 'Send Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Add Member Dialog ===== */}
      <Dialog
        open={addMemberOpen}
        onClose={handleCloseAddMember}
        PaperProps={{ sx: { ...dialogStyles.paper, maxWidth: '560px' } }}
      >
        <DialogTitle sx={dialogStyles.title}>
          Add Team Member
          <IconButton size="small" onClick={handleCloseAddMember} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={dialogStyles.content}>
          <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 2 }}>
            Add a team member to your organization.
          </Typography>

          {memberError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {memberError}
            </Alert>
          )}

          {/* Mode selector */}
          <Box sx={{ display: 'flex', gap: '8px', mb: 2 }}>
            {[
              { id: 'existing', label: 'Add Existing User' },
              { id: 'invite', label: 'Invite by Email' },
              { id: 'create', label: 'Create New User' },
            ].map(mode => (
              <Button
                key={mode.id}
                size="small"
                onClick={() => { setMemberMode(mode.id); setMemberError(''); }}
                sx={{
                  flex: 1,
                  textTransform: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  backgroundColor: memberMode === mode.id ? '#4F46E5' : '#F3F4F6',
                  color: memberMode === mode.id ? '#fff' : '#374151',
                  '&:hover': { backgroundColor: memberMode === mode.id ? '#4338CA' : '#E5E7EB' },
                }}
                disableElevation
              >
                {mode.label}
              </Button>
            ))}
          </Box>

          {/* Existing user mode */}
          {memberMode === 'existing' && (
            <>
              <TextField
                label="User Email or ID"
                placeholder="e.g. jane@example.com"
                fullWidth
                size="small"
                value={memberForm.userId}
                onChange={(e) => setMemberForm(prev => ({ ...prev, userId: e.target.value }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
                required
                helperText="The user must already have a KeepTabs account"
              />
            </>
          )}

          {/* Invite mode */}
          {memberMode === 'invite' && (
            <>
              <TextField
                label="Email Address"
                placeholder="e.g. newmember@company.com"
                fullWidth
                size="small"
                value={memberForm.userId}
                onChange={(e) => setMemberForm(prev => ({ ...prev, userId: e.target.value }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
                required
                helperText="An invitation email will be sent to join your organization"
              />
            </>
          )}

          {/* Create new user mode */}
          {memberMode === 'create' && (
            <>
              <Box sx={{ display: 'flex', gap: '12px', mb: 2 }}>
                <TextField
                  label="First Name"
                  fullWidth
                  size="small"
                  value={createMemberForm.firstName}
                  onChange={(e) => setCreateMemberForm(prev => ({ ...prev, firstName: e.target.value }))}
                  InputProps={{ sx: { borderRadius: '8px' } }}
                  required
                />
                <TextField
                  label="Last Name"
                  fullWidth
                  size="small"
                  value={createMemberForm.lastName}
                  onChange={(e) => setCreateMemberForm(prev => ({ ...prev, lastName: e.target.value }))}
                  InputProps={{ sx: { borderRadius: '8px' } }}
                  required
                />
              </Box>
              <TextField
                label="Username"
                placeholder="e.g. mike_arnwine"
                fullWidth
                size="small"
                value={createMemberForm.username || ''}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                  setCreateMemberForm(prev => ({ ...prev, username: val }));
                }}
                sx={{ mb: 2 }}
                InputProps={{
                  sx: { borderRadius: '8px' },
                  endAdornment: createMemberForm.username && !/^[a-z0-9][a-z0-9._-]{2,}$/.test(createMemberForm.username) ? (
                    <Tooltip title="Username must be unique. Letters, numbers, dots, dashes, underscores only. Min 3 characters, must start with a letter or number.">
                      <Box sx={{ color: '#D32F2F', fontSize: '18px', cursor: 'pointer', fontWeight: 700 }}>⚠</Box>
                    </Tooltip>
                  ) : null,
                }}
                error={!!createMemberForm.username && !/^[a-z0-9][a-z0-9._-]{2,}$/.test(createMemberForm.username)}
              />
              <TextField
                label="Email"
                placeholder="e.g. newuser@company.com"
                fullWidth
                size="small"
                value={createMemberForm.email}
                onChange={(e) => setCreateMemberForm(prev => ({ ...prev, email: e.target.value }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
                required
              />
              <TextField
                label="Phone Number"
                placeholder="(281) 555-1234"
                fullWidth
                size="small"
                value={formatPhone(createMemberForm.phone)}
                onChange={(e) => setCreateMemberForm(prev => ({ ...prev, phone: unformatPhone(e.target.value) }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
              />
            </>
          )}

          {/* Common fields: Business + Role */}
          <TextField
            label="Link to Business"
            select
            fullWidth
            size="small"
            value={memberForm.businessId}
            onChange={(e) => setMemberForm(prev => ({ ...prev, businessId: e.target.value }))}
            InputProps={{ sx: { borderRadius: '8px' } }}
            sx={{ mb: 2 }}
            required
          >
            {businesses.length === 0 ? (
              <MenuItem value="" disabled>No businesses — add one first</MenuItem>
            ) : (
              businesses.map((biz) => (
                <MenuItem key={biz.linkedBusinessId || biz._id} value={biz.linkedBusinessId || biz._id}>
                  {biz.name || biz.businessName}
                </MenuItem>
              ))
            )}
          </TextField>
          <TextField
            label="Role"
            select
            fullWidth
            size="small"
            value={memberForm.role}
            onChange={(e) => setMemberForm(prev => ({ ...prev, role: e.target.value }))}
            InputProps={{ sx: { borderRadius: '8px' } }}
          >
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={dialogStyles.actions}>
          <Button
            variant="outlined"
            onClick={handleCloseAddMember}
            disabled={memberSubmitting}
            sx={dialogStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitMember}
            disabled={memberSubmitting || !memberForm.businessId || (memberMode === 'existing' && !memberForm.userId) || (memberMode === 'invite' && !memberForm.userId) || (memberMode === 'create' && (!createMemberForm.email || !createMemberForm.firstName))}
            sx={dialogStyles.submitButton}
            disableElevation
          >
            {memberSubmitting ? 'Adding...' : memberMode === 'invite' ? 'Send Invite' : memberMode === 'create' ? 'Create & Add' : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Remove Business Confirmation Dialog ===== */}
      <Dialog
        open={deleteBusinessConfirm.open}
        onClose={() => setDeleteBusinessConfirm({ open: false, id: null, name: '' })}
        PaperProps={{ sx: dialogStyles.paper }}
      >
        <DialogTitle sx={dialogStyles.title}>
          Remove Business
          <IconButton size="small" onClick={() => setDeleteBusinessConfirm({ open: false, id: null, name: '' })} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={dialogStyles.content}>
          <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 2 }}>
            Are you sure you want to remove <strong>{deleteBusinessConfirm.name}</strong> from your organization?
          </Typography>
          <Alert severity="warning" sx={{ borderRadius: '8px', mb: 2 }}>
            This will unlink the business from your organization.
          </Alert>
          <Box
            onClick={() => setDeleteBusinessAlso(!deleteBusinessAlso)}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              padding: '12px',
              borderRadius: '8px',
              border: deleteBusinessAlso ? '1px solid #EF4444' : '1px solid #E5E7EB',
              backgroundColor: deleteBusinessAlso ? '#FEF2F2' : '#fff',
            }}
          >
            <input
              type="checkbox"
              checked={deleteBusinessAlso}
              onChange={(e) => setDeleteBusinessAlso(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: '#EF4444' }}
            />
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                Also delete the business permanently
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#6B7280', mt: '2px' }}>
                This will remove the business from KeepTabs entirely. It will no longer appear in the mobile app.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={dialogStyles.actions}>
          <Button
            variant="outlined"
            onClick={() => setDeleteBusinessConfirm({ open: false, id: null, name: '' })}
            disabled={deleteBusinessLoading}
            sx={dialogStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmDeleteBusiness}
            disabled={deleteBusinessLoading}
            sx={{
              backgroundColor: '#EF4444',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              padding: '9px 20px',
              '&:hover': { backgroundColor: '#DC2626' },
              '&:disabled': { backgroundColor: '#FECACA', color: '#fff' },
            }}
            disableElevation
          >
            {deleteBusinessLoading ? 'Removing...' : 'Remove Business'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrganizationSection;
