import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { createSavedList } from '../../services/savedListService';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Typography,
} from '@mui/material';

const LIST_NAME_REGEX = /^[A-Za-z0-9 \-_]+$/;
const MAX_NAME_LENGTH = 100;

const validateListName = (name) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'List name is required';
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return 'List name must be 100 characters or fewer';
  }
  if (!LIST_NAME_REGEX.test(trimmed)) {
    return 'List name can only contain letters, numbers, spaces, hyphens, and underscores';
  }
  return null;
};

const SaveListFromEventDialog = ({ open, onClose, businessId, members }) => {
  const [listName, setListName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (saving) return;
    setListName('');
    setError('');
    onClose();
  };

  const handleNameChange = (e) => {
    setListName(e.target.value);
    if (error) {
      setError('');
    }
  };

  const handleSave = async () => {
    const validationError = validateListName(listName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    const memberPayload = (members || []).map((m) => ({
      name: m.name || m.memberName || '',
      email: m.email || '',
    }));

    try {
      await createSavedList(businessId, {
        name: listName.trim(),
        members: memberPayload,
      });

      toast.success(
        `List "${listName.trim()}" saved with ${memberPayload.length} member${memberPayload.length !== 1 ? 's' : ''}`
      );
      setListName('');
      setError('');
      setSaving(false);
      onClose();
    } catch (err) {
      setSaving(false);
      const status = err.response?.status;

      if (status === 409) {
        setError('A list with this name already exists');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Save as List</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 2, mt: 1 }}>
          Save the current {members?.length || 0} member{(members?.length || 0) !== 1 ? 's' : ''} as a reusable list.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="List Name"
          placeholder="e.g. VIP Guests"
          value={listName}
          onChange={handleNameChange}
          error={!!error}
          helperText={error}
          disabled={saving}
          inputProps={{ maxLength: 101 }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
          disabled={saving}
          sx={{ textTransform: 'none', color: '#6B7280' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disableElevation
          disabled={saving}
          sx={{
            textTransform: 'none',
            borderRadius: '8px',
            backgroundColor: '#4F46E5',
            '&:hover': { backgroundColor: '#4338CA' },
            minWidth: 80,
          }}
        >
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveListFromEventDialog;
