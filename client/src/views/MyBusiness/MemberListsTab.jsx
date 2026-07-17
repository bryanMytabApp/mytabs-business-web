import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  getSavedLists,
  createSavedList,
  getSavedList,
  updateSavedList,
  deleteSavedList,
  addSavedListMembers,
  removeSavedListMember,
  getImportPresignedUrl,
  importSavedListMembers,
} from '../../services/savedListService';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Collapse,
  Paper,
  Divider,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import axios from 'axios';
import ImportMembersModal from '../Events/ImportMembersModal';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['xlsx', 'csv', 'txt'];
const LIST_NAME_REGEX = /^[A-Za-z0-9 \-_]+$/;
const MEMBER_CAP = 5000;

// Derive a name from email prefix
const autoNameFromEmail = (email) => {
  if (!email || !email.includes('@')) return '';
  const prefix = email.split('@')[0] || '';
  return prefix.replace(/[._+\-]/g, ' ').trim();
};

// Validation helpers
const validateListName = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'List name is required';
  if (trimmed.length > 100) return 'List name must be 100 characters or fewer';
  if (!LIST_NAME_REGEX.test(trimmed)) return 'Only letters, numbers, spaces, hyphens, and underscores allowed';
  return null;
};

const validateEmail = (email) => {
  if (!email) return 'Email is required';
  const parts = email.split('@');
  if (parts.length !== 2) return 'Email must contain exactly one @';
  const domain = parts[1];
  if (!domain.includes('.')) return 'Domain must contain at least one dot';
  if (domain.startsWith('.') || domain.endsWith('.')) return 'Domain cannot start or end with a dot';
  return null;
};

const validateMemberName = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Name is required';
  if (trimmed.length > 100) return 'Name must be 100 characters or fewer';
  return null;
};

const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const MemberListsTab = ({ selectedBusinessId, userRole }) => {
  // State for lists
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(null); // { listId, listName, memberCount }
  const [deleting, setDeleting] = useState(false);

  // Rename state
  const [renamingListId, setRenamingListId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState(null);
  const [renaming, setRenaming] = useState(false);

  // Expanded list state
  const [expandedListId, setExpandedListId] = useState(null);
  const [expandedMembers, setExpandedMembers] = useState([]);
  const [expandLoading, setExpandLoading] = useState(false);

  // Add member form
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addNameError, setAddNameError] = useState(null);
  const [addEmailError, setAddEmailError] = useState(null);
  const [addingMember, setAddingMember] = useState(false);

  // Remove member dialog
  const [removeMemberDialog, setRemoveMemberDialog] = useState(null); // { email, memberName }
  const [removingMember, setRemovingMember] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch all lists
  const fetchLists = async (autoExpandFirst = false) => {
    if (!selectedBusinessId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSavedLists(selectedBusinessId);
      const data = res.data?.lists || res.data || [];
      // Sort by updatedAt descending
      data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setLists(data);
      // Auto-expand first list on initial load
      if (autoExpandFirst && data.length > 0 && !expandedListId) {
        handleToggleExpand(data[0].listId);
      }
    } catch (err) {
      console.error('Error fetching saved lists:', err);
      setError('Failed to load member lists. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessId]);

  // Create new list
  const handleCreate = async () => {
    const nameErr = validateListName(newListName);
    if (nameErr) { setCreateError(nameErr); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await createSavedList(selectedBusinessId, { name: newListName.trim() });
      const newListId = res.data?.listId;
      toast.success(`List "${newListName.trim()}" created`);
      setCreateDialogOpen(false);
      setNewListName('');
      await fetchLists();
      // Auto-expand the newly created list
      if (newListId) {
        handleToggleExpand(newListId);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create list';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  // Delete list
  const handleDelete = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      await deleteSavedList(selectedBusinessId, deleteDialog.listId);
      toast.success(`List "${deleteDialog.listName}" deleted`);
      setDeleteDialog(null);
      if (expandedListId === deleteDialog.listId) {
        setExpandedListId(null);
        setExpandedMembers([]);
      }
      fetchLists();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete list';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Rename list
  const handleStartRename = (list) => {
    setRenamingListId(list.listId);
    setRenameValue(list.listName);
    setRenameError(null);
  };

  const handleCancelRename = () => {
    setRenamingListId(null);
    setRenameValue('');
    setRenameError(null);
  };

  const handleRename = async (listId) => {
    const nameErr = validateListName(renameValue);
    if (nameErr) { setRenameError(nameErr); return; }
    setRenaming(true);
    setRenameError(null);
    try {
      await updateSavedList(selectedBusinessId, listId, { name: renameValue.trim() });
      toast.success('List renamed successfully');
      setRenamingListId(null);
      setRenameValue('');
      fetchLists();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to rename list';
      setRenameError(msg);
    } finally {
      setRenaming(false);
    }
  };

  // Expand/collapse list to show members
  const handleToggleExpand = async (listId) => {
    if (expandedListId === listId) {
      setExpandedListId(null);
      setExpandedMembers([]);
      return;
    }
    setExpandedListId(listId);
    setExpandLoading(true);
    try {
      const res = await getSavedList(selectedBusinessId, listId);
      const members = res.data?.members || [];
      // Sort alphabetically by name
      members.sort((a, b) => (a.memberName || '').localeCompare(b.memberName || ''));
      setExpandedMembers(members);
    } catch (err) {
      console.error('Error fetching list details:', err);
      toast.error('Failed to load list members');
      setExpandedListId(null);
    } finally {
      setExpandLoading(false);
    }
  };

  // Refresh the currently expanded list's members without toggling
  const refreshExpandedMembers = async (listId) => {
    if (!listId) return;
    try {
      const res = await getSavedList(selectedBusinessId, listId);
      const members = res.data?.members || [];
      members.sort((a, b) => (a.memberName || '').localeCompare(b.memberName || ''));
      setExpandedMembers(members);
    } catch (err) {
      console.error('Error refreshing list members:', err);
    }
  };

  // Add member
  const handleAddMember = async () => {
    const nameErr = validateMemberName(addName);
    const emailErr = validateEmail(addEmail.trim());
    setAddNameError(nameErr);
    setAddEmailError(emailErr);
    if (nameErr || emailErr) return;

    setAddingMember(true);
    try {
      await addSavedListMembers(selectedBusinessId, expandedListId, [
        { name: addName.trim(), email: addEmail.trim() },
      ]);
      toast.success('Member added');
      setAddName('');
      setAddEmail('');
      setAddNameError(null);
      setAddEmailError(null);
      // Refresh expanded members and list counts
      refreshExpandedMembers(expandedListId);
      fetchLists();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add member';
      toast.error(msg);
    } finally {
      setAddingMember(false);
    }
  };

  // Remove member
  const handleRemoveMember = async () => {
    if (!removeMemberDialog) return;
    setRemovingMember(true);
    try {
      await removeSavedListMember(selectedBusinessId, expandedListId, removeMemberDialog.email);
      toast.success('Member removed');
      setRemoveMemberDialog(null);
      // Refresh expanded members and list counts
      refreshExpandedMembers(expandedListId);
      fetchLists();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to remove member';
      toast.error(msg);
    } finally {
      setRemovingMember(false);
    }
  };

  // File import via modal
  const handleImportClick = () => {
    setShowImportModal(true);
  };

  const handleImportUpload = async (records) => {
    // Build CSV and upload via presigned URL, then call import endpoint
    const csvLines = ['name,email'];
    for (const rec of records) {
      const name = (rec.name || '').replace(/,/g, ' ');
      const email = (rec.email || '');
      csvLines.push(`${name},${email}`);
    }
    const csvContent = csvLines.join('\n');
    const csvBlob = new Blob([csvContent], { type: 'text/csv' });
    const csvFileName = 'import.csv';

    const presignRes = await getImportPresignedUrl(
      selectedBusinessId, expandedListId, csvFileName, 'text/csv'
    );
    const { presignedUrl, fileKey } = presignRes.data;

    await axios.put(presignedUrl, csvBlob, {
      headers: { 'Content-Type': 'text/csv' },
    });

    const importRes = await importSavedListMembers(selectedBusinessId, expandedListId, fileKey);
    const data = importRes.data;

    return {
      imported: data.added || 0,
      skipped: data.skipped || 0,
      duplicates: data.duplicates || 0,
      errors: data.errors || [],
    };
  };

  // --- RENDER ---

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress size={36} />
        <Typography sx={{ ml: 2, color: '#6B7280', fontSize: '14px' }}>Loading member lists...</Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2, justifyContent: 'center' }}>{error}</Alert>
        <Button variant="outlined" onClick={fetchLists} sx={{ textTransform: 'none' }}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {/* Header with Create button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#1F2937' }}>
          Saved Member Lists
        </Typography>
        {(userRole === 'owner' || userRole === 'admin') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setCreateDialogOpen(true); setNewListName(''); setCreateError(null); }}
            disableElevation
            sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#4F46E5', fontWeight: 600, '&:hover': { backgroundColor: '#4338CA' } }}
          >
            Create New List
          </Button>
        )}
      </Box>

      {/* Empty state */}
      {lists.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '12px', border: '1px solid #E5E7EB' }} elevation={0}>
          <Typography sx={{ fontSize: '15px', color: '#6B7280', mb: 1 }}>
            No saved member lists yet.
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#9CA3AF' }}>
            Create a list here or save one from a private event&apos;s members page.
          </Typography>
        </Paper>
      )}

      {/* List of saved lists */}
      {lists.length > 0 && (
        <List disablePadding>
          {lists.map((list) => (
            <Paper
              key={list.listId}
              sx={{ mb: 2, borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}
              elevation={0}
            >
              {/* List row */}
              <ListItem
                sx={{ py: 1.5, px: 2, cursor: 'pointer', '&:hover': { backgroundColor: '#F9FAFB' } }}
                onClick={() => handleToggleExpand(list.listId)}
                secondaryAction={
                  (userRole === 'owner' || userRole === 'admin') && renamingListId !== list.listId ? (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleStartRename(list); }} title="Rename">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteDialog({ listId: list.listId, listName: list.listName, memberCount: list.memberCount || 0 }); }} title="Delete">
                        <DeleteIcon fontSize="small" sx={{ color: '#EF4444' }} />
                      </IconButton>
                      {expandedListId === list.listId ? <ExpandLessIcon sx={{ color: '#6B7280', mt: 0.5 }} /> : <ExpandMoreIcon sx={{ color: '#6B7280', mt: 0.5 }} />}
                    </Box>
                  ) : (
                    <Box>{expandedListId === list.listId ? <ExpandLessIcon sx={{ color: '#6B7280' }} /> : <ExpandMoreIcon sx={{ color: '#6B7280' }} />}</Box>
                  )
                }
              >
                {renamingListId === list.listId ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, mr: 12 }} onClick={(e) => e.stopPropagation()}>
                    <TextField
                      size="small"
                      value={renameValue}
                      onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                      error={!!renameError}
                      helperText={renameError}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(list.listId); if (e.key === 'Escape') handleCancelRename(); }}
                      autoFocus
                      sx={{ flex: 1 }}
                    />
                    <Button size="small" onClick={() => handleRename(list.listId)} disabled={renaming} sx={{ textTransform: 'none', minWidth: 'auto' }}>
                      {renaming ? <CircularProgress size={16} /> : 'Save'}
                    </Button>
                    <Button size="small" onClick={handleCancelRename} sx={{ textTransform: 'none', minWidth: 'auto', color: '#6B7280' }}>
                      Cancel
                    </Button>
                  </Box>
                ) : (
                  <ListItemText
                    primary={list.listName}
                    secondary={`${list.memberCount || 0} member${(list.memberCount || 0) !== 1 ? 's' : ''} • Updated ${formatDate(list.updatedAt)}`}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}
                    secondaryTypographyProps={{ fontSize: '12px', color: '#6B7280' }}
                  />
                )}
              </ListItem>

              {/* Expanded member list */}
              <Collapse in={expandedListId === list.listId}>
                <Divider />
                <Box sx={{ p: 2, backgroundColor: '#FAFAFA' }}>
                  {expandLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <>
                      {/* Add member form */}
                      {(userRole === 'owner' || userRole === 'admin') && (
                        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <TextField
                            size="small"
                            placeholder="Email"
                            value={addEmail}
                            onChange={(e) => {
                              const email = e.target.value;
                              setAddEmail(email);
                              setAddEmailError(null);
                              // Auto-fill name from email prefix if name is empty or was auto-generated
                              if (!addName || addName === autoNameFromEmail(addEmail)) {
                                setAddName(autoNameFromEmail(email));
                              }
                            }}
                            error={!!addEmailError}
                            helperText={addEmailError}
                            sx={{ flex: 1, minWidth: '180px' }}
                          />
                          <TextField
                            size="small"
                            placeholder="Name"
                            value={addName}
                            onChange={(e) => { setAddName(e.target.value); setAddNameError(null); }}
                            error={!!addNameError}
                            helperText={addNameError}
                            sx={{ flex: 1, minWidth: '140px' }}
                          />
                          <Button
                            variant="contained"
                            size="small"
                            onClick={handleAddMember}
                            disabled={addingMember}
                            disableElevation
                            sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' }, height: '40px' }}
                          >
                            {addingMember ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Add'}
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<UploadFileIcon />}
                            onClick={handleImportClick}
                            disabled={importing}
                            sx={{ textTransform: 'none', borderRadius: '8px', height: '40px' }}
                          >
                            {importing ? <CircularProgress size={16} /> : 'Import'}
                          </Button>
                        </Box>
                      )}

                      {/* Member list */}
                      {expandedMembers.length === 0 ? (
                        <Typography sx={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', py: 2 }}>
                          No members in this list yet.
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {expandedMembers.map((member) => (
                            <ListItem
                              key={member.email}
                              sx={{ px: 1, py: 1.2, borderRadius: '6px', borderBottom: '1px solid #F3F4F6', '&:hover': { backgroundColor: '#F3F4F6' } }}
                              secondaryAction={
                                (userRole === 'owner' || userRole === 'admin') && (
                                  <IconButton
                                    size="small"
                                    onClick={() => setRemoveMemberDialog({ email: member.email, memberName: member.memberName })}
                                    title="Remove member"
                                  >
                                    <PersonRemoveIcon fontSize="small" sx={{ color: '#EF4444' }} />
                                  </IconButton>
                                )
                              }
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                                <Typography sx={{ fontSize: '13px', color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {member.email}
                                </Typography>
                                <Typography sx={{ fontSize: '13px', color: '#6B7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {member.memberName || '—'}
                                </Typography>
                              </Box>
                            </ListItem>
                          ))}
                        </List>
                      )}
                      {/* Member cap indicator */}
                      {expandedMembers.length > 0 && (
                        <Typography sx={{ fontSize: '11px', color: '#9CA3AF', mt: 1, textAlign: 'right' }}>
                          {expandedMembers.length} / {MEMBER_CAP} members
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              </Collapse>
            </Paper>
          ))}
        </List>
      )}

      {/* Create List Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => { if (!creating) { setCreateDialogOpen(false); setNewListName(''); setCreateError(null); } }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create New List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="List Name"
            value={newListName}
            onChange={(e) => { setNewListName(e.target.value); setCreateError(null); }}
            error={!!createError}
            helperText={createError || 'Letters, numbers, spaces, hyphens, and underscores (1-100 characters)'}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setCreateDialogOpen(false); setNewListName(''); setCreateError(null); }} disabled={creating} sx={{ textTransform: 'none', color: '#6B7280' }}>
            Cancel
          </Button>
          <Button onClick={handleCreate} variant="contained" disabled={creating} disableElevation sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}>
            {creating ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteDialog}
        onClose={() => { if (!deleting) setDeleteDialog(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Delete List</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: '#374151' }}>
            Are you sure you want to delete &quot;{deleteDialog?.listName}&quot;?
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#6B7280', mt: 1 }}>
            This will permanently remove the list and its {deleteDialog?.memberCount || 0} member{(deleteDialog?.memberCount || 0) !== 1 ? 's' : ''}. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(null)} disabled={deleting} sx={{ textTransform: 'none', color: '#6B7280' }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="contained" disabled={deleting} disableElevation sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#EF4444', '&:hover': { backgroundColor: '#DC2626' } }}>
            {deleting ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog
        open={!!removeMemberDialog}
        onClose={() => { if (!removingMember) setRemoveMemberDialog(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Remove Member</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: '#374151' }}>
            Remove &quot;{removeMemberDialog?.memberName}&quot; ({removeMemberDialog?.email}) from this list?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoveMemberDialog(null)} disabled={removingMember} sx={{ textTransform: 'none', color: '#6B7280' }}>
            Cancel
          </Button>
          <Button onClick={handleRemoveMember} variant="contained" disabled={removingMember} disableElevation sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#EF4444', '&:hover': { backgroundColor: '#DC2626' } }}>
            {removingMember ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Members Modal */}
      <ImportMembersModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
        }}
        onUpload={handleImportUpload}
        onImportComplete={() => {
          refreshExpandedMembers(expandedListId);
          fetchLists();
        }}
      />
    </Box>
  );
};

export default MemberListsTab;
