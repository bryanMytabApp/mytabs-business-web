import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  MenuItem,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  assignPlanToCustomer,
  getPlanAssignment,
  clearPlanAssignment,
} from '../../services/paymentService';
import { pricingVersions } from '../../config/pricingVersions';

/**
 * Admin dialog: assign a PRICING VERSION to a customer so they see that version's
 * prices on their subscription screen. The customer still chooses their own plan
 * level; only the price VERSION is pinned, for a limited window. Optionally allow
 * them to actually update/renew their subscription during that window.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - business: the grid row for the target customer (carries userId + name)
 */
const EXPIRY_OPTIONS = [
  { label: '24 hours (default)', value: 24 },
  { label: '3 days', value: 72 },
  { label: '5 days', value: 120 },
];

// Human labels for the known pricing versions. Falls back to the raw date.
const VERSION_LABELS = {
  '2000-01-01': 'Legacy pricing',
  '2026-09-06': 'Current pricing',
};

const versionLabel = (v) => {
  const base = VERSION_LABELS[v.effectiveDate] || 'Pricing';
  return `${base} — effective ${v.effectiveDate}`;
};

const AssignPlanDialog = ({ open, onClose, business }) => {
  // The assignment is keyed by userId (the account owner/payer). We also pass the
  // row's businessId so the backend resolves the ACCOUNT businessId (org-parent
  // when under an org, else standalone) and stores + stamps it for matching.
  const userId = business?.ownerUserId || business?.userId || null;
  const businessId =
    business?.subscriberId || business?.businessId || business?._id || business?.organizationId || null;
  const customerName = business?.name || 'this customer';

  // Pricing versions come from the shipped config mirror (display-only).
  const versions = useMemo(
    () => (Array.isArray(pricingVersions) ? pricingVersions : []),
    []
  );

  const [selectedVersion, setSelectedVersion] = useState('');
  const [allowUpdate, setAllowUpdate] = useState(true);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [note, setNote] = useState('');

  const [existing, setExisting] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!open || !userId) return;
    setError(null);
    setSuccess(null);
    let cancelled = false;
    const loadExisting = async () => {
      setLoadingExisting(true);
      try {
        const res = await getPlanAssignment(userId);
        if (!cancelled) {
          const assignment = res?.assignment || null;
          setExisting(assignment);
          if (assignment?.pricingEffectiveDate) setSelectedVersion(assignment.pricingEffectiveDate);
          if (typeof assignment?.allowUpdate === 'boolean') setAllowUpdate(assignment.allowUpdate);
        }
      } catch (e) {
        if (!cancelled) setExisting(null);
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    };
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const handleAssign = async () => {
    setError(null);
    setSuccess(null);
    if (!userId) {
      setError('This row has no account owner, so pricing cannot be assigned.');
      return;
    }
    if (!selectedVersion) {
      setError('Please choose a pricing version to assign.');
      return;
    }
    setSaving(true);
    try {
      const res = await assignPlanToCustomer({
        userId,
        businessId,
        pricingEffectiveDate: selectedVersion,
        allowUpdate,
        expiresInHours,
        note: note.trim() || undefined,
      });
      setExisting(res && res.assignment ? res.assignment : null);
      const label = VERSION_LABELS[selectedVersion] || selectedVersion;
      setSuccess(
        `Pricing assigned: ${customerName} will see ${label}${
          allowUpdate ? ' and can update their subscription' : ' (view-only)'
        }${res?.assignment?.expiresAt ? ` until ${new Date(res.assignment.expiresAt).toLocaleString()}` : ''}.`
      );
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to assign pricing. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    setSuccess(null);
    if (!userId) return;
    setClearing(true);
    try {
      await clearPlanAssignment(userId);
      setExisting(null);
      setSuccess('Assignment cleared. The customer returns to current pricing.');
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to clear assignment.';
      setError(msg);
    } finally {
      setClearing(false);
    }
  };

  const busy = saving || clearing;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth data-testid="assign-plan-dialog">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Assign Pricing Version</span>
        <IconButton onClick={onClose} disabled={busy} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 14, color: '#374151', mb: 2 }}>
          Choose which pricing version <strong>{customerName}</strong> will see on their subscription
          screen. They keep choosing their own plan level; only the prices come from the version you
          pick, for the window below.
        </Typography>

        {!userId && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This row has no account owner, so pricing cannot be assigned to it.
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {loadingExisting ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={16} /> <Typography sx={{ fontSize: 13 }}>Checking current assignment…</Typography>
          </Box>
        ) : existing?.pricingEffectiveDate ? (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="existing-assignment">
            Currently assigned: <strong>{VERSION_LABELS[existing.pricingEffectiveDate] || existing.pricingEffectiveDate}</strong>
            {existing.allowUpdate ? ' (can update)' : ' (view-only)'}
            {existing.expiresAt ? ` — expires ${new Date(existing.expiresAt).toLocaleString()}` : ''}
          </Alert>
        ) : null}

        <TextField
          select
          fullWidth
          label="Pricing version"
          value={selectedVersion}
          onChange={(e) => setSelectedVersion(e.target.value)}
          disabled={busy || !userId || versions.length === 0}
          sx={{ mb: 2 }}
          data-testid="version-select"
        >
          {versions.length === 0 && <MenuItem value="" disabled>No pricing versions available</MenuItem>}
          {versions.map((v) => (
            <MenuItem key={v.effectiveDate} value={v.effectiveDate}>
              {versionLabel(v)}
            </MenuItem>
          ))}
        </TextField>

        <FormControlLabel
          control={
            <Switch
              checked={allowUpdate}
              onChange={(e) => setAllowUpdate(e.target.checked)}
              disabled={busy || !userId}
              data-testid="allow-update-toggle"
            />
          }
          label="Also allow them to update their subscription during this period"
          sx={{ mb: 1, display: 'block' }}
        />

        <TextField
          select
          fullWidth
          label="Access window"
          value={expiresInHours}
          onChange={(e) => setExpiresInHours(Number(e.target.value))}
          disabled={busy || !userId}
          sx={{ mb: 2 }}
          data-testid="expiry-select"
        >
          {EXPIRY_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy || !userId}
          multiline
          minRows={2}
          placeholder="e.g. Let them renew at legacy pricing after a failed renewal"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button
          color="error"
          onClick={handleClear}
          disabled={busy || !existing?.pricingEffectiveDate}
          sx={{ textTransform: 'none' }}
          data-testid="clear-assignment"
        >
          {clearing ? 'Clearing…' : 'Clear assignment'}
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>Close</Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={busy || !userId || !selectedVersion}
            sx={{ textTransform: 'none' }}
            data-testid="assign-plan-submit"
          >
            {saving ? 'Assigning…' : 'Assign pricing'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default AssignPlanDialog;
