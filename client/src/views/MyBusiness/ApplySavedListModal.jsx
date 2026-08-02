import React, { useState, useEffect } from 'react';
import {
  getSavedLists,
  applySavedListToEvent,
} from '../../services/savedListService';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';

const STEPS = {
  SELECT: 'select',
  CONFIRM: 'confirm',
  APPLYING: 'applying',
  SUCCESS: 'success',
  PARTIAL_FAILURE: 'partial_failure',
  ERROR: 'error',
};

const ApplySavedListModal = ({ open, onClose, businessId, eventId, onApplySuccess }) => {
  const [step, setStep] = useState(STEPS.SELECT);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [selectedList, setSelectedList] = useState(null);
  const [result, setResult] = useState(null); // { added, skipped, failed, total }
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch lists when modal opens
  useEffect(() => {
    if (open && businessId) {
      fetchSavedLists();
    }
    if (!open) {
      // Reset state when modal closes
      setStep(STEPS.SELECT);
      setLists([]);
      setSelectedList(null);
      setResult(null);
      setFetchError(null);
      setErrorMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessId]);

  const fetchSavedLists = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await getSavedLists(businessId);
      const data = res.data?.lists || res.data || [];
      data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setLists(data);
    } catch (err) {
      console.error('Error fetching saved lists:', err);
      setFetchError('Failed to load saved lists. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectList = (list) => {
    setSelectedList(list);
    setStep(STEPS.CONFIRM);
  };

  const handleBackToSelect = () => {
    setSelectedList(null);
    setStep(STEPS.SELECT);
  };

  const handleApply = async () => {
    if (!selectedList || !eventId) return;
    setStep(STEPS.APPLYING);
    setResult(null);
    setErrorMessage('');

    try {
      const res = await applySavedListToEvent(eventId, selectedList.listId, businessId);
      const data = res.data || {};
      const statusCode = res.status || res.data?.statusCode;

      const applyResult = {
        added: data.added || 0,
        skipped: data.skipped || 0,
        failed: data.failed || 0,
        total: data.total || selectedList.memberCount || 0,
      };
      setResult(applyResult);

      if (statusCode === 207 || data.failed > 0) {
        // Partial failure
        setStep(STEPS.PARTIAL_FAILURE);
      } else {
        // Full success
        setStep(STEPS.SUCCESS);
        if (onApplySuccess) onApplySuccess();
      }
    } catch (err) {
      console.error('Error applying saved list:', err);
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 207) {
        // Partial failure returned as error
        const applyResult = {
          added: data?.added || 0,
          skipped: data?.skipped || 0,
          failed: data?.failed || 0,
          total: data?.total || selectedList.memberCount || 0,
        };
        setResult(applyResult);
        setStep(STEPS.PARTIAL_FAILURE);
      } else {
        const msg = data?.error || 'Failed to apply the saved list. Please try again.';
        setErrorMessage(msg);
        setStep(STEPS.ERROR);
      }
    }
  };

  const handleRetry = () => {
    handleApply();
  };

  const handleDone = () => {
    if (step === STEPS.SUCCESS && onApplySuccess) {
      onApplySuccess();
    }
    onClose();
  };

  // Prevent closing during apply operation
  const handleClose = () => {
    if (step === STEPS.APPLYING) return;
    onClose();
  };

  const renderContent = () => {
    // Loading saved lists
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress size={28} />
          <Typography sx={{ ml: 2, color: '#6B7280', fontSize: '14px' }}>Loading saved lists...</Typography>
        </Box>
      );
    }

    // Fetch error
    if (fetchError) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>
          <Button variant="outlined" onClick={fetchSavedLists} sx={{ textTransform: 'none' }}>
            Retry
          </Button>
        </Box>
      );
    }

    switch (step) {
      case STEPS.SELECT:
        return renderSelectStep();
      case STEPS.CONFIRM:
        return renderConfirmStep();
      case STEPS.APPLYING:
        return renderApplyingStep();
      case STEPS.SUCCESS:
        return renderSuccessStep();
      case STEPS.PARTIAL_FAILURE:
        return renderPartialFailureStep();
      case STEPS.ERROR:
        return renderErrorStep();
      default:
        return null;
    }
  };

  const renderSelectStep = () => {
    if (lists.length === 0) {
      return (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '15px', color: '#6B7280', mb: 1 }}>
            No saved lists available.
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#9CA3AF' }}>
            Create a saved list from the Member Lists tab on your business page.
          </Typography>
        </Box>
      );
    }

    return (
      <List disablePadding>
        {lists.map((list, index) => (
          <React.Fragment key={list.listId}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => handleSelectList(list)}
                sx={{ py: 1.5, px: 2, borderRadius: '8px', '&:hover': { backgroundColor: '#F3F4F6' } }}
              >
                <ListItemText
                  primary={list.listName}
                  secondary={`${list.memberCount || 0} member${(list.memberCount || 0) !== 1 ? 's' : ''}`}
                  primaryTypographyProps={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}
                  secondaryTypographyProps={{ fontSize: '12px', color: '#6B7280' }}
                />
              </ListItemButton>
            </ListItem>
            {index < lists.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    );
  };

  const renderConfirmStep = () => (
    <Box sx={{ py: 2 }}>
      <Typography sx={{ fontSize: '14px', color: '#374151', mb: 1 }}>
        Apply <strong>{selectedList?.listName}</strong> to this event?
      </Typography>
      <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
        This will add {selectedList?.memberCount || 0} member{(selectedList?.memberCount || 0) !== 1 ? 's' : ''} to the event.
        Members already on the event will be skipped. Each new member will receive an access code via email.
      </Typography>
    </Box>
  );

  const renderApplyingStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
      <CircularProgress size={40} />
      <Typography sx={{ mt: 2, fontSize: '14px', color: '#6B7280' }}>
        Applying &quot;{selectedList?.listName}&quot;...
      </Typography>
      <Typography sx={{ mt: 1, fontSize: '12px', color: '#9CA3AF' }}>
        Generating access codes and sending emails.
      </Typography>
    </Box>
  );

  const renderSuccessStep = () => (
    <Box sx={{ py: 2 }}>
      <Alert severity="success" sx={{ mb: 2 }}>
        List applied successfully!
      </Alert>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 1 }}>
        <Typography sx={{ fontSize: '14px', color: '#374151' }}>
          <strong>{result?.added || 0}</strong> member{(result?.added || 0) !== 1 ? 's' : ''} added
        </Typography>
        {(result?.skipped || 0) > 0 && (
          <Typography sx={{ fontSize: '14px', color: '#6B7280' }}>
            <strong>{result.skipped}</strong> duplicate{result.skipped !== 1 ? 's' : ''} skipped
          </Typography>
        )}
        <Typography sx={{ fontSize: '12px', color: '#9CA3AF', mt: 1 }}>
          Total in saved list: {result?.total || 0}
        </Typography>
      </Box>
    </Box>
  );

  const renderPartialFailureStep = () => (
    <Box sx={{ py: 2 }}>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Some members could not be added.
      </Alert>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 1 }}>
        <Typography sx={{ fontSize: '14px', color: '#374151' }}>
          <strong>{result?.added || 0}</strong> member{(result?.added || 0) !== 1 ? 's' : ''} added successfully
        </Typography>
        {(result?.skipped || 0) > 0 && (
          <Typography sx={{ fontSize: '14px', color: '#6B7280' }}>
            <strong>{result.skipped}</strong> duplicate{result.skipped !== 1 ? 's' : ''} skipped
          </Typography>
        )}
        <Typography sx={{ fontSize: '14px', color: '#EF4444' }}>
          <strong>{result?.failed || 0}</strong> member{(result?.failed || 0) !== 1 ? 's' : ''} failed
        </Typography>
        <Typography sx={{ fontSize: '12px', color: '#9CA3AF', mt: 1 }}>
          Total in saved list: {result?.total || 0}
        </Typography>
      </Box>
    </Box>
  );

  const renderErrorStep = () => (
    <Box sx={{ py: 2 }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        {errorMessage || 'Failed to apply the saved list. Please try again.'}
      </Alert>
    </Box>
  );

  const renderActions = () => {
    switch (step) {
      case STEPS.SELECT:
        return (
          <Button onClick={handleClose} sx={{ textTransform: 'none', color: '#6B7280' }}>
            Cancel
          </Button>
        );
      case STEPS.CONFIRM:
        return (
          <>
            <Button onClick={handleBackToSelect} sx={{ textTransform: 'none', color: '#6B7280' }}>
              Back
            </Button>
            <Button
              onClick={handleApply}
              variant="contained"
              disableElevation
              sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}
            >
              Apply List
            </Button>
          </>
        );
      case STEPS.APPLYING:
        return null;
      case STEPS.SUCCESS:
        return (
          <Button
            onClick={handleDone}
            variant="contained"
            disableElevation
            sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}
          >
            Done
          </Button>
        );
      case STEPS.PARTIAL_FAILURE:
        return (
          <>
            <Button onClick={handleDone} sx={{ textTransform: 'none', color: '#6B7280' }}>
              Dismiss
            </Button>
            <Button
              onClick={handleRetry}
              variant="contained"
              disableElevation
              sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}
            >
              Retry
            </Button>
          </>
        );
      case STEPS.ERROR:
        return (
          <Button onClick={handleClose} sx={{ textTransform: 'none', color: '#6B7280' }}>
            Dismiss
          </Button>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (step) {
      case STEPS.SELECT:
        return 'Apply Saved List';
      case STEPS.CONFIRM:
        return 'Confirm Apply';
      case STEPS.APPLYING:
        return 'Applying List';
      case STEPS.SUCCESS:
        return 'Apply Complete';
      case STEPS.PARTIAL_FAILURE:
        return 'Partial Success';
      case STEPS.ERROR:
        return 'Apply Failed';
      default:
        return 'Apply Saved List';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 600 }}>{getTitle()}</DialogTitle>
      <DialogContent dividers={step === STEPS.SELECT && lists.length > 0}>
        {renderContent()}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {renderActions()}
      </DialogActions>
    </Dialog>
  );
};

export default ApplySavedListModal;
