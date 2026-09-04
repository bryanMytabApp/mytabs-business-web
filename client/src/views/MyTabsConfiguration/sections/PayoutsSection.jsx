import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  loadConnectAndInitialize,
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '../../../utils/stripeConnect';
import SettingsCard from '../components/SettingsCard';
import {
  getPayoutStatus,
  createPayoutAccountSession,
  resetPayouts,
  getPayoutHistory,
} from '../../../services/paymentService';
import { getBusiness } from '../../../services/businessService';
import { parseJwt } from '../../../utils/common';
import { toast } from 'react-toastify';

/**
 * Payouts & Banking (self-serve, Req 10) — EMBEDDED onboarding.
 *
 * Lets an organizer connect a bank account to RECEIVE revenue (ticket payouts, raffles,
 * and any other payout use case share the SAME connected account). Onboarding is
 * EMBEDDED via Stripe Connect components — the organizer completes bank/KYC inline on
 * keeptabs.app (no redirect to Stripe). Stripe still collects the sensitive data inside
 * the component, so the platform never handles raw bank data. The platform fee is
 * admin-negotiated and never shown/edited here (Req 10.6).
 */

const STATUS_META = {
  none: {
    chipLabel: 'Not set up',
    chipBg: '#F3F4F6',
    chipColor: '#6B7280',
    nextStep: 'Setup takes just a few minutes. You\'ll verify your identity and add a bank account so revenue can be paid out to you.',
    cta: 'Set up payouts',
  },
  onboarding: {
    chipLabel: 'Setup incomplete',
    chipBg: '#FEF3C7',
    chipColor: '#D97706',
    nextStep: 'Your payout setup is incomplete. Finish verification to start receiving payouts.',
    cta: 'Finish setup',
  },
  restricted: {
    chipLabel: 'Action needed',
    chipBg: '#FEE2E2',
    chipColor: '#DC2626',
    nextStep: 'Stripe needs more information before you can receive payouts. Resolve the required items to continue.',
    cta: 'Resolve requirements',
  },
  enabled: {
    chipLabel: 'Payouts active',
    chipBg: '#ECFDF5',
    chipColor: '#059669',
    nextStep: 'Your bank account is connected and payouts are active. Revenue is paid out on your Stripe payout schedule.',
    cta: 'Update payout details',
  },
};

// Cents (integer minor units) → "$1,234.56". Payout amounts are always cents.
const formatCents = (cents, currency = 'usd') => {
  const n = Number.isFinite(cents) ? cents : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(n / 100);
  } catch {
    return `$${(n / 100).toFixed(2)}`;
  }
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

const PayoutsSection = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [history, setHistory] = useState(null); // { summary, rows } — journal-derived
  // Below this width the two columns stack (status card drops below the Connect content).
  const isNarrow = useMediaQuery('(max-width:900px)');
  // The ConnectJS instance is created once we have an account session; mounting the
  // provider renders the embedded onboarding component inline.
  const [connectInstance, setConnectInstance] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const sessionRef = useRef(null); // cache the resolved session for fetchClientSecret
  // The SPECIFIC selected business _id. Payout endpoints require this exact id (the
  // backend never guesses which business when an owner has several).
  const businessIdRef = useRef(null);

  // Resolve the concrete business _id for the currently-selected business. The
  // X-Business-Id header (set from the switcher) tells the backend which business to
  // return; getBusiness responds with that business record including its real _id.
  const resolveBusinessId = useCallback(async () => {
    if (businessIdRef.current) return businessIdRef.current;
    const userId =
      parseJwt(localStorage.getItem('idToken')) ||
      localStorage.getItem('username');
    const res = await getBusiness(userId);
    const biz = res?.data || res;
    const id = biz && biz._id ? biz._id : null;
    businessIdRef.current = id;
    return id;
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const businessId = await resolveBusinessId();
      if (!businessId) {
        // No specific business resolved yet — treat as not set up (no guess).
        setStatus({ status: 'none' });
        return;
      }
      const data = await getPayoutStatus(businessId);
      setStatus(data || { status: 'none' });
    } catch (err) {
      // 400 (no business) / 404 (unknown) → show "not set up", not an error banner.
      const code = err?.response?.status;
      if (code === 404 || code === 400) {
        setStatus({ status: 'none' });
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [resolveBusinessId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Once payouts are active, load the journal-derived history (summary + rows). Only
  // fetched when enabled — there's nothing to show before the first sale.
  useEffect(() => {
    if (status?.status !== 'enabled') return;
    let cancelled = false;
    (async () => {
      try {
        const businessId = await resolveBusinessId();
        const data = await getPayoutHistory(businessId);
        if (!cancelled) setHistory(data || { summary: null, rows: [] });
      } catch (err) {
        // History is non-critical; leave it null (section just won't render).
        if (!cancelled) setHistory({ summary: null, rows: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status?.status, resolveBusinessId]);

  // Begin embedded onboarding: fetch an account session, init ConnectJS, mount inline.
  const handleStartOnboarding = async () => {
    setStarting(true);
    try {
      const businessId = await resolveBusinessId();
      if (!businessId) {
        toast.error('Select a business first, then set up payouts.');
        setStarting(false);
        return;
      }
      const session = await createPayoutAccountSession(businessId);
      if (!session?.clientSecret || !session?.publishableKey) {
        toast.error('Could not start payout setup. Please try again.');
        setStarting(false);
        return;
      }
      sessionRef.current = session;

      // ConnectJS calls fetchClientSecret on init and on refresh; return the latest.
      const instance = loadConnectAndInitialize({
        publishableKey: session.publishableKey,
        fetchClientSecret: async () => {
          // Re-mint if a prior secret was consumed/expired (same business).
          const fresh = await createPayoutAccountSession(businessId);
          sessionRef.current = fresh;
          return fresh.clientSecret;
        },
        appearance: {
          variables: {
            colorPrimary: '#4F46E5',
            fontFamily: 'Nunito, sans-serif',
            borderRadius: '8px',
          },
        },
      });

      setConnectInstance(instance);
      setShowOnboarding(true);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not start payout setup. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  // When the organizer exits the embedded flow, tear it down and re-fetch status.
  const handleOnboardingExit = useCallback(() => {
    setShowOnboarding(false);
    setConnectInstance(null);
    fetchStatus();
  }, [fetchStatus]);

  // Stripe fires this as the account navigates between onboarding steps. It's an
  // analytics signal (not authoritative — exit still re-fetches the real status), but
  // once they've moved past the first screen we optimistically reflect "in progress" in
  // the status card so it updates live instead of staying on "Not set up".
  const handleStepChange = useCallback(() => {
    setStatus((prev) => {
      const s = prev?.status || 'none';
      // Don't downgrade an already-known enabled/restricted state.
      if (s === 'none') return { ...(prev || {}), status: 'onboarding' };
      return prev;
    });
  }, []);

  // Reset / start over: release the connected account + clear payout setup for THIS
  // business. Confirmation is a styled dialog (matches the Log Out confirmation).
  const confirmReset = async () => {
    setResetDialogOpen(false);
    setResetting(true);
    try {
      const businessId = await resolveBusinessId();
      await resetPayouts(businessId);
      businessIdRef.current = businessId; // keep resolved id
      setShowOnboarding(false);
      setConnectInstance(null);
      toast.success('Payout setup reset. You can start over.');
      await fetchStatus();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not reset payouts. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const currentStatus = status?.status || 'none';
  const meta = STATUS_META[currentStatus] || STATUS_META.none;
  // When the selected business is a child under an organization, payouts are managed by
  // the org — this business inherits the org's account and cannot set up/reset here.
  const orgManaged = !!status?.isChildInheriting;
  // When the selected business IS the organization, its banking covers every child
  // business under it (ownedByOrg true, but it is not itself inheriting).
  const isOrgOwner = !!status?.ownedByOrg && !status?.isChildInheriting;

  // The status summary is its OWN panel on the outer right (a sibling of the section
  // card, like the left nav) — not nested inside the body. The section card's body is
  // reserved for Connect content only (the prompt + CTA, or the embedded onboarding).
  const statusCard = (
    <Box
      sx={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #EEF0F3',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
      }}
      data-testid="payout-status-card"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: 1.5 }}>
        <AccountBalanceOutlinedIcon sx={{ color: '#4F46E5', fontSize: '22px' }} />
        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
          Payout status
        </Typography>
      </Box>

      <Chip
        icon={currentStatus === 'enabled' ? <CheckCircleOutlineIcon sx={{ fontSize: '15px !important' }} /> : undefined}
        label={meta.chipLabel}
        size="small"
        sx={{
          backgroundColor: meta.chipBg,
          color: meta.chipColor,
          fontWeight: 500,
          fontSize: '12px',
          height: '24px',
          mb: 1,
          '& .MuiChip-icon': { color: meta.chipColor },
        }}
        data-testid={`payout-status-chip-${currentStatus}`}
      />

      <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
        {currentStatus === 'enabled'
          ? 'Bank account connected'
          : currentStatus === 'none'
          ? 'Not set up yet'
          : 'Setup in progress'}
      </Typography>

      {/* Org-managed note for a child business (read-only). */}
      {orgManaged && (
        <Typography sx={{ fontSize: '12px', color: '#6B7280', mt: 2 }} data-testid="payout-org-managed-note">
          Managed by your organization.
        </Typography>
      )}

      {/* Org owner note: this account covers all child businesses. */}
      {isOrgOwner && (
        <Typography sx={{ fontSize: '12px', color: '#6B7280', mt: 2 }} data-testid="payout-org-owner-note">
          Applies to all businesses in your organization.
        </Typography>
      )}

      {/* Reset / start over — only when there's an account to release AND this business
          owns payouts (not a child inheriting from an org). */}
      {currentStatus !== 'none' && !orgManaged && (
        <Button
          variant="outlined"
          fullWidth
          onClick={() => setResetDialogOpen(true)}
          disabled={resetting || starting}
          startIcon={resetting ? <CircularProgress size={14} sx={{ color: '#DC2626' }} /> : null}
          sx={{
            mt: 2,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '13px',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#DC2626',
            borderColor: '#FCA5A5',
            '&:hover': { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
          }}
          data-testid="payout-reset-button"
        >
          {resetting ? 'Resetting…' : 'Reset payouts'}
        </Button>
      )}

      <Typography sx={{ fontSize: '12px', color: '#9CA3AF', mt: 2 }}>
        Banking details are collected securely by our third-party banking system inside
        this page. My Tabs never sees your raw bank information.
      </Typography>
    </Box>
  );

  // Main (middle) column — Connect content only.
  const mainContent = error ? (
    <Alert
      severity="warning"
      icon={<WarningAmberIcon />}
      sx={{
        borderRadius: '10px',
        backgroundColor: '#FFFBEB',
        border: '1px solid #FDE68A',
        '& .MuiAlert-message': { fontSize: '14px', color: '#92400E' },
      }}
      data-testid="payout-status-error"
    >
      We couldn't load your payout status. Please refresh and try again.
    </Alert>
  ) : showOnboarding && connectInstance ? (
    // ── Embedded onboarding (inline, no redirect) ──
    <Box data-testid="payout-embedded-onboarding">
      <ConnectComponentsProvider connectInstance={connectInstance}>
        <ConnectAccountOnboarding
          onExit={handleOnboardingExit}
          onStepChange={handleStepChange}
          // White-label: point terms/privacy at My Tabs' own agreements so the
          // embedded flow reads as My Tabs, not Stripe. (Stripe still requires a
          // minimal "powered by" disclosure that can't be fully removed.)
          // These resolve on the public customer site (mytabs.app), which hosts the
          // /terms and /privacy pages (including the Stripe/Connect disclosures).
          fullTermsOfServiceUrl="https://mytabs.app/terms"
          privacyPolicyUrl="https://mytabs.app/privacy"
        />
      </ConnectComponentsProvider>
      <Button
        onClick={handleOnboardingExit}
        sx={{ mt: 2, textTransform: 'none', fontSize: '13px', color: '#6B7280' }}
        data-testid="payout-onboarding-close"
      >
        Close
      </Button>
    </Box>
  ) : orgManaged ? (
    // Child business under an organization: payouts are managed at the org level.
    <Box data-testid="payout-org-managed">
      <Typography sx={{ fontSize: '14px', color: '#374151', mb: 2 }}>
        Payouts for this business are managed by your organization. Revenue is paid out to
        the organization's connected bank account.
      </Typography>

      {status?.bankAccount && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#FAFBFC',
            border: '1px solid #EEF0F3',
            borderRadius: '10px',
            padding: '14px 16px',
          }}
          data-testid="payout-bank-details"
        >
          <AccountBalanceOutlinedIcon sx={{ color: '#4F46E5', fontSize: '22px' }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              {status.bankAccount.bankName || 'Bank account'}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
              {status.bankAccount.last4 ? `Account ending in ${status.bankAccount.last4}` : 'Connected'}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  ) : (
    <Box data-testid="payout-connect-prompt">
      {/* Organization owner: make it explicit this banking covers every child business. */}
      {isOrgOwner && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            backgroundColor: '#EEF2FF',
            border: '1px solid #C7D2FE',
            borderRadius: '10px',
            padding: '12px 14px',
            mb: 2,
          }}
          data-testid="payout-org-owner-banner"
        >
          <ApartmentOutlinedIcon sx={{ color: '#4F46E5', fontSize: '20px', mt: '1px' }} />
          <Typography sx={{ fontSize: '13px', color: '#3730A3' }}>
            This is your organization's bank account. Payouts set up here apply to your
            organization and <strong>all of its businesses</strong> — you only need to set
            this up once.
          </Typography>
        </Box>
      )}

      <Typography sx={{ fontSize: '14px', color: '#374151', mb: 2 }} data-testid="payout-next-step">
        {meta.nextStep}
      </Typography>

      {/* When connected, show a real "Banking" summary so it reads as a bank view. */}
      {currentStatus === 'enabled' && status?.bankAccount && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#FAFBFC',
            border: '1px solid #EEF0F3',
            borderRadius: '10px',
            padding: '14px 16px',
            mb: 2,
          }}
          data-testid="payout-bank-details"
        >
          <AccountBalanceOutlinedIcon sx={{ color: '#4F46E5', fontSize: '22px' }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              {status.bankAccount.bankName || 'Bank account'}
              {status.bankAccount.currency ? (
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6B7280',
                    backgroundColor: '#F3F4F6',
                    borderRadius: '6px',
                    padding: '2px 6px',
                    textTransform: 'uppercase',
                  }}
                >
                  {status.bankAccount.currency}
                </Box>
              ) : null}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
              {status.bankAccount.last4
                ? `Account ending in ${status.bankAccount.last4}`
                : 'Connected'}
            </Typography>
          </Box>
        </Box>
      )}

      <Button
        variant="contained"
        onClick={handleStartOnboarding}
        disabled={starting || loading || resetting}
        startIcon={starting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
        sx={{
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '14px',
          borderRadius: '8px',
          padding: '9px 18px',
          backgroundColor: '#4F46E5',
          '&:hover': { backgroundColor: '#4338CA' },
        }}
        data-testid="payout-cta-button"
      >
        {starting ? 'Loading…' : meta.cta}
      </Button>

      {/* Payout history (journal-derived) — shown once payouts are active. */}
      {currentStatus === 'enabled' && history && (
        <Box sx={{ mt: 3 }} data-testid="payout-history">
          <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', mb: 1.5 }}>
            Payout history
          </Typography>

          {/* Summary tiles */}
          {history.summary && (
            <Box sx={{ display: 'flex', gap: '12px', flexWrap: 'wrap', mb: 2 }}>
              <Box
                sx={{ flex: '1 1 140px', backgroundColor: '#F5F3FF', borderRadius: '10px', padding: '12px 14px' }}
                data-testid="payout-outstanding"
              >
                <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>Available to pay out</Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#4F46E5' }}>
                  {formatCents(history.summary.outstandingPayableCents, history.summary.currency)}
                </Typography>
              </Box>
              <Box sx={{ flex: '1 1 140px', backgroundColor: '#FAFBFC', borderRadius: '10px', padding: '12px 14px' }}>
                <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>Lifetime earned</Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  {formatCents(history.summary.lifetimeEarnedCents, history.summary.currency)}
                </Typography>
              </Box>
              <Box sx={{ flex: '1 1 140px', backgroundColor: '#FAFBFC', borderRadius: '10px', padding: '12px 14px' }}>
                <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>Paid out</Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  {formatCents(history.summary.lifetimePaidOutCents, history.summary.currency)}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Rows */}
          {history.rows && history.rows.length > 0 ? (
            <Box sx={{ border: '1px solid #EEF0F3', borderRadius: '10px', overflow: 'hidden' }}>
              {history.rows.map((row) => (
                <Box
                  key={row.transactionId}
                  data-testid="payout-history-row"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderBottom: '1px solid #F3F4F6',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                      {row.type === 'SALE' ? 'Ticket sale' : row.type}
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>
                      {formatDate(row.effectiveAt)}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: row.organizerAmountCents >= 0 ? '#059669' : '#DC2626',
                    }}
                  >
                    {row.organizerAmountCents >= 0 ? '+' : ''}
                    {formatCents(row.organizerAmountCents, row.currency)}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography
              sx={{ fontSize: '13px', color: '#9CA3AF', py: 2 }}
              data-testid="payout-history-empty"
            >
              No payouts yet. Once you sell tickets, your payout activity will appear here.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      data-testid="section-payouts"
      sx={{
        display: 'flex',
        flexDirection: isNarrow ? 'column' : 'row',
        gap: '24px',
        alignItems: 'flex-start',
      }}
    >
      {/* Main (middle) panel: the section card holds Connect content only */}
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        <SettingsCard
          title="Payouts & Banking"
          subtitle="Connect a bank account to receive revenue from your ticket sales, raffles, and more"
          loading={loading}
        >
          {mainContent}
        </SettingsCard>
      </Box>

      {/* Outer-right panel: standalone status card (sibling of the section card) */}
      <Box sx={{ width: isNarrow ? '100%' : '300px', flexShrink: 0 }}>{statusCard}</Box>

      {/* Reset confirmation — styled to match the Log Out confirmation dialog. */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            padding: '8px',
            maxWidth: '380px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          },
        }}
        data-testid="payout-reset-dialog"
      >
        <DialogTitle
          sx={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '18px',
            fontWeight: 600,
            color: '#111827',
            padding: '20px 24px 8px',
          }}
        >
          Reset payouts
        </DialogTitle>
        <DialogContent sx={{ padding: '12px 24px' }}>
          <Typography sx={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#6B7280' }}>
            Are you sure you want to reset payouts? This releases the connected bank account
            for this business and starts setup over.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ padding: '12px 24px 20px', gap: '12px' }}>
          <Button
            onClick={() => setResetDialogOpen(false)}
            variant="outlined"
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              padding: '8px 20px',
              color: '#6B7280',
              borderColor: '#E5E7EB',
              '&:hover': { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' },
            }}
            data-testid="payout-reset-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmReset}
            variant="contained"
            disableElevation
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              padding: '8px 20px',
              backgroundColor: '#EF4444',
              '&:hover': { backgroundColor: '#DC2626' },
            }}
            data-testid="payout-reset-confirm"
          >
            Reset payouts
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PayoutsSection;
