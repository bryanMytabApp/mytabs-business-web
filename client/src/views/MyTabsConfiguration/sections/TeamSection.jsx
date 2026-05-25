import React, { useState, useEffect, useMemo } from 'react';
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
  Select,
  MenuItem,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SettingsCard from '../components/SettingsCard';
import { useSettings } from '../context/SettingsContext';
import { getBusiness } from '../../../services/businessService';
import {
  getMyOrganizations,
  getOrganizationMembers,
  getOrganizationBusinesses,
  addMember,
  changeMemberRole,
  removeMember,
} from '../../../services/organizationService';
import { parseJwt } from '../../../utils/common';
import { formatPhone, unformatPhone } from '../../../utils/phoneMask';

const tableStyles = {
  headerCell: {
    fontWeight: 600,
    fontSize: '12px',
    color: '#6B7280',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB',
    padding: '10px 12px',
    backgroundColor: '#F9FAFB',
  },
  bodyCell: {
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
    padding: '10px 12px',
  },
};

const roleChipStyles = {
  owner: { backgroundColor: '#EEF2FF', color: '#4F46E5' },
  admin: { backgroundColor: '#FEF3C7', color: '#D97706' },
  member: { backgroundColor: '#ECFDF5', color: '#059669' },
  verifier: { backgroundColor: '#FDE8E8', color: '#E53E3E' },
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

const TeamSection = () => {
  const { state } = useSettings();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [userRole, setUserRole] = useState('member');
  const [userBusinessId, setUserBusinessId] = useState(null);
  const [userBusinessName, setUserBusinessName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ role: '', businessId: '' });
  const [saving, setSaving] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState('existing'); // 'existing' | 'create'
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member', businessId: '' });
  const [createForm, setCreateForm] = useState({ firstName: '', lastName: '', email: '', phone: '', username: '' });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        setLoading(true);
        const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken'));

        // Get org
        const myOrgsRes = await getMyOrganizations();
        const orgs = myOrgsRes?.data?.organizations || myOrgsRes?.data || [];
        if (orgs.length === 0) { setLoading(false); return; }

        const org = orgs[0];
        const id = org.organizationId || org.id;
        setOrgId(id);
        setOrgName(org.name || '');
        setUserRole(org.role || 'member');

        // Get members and businesses
        const [memRes, bizRes] = await Promise.all([
          getOrganizationMembers(id).catch(() => null),
          getOrganizationBusinesses(id).catch(() => null),
        ]);

        const memList = memRes?.data?.members || memRes?.data || [];
        setMembers(memList);

        const bizList = bizRes?.data?.businesses || bizRes?.data || [];
        setBusinesses(bizList);

        // Find current user's business assignment from their MEMBER record
        const currentMember = memList.find(m => m.userId === userId || m.email === state.user?.email);
        if (currentMember?.businessId) {
          setUserBusinessId(currentMember.businessId);
          const biz = bizList.find(b => (b.linkedBusinessId || b._id) === currentMember.businessId);
          setUserBusinessName(biz?.name || '');
        } else {
          // If user is owner, their business is the org itself
          if (org.role === 'owner') {
            setUserBusinessId(id);
            setUserBusinessName(org.name || '');
          }
        }
      } catch (err) {
        console.error('Failed to load team:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, [state.user?.userId]);

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  // Filter members: owners see all, admins/members see only their business
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Business filter: non-owners only see members in their business
      if (userRole !== 'owner' && userBusinessId) {
        if (m.businessId && m.businessId !== userBusinessId) return false;
      }
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      const matchesSearch = !searchQuery ||
        (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.firstName && m.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.lastName && m.lastName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesRole && matchesSearch;
    });
  }, [members, roleFilter, searchQuery, userRole, userBusinessId]);

  const getBusinessName = (businessId) => {
    if (!businessId) return '—';
    if (businessId === orgId) return orgName || 'Primary';
    const biz = businesses.find(b => (b.linkedBusinessId || b._id) === businessId);
    return biz?.name || businessId.slice(0, 8) + '...';
  };

  const handleSaveEdit = async (member) => {
    setSaving(true);
    try {
      await changeMemberRole(orgId, member.userId, editForm.role, editForm.businessId);
      setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, role: editForm.role, businessId: editForm.businessId } : m));
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update member:', err);
    } finally {
      setSaving(false);
    }
  };

  // Remove member confirmation dialog
  const [removeConfirm, setRemoveConfirm] = useState({ open: false, member: null });
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    const member = removeConfirm.member;
    if (!member) return;
    setRemoving(true);
    try {
      await removeMember(orgId, member.userId);
      setMembers(prev => prev.filter(m => m.userId !== member.userId));
      setRemoveConfirm({ open: false, member: null });
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setRemoving(false);
    }
  };

  const handleInvite = async () => {
    const bizId = inviteForm.businessId || userBusinessId || orgId;
    if (inviteMode === 'create') {
      if (!createForm.email) { setInviteError('Email is required'); return; }
      if (!createForm.firstName) { setInviteError('First name is required'); return; }
    } else {
      if (!inviteForm.email) { setInviteError('Email is required'); return; }
    }
    setInviteSubmitting(true);
    setInviteError('');
    try {
      let res;
      if (inviteMode === 'create') {
        res = await addMember(orgId, null, inviteForm.role, bizId, {
          mode: 'create',
          firstName: createForm.firstName,
          lastName: createForm.lastName,
          email: createForm.email,
          phone: createForm.phone,
          username: createForm.username || '',
        });
      } else {
        res = await addMember(orgId, inviteForm.email, inviteForm.role, bizId);
      }
      if (res?.data) {
        setMembers(prev => [...prev, res.data]);
      }
      setInviteOpen(false);
      setInviteForm({ email: '', role: 'member', businessId: '' });
      setCreateForm({ firstName: '', lastName: '', email: '', phone: '', username: '' });
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to add member';
      if (err?.response?.status === 409) {
        setInviteError('A user with this email already exists. Use "Add Existing User" instead.');
      } else if (err?.response?.status === 404) {
        setInviteError('User not found. This email is not registered on KeepTabs.');
      } else {
        setInviteError(msg);
      }
    } finally {
      setInviteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box data-testid="section-team" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!orgId) {
    return (
      <Box data-testid="section-team">
        <SettingsCard title="Team">
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#111827', mb: 1 }}>
              No organization found
            </Typography>
            <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 3 }}>
              You need an organization to manage team members. Create one to get started.
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.href = '/admin/service/organization'}
              sx={{ backgroundColor: '#4F46E5', textTransform: 'none', fontWeight: 600, fontSize: '14px', borderRadius: '8px', padding: '10px 24px', '&:hover': { backgroundColor: '#4338CA' } }}
              disableElevation
            >
              Create Organization
            </Button>
          </Box>
        </SettingsCard>
      </Box>
    );
  }

  return (
    <Box data-testid="section-team">
      {/* Team Members Card */}
      <SettingsCard
        title={userRole === 'owner' ? 'Team Members' : `${userBusinessName || 'Business'} Team`}
        subtitle={userRole === 'owner' ? `${members.length} member${members.length !== 1 ? 's' : ''} across your organization` : `${filteredMembers.length} member${filteredMembers.length !== 1 ? 's' : ''} in your business`}
      >
        {/* Toolbar */}
        <Box sx={{ display: 'flex', gap: '12px', mb: 2, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, maxWidth: '260px' }}
          />
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 120, fontSize: '14px', borderRadius: '8px', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' } }}
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="owner">Owner</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="verifier">Verifier</MenuItem>
          </Select>
          <Box sx={{ flex: 1 }} />
          {isOwnerOrAdmin && (
          <Button
            variant="contained"
            size="small"
            onClick={() => { setInviteError(''); setInviteForm(prev => ({ ...prev, businessId: userBusinessId || orgId })); setInviteOpen(true); }}
            sx={{ backgroundColor: '#4F46E5', textTransform: 'none', fontWeight: 500, fontSize: '13px', borderRadius: '8px', padding: '7px 16px', '&:hover': { backgroundColor: '#4338CA' } }}
            disableElevation
          >
            + Add Member
          </Button>
          )}
        </Box>

        {/* Table */}
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
              {filteredMembers.map((member) => {
                const isEditing = editingId === member.userId;
                return (
                  <TableRow key={member.userId}>
                    <TableCell sx={tableStyles.bodyCell}>
                      <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                        {member.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : (member.email || member.userId)}
                      </Typography>
                      {member.firstName && member.email && (
                        <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>{member.email}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {isEditing ? (
                        <TextField
                          select size="small"
                          value={editForm.businessId}
                          onChange={(e) => setEditForm(prev => ({ ...prev, businessId: e.target.value }))}
                          sx={{ minWidth: '140px', '& .MuiSelect-select': { padding: '4px 8px', fontSize: '12px' } }}
                        >
                          <MenuItem value={orgId}>{orgName || 'Primary'}</MenuItem>
                          {businesses.map(b => (
                            <MenuItem key={b.linkedBusinessId || b._id} value={b.linkedBusinessId || b._id}>{b.name}</MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <Typography sx={{ fontSize: '13px', color: '#374151' }}>{getBusinessName(member.businessId)}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {isEditing ? (
                        <TextField
                          select size="small"
                          value={editForm.role}
                          onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                          sx={{ minWidth: '100px', '& .MuiSelect-select': { padding: '4px 8px', fontSize: '12px' } }}
                        >
                          <MenuItem value="owner">Owner</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                          <MenuItem value="member">Member</MenuItem>
                          <MenuItem value="verifier">Verifier</MenuItem>
                        </TextField>
                      ) : (
                        <Chip
                          label={member.role || 'member'}
                          size="small"
                          sx={{ ...(roleChipStyles[member.role] || roleChipStyles.member), fontWeight: 500, fontSize: '12px', height: '24px', textTransform: 'capitalize' }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={tableStyles.bodyCell}>
                      {isEditing ? (
                        <Box sx={{ display: 'flex', gap: '6px' }}>
                          <Button
                            size="small" variant="contained" disabled={saving}
                            onClick={() => handleSaveEdit(member)}
                            sx={{ textTransform: 'none', fontSize: '12px', padding: '3px 10px', borderRadius: '6px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}
                            disableElevation
                          >
                            {saving ? '...' : 'Save'}
                          </Button>
                          <Button
                            size="small" onClick={() => setEditingId(null)}
                            sx={{ textTransform: 'none', fontSize: '12px', padding: '3px 10px', borderRadius: '6px', color: '#6B7280', '&:hover': { backgroundColor: '#F3F4F6' } }}
                          >
                            Cancel
                          </Button>
                        </Box>
                      ) : isOwnerOrAdmin && member.role !== 'owner' ? (
                        <Box sx={{ display: 'flex', gap: '6px' }}>
                          <Button
                            size="small"
                            onClick={() => { setEditingId(member.userId); setEditForm({ role: member.role || 'member', businessId: member.businessId || orgId }); }}
                            sx={{ textTransform: 'none', fontSize: '13px', color: '#4F46E5', fontWeight: 500, padding: '4px 10px', '&:hover': { backgroundColor: '#EEF2FF' } }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            onClick={() => setRemoveConfirm({ open: true, member })}
                            sx={{ textTransform: 'none', fontSize: '13px', color: '#EF4444', fontWeight: 500, padding: '4px 10px', '&:hover': { backgroundColor: '#FEF2F2' } }}
                          >
                            Remove
                          </Button>
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ ...tableStyles.bodyCell, textAlign: 'center', py: 3 }}>
                    <Typography sx={{ fontSize: '14px', color: '#6B7280' }}>
                      {searchQuery || roleFilter !== 'all' ? 'No members match your filters' : 'No team members yet'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </SettingsCard>

      {/* Add Member Dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} PaperProps={{ sx: { borderRadius: '12px', padding: '8px', maxWidth: '480px', width: '100%' } }}>
        <DialogTitle sx={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 8px' }}>
          Add Team Member
          <IconButton size="small" onClick={() => setInviteOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ padding: '16px 24px' }}>
          <Typography sx={{ fontSize: '13px', color: '#6B7280', mb: 2 }}>
            Add a team member to your business.
          </Typography>
          {inviteError && (
            <Box sx={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', mb: 2 }}>
              <Typography sx={{ fontSize: '13px', color: '#DC2626' }}>{inviteError}</Typography>
            </Box>
          )}

          {/* Mode tabs */}
          <Box sx={{ display: 'flex', gap: '8px', mb: 2 }}>
            {['existing', 'create'].map((mode) => (
              <Button
                key={mode}
                size="small"
                variant={inviteMode === mode ? 'contained' : 'outlined'}
                onClick={() => { setInviteMode(mode); setInviteError(''); }}
                sx={{
                  textTransform: 'none', fontSize: '13px', borderRadius: '8px', padding: '6px 16px',
                  ...(inviteMode === mode
                    ? { backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }
                    : { color: '#6B7280', borderColor: '#E5E7EB', '&:hover': { backgroundColor: '#F9FAFB' } }),
                }}
                disableElevation
              >
                {mode === 'existing' ? 'Add Existing User' : 'Create New User'}
              </Button>
            ))}
          </Box>

          {/* Existing user mode */}
          {inviteMode === 'existing' && (
            <TextField
              label="Email" fullWidth size="small" placeholder="user@example.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              sx={{ mb: 2 }}
              InputProps={{ sx: { borderRadius: '8px' } }}
              required
            />
          )}

          {/* Create new user mode */}
          {inviteMode === 'create' && (
            <>
              <Box sx={{ display: 'flex', gap: '12px', mb: 2 }}>
                <TextField
                  label="First Name" fullWidth size="small" required
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, firstName: e.target.value }))}
                  InputProps={{ sx: { borderRadius: '8px' } }}
                />
                <TextField
                  label="Last Name" fullWidth size="small"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, lastName: e.target.value }))}
                  InputProps={{ sx: { borderRadius: '8px' } }}
                />
              </Box>
              <TextField
                label="Username" fullWidth size="small" placeholder="e.g. mike_arnwine"
                value={createForm.username}
                onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
              />
              <TextField
                label="Email" fullWidth size="small" placeholder="user@example.com" required
                value={createForm.email}
                onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
              />
              <TextField
                label="Phone Number" fullWidth size="small" placeholder="(281) 555-1234"
                value={formatPhone(createForm.phone)}
                onChange={(e) => setCreateForm(prev => ({ ...prev, phone: unformatPhone(e.target.value) }))}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: '8px' } }}
              />
            </>
          )}

          {/* Common fields */}
          <TextField
            label="Business" select fullWidth size="small"
            value={inviteForm.businessId || userBusinessId || orgId}
            onChange={(e) => setInviteForm(prev => ({ ...prev, businessId: e.target.value }))}
            sx={{ mb: 2 }}
            InputProps={{ sx: { borderRadius: '8px' } }}
            disabled={userRole !== 'owner'}
          >
            {userRole === 'owner' && <MenuItem value={orgId}>{orgName || 'Primary'}</MenuItem>}
            {businesses.map(b => (
              <MenuItem key={b.linkedBusinessId || b._id} value={b.linkedBusinessId || b._id}>{b.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Role" select fullWidth size="small"
            value={inviteForm.role}
            onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
            InputProps={{ sx: { borderRadius: '8px' } }}
          >
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="verifier">Verifier</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ padding: '12px 24px 20px', gap: '12px' }}>
          <Button variant="outlined" onClick={() => setInviteOpen(false)} sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280', borderColor: '#E5E7EB' }}>
            Cancel
          </Button>
          <Button
            variant="contained" onClick={handleInvite}
            disabled={inviteSubmitting || (inviteMode === 'existing' && !inviteForm.email) || (inviteMode === 'create' && (!createForm.email || !createForm.firstName))}
            sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}
            disableElevation
          >
            {inviteSubmitting ? 'Adding...' : inviteMode === 'create' ? 'Create & Add' : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={removeConfirm.open} onClose={() => setRemoveConfirm({ open: false, member: null })} PaperProps={{ sx: { borderRadius: '12px', padding: '8px', maxWidth: '400px', width: '100%' } }}>
        <DialogTitle sx={{ fontSize: '18px', fontWeight: 600, color: '#D32F2F', padding: '16px 24px 8px' }}>
          Remove Member
        </DialogTitle>
        <DialogContent sx={{ padding: '16px 24px' }}>
          <Typography sx={{ fontSize: '14px', color: '#555', mb: 1 }}>
            Are you sure you want to remove <strong>{removeConfirm.member?.email || removeConfirm.member?.firstName || 'this member'}</strong> from the business?
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
            They will be unlinked from the business but their account will remain active. They can be re-added later.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ padding: '12px 24px 20px', gap: '12px' }}>
          <Button variant="outlined" onClick={() => setRemoveConfirm({ open: false, member: null })} disabled={removing} sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280', borderColor: '#E5E7EB' }}>
            Cancel
          </Button>
          <Button
            variant="contained" onClick={handleRemove} disabled={removing}
            sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#D32F2F', '&:hover': { backgroundColor: '#B71C1C' } }}
            disableElevation
          >
            {removing ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamSection;
