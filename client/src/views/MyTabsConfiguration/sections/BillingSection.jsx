import React, { useState, useEffect } from 'react';
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
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SettingsCard from '../components/SettingsCard';
import { useSettings } from '../context/SettingsContext';
import {
  getCustomerSubscription,
  cancelCustomerSubscription,
  getCustomerInvoices,
  getCustomerPaymentMethods,
  getSystemSubscriptions,
  updateCustomerSubscription,
  createSetupSession,
} from '../../../services/paymentService';
import { parseJwt } from '../../../utils/common';
import { useStripe } from '@stripe/react-stripe-js';
import { toast } from 'react-toastify';

// Plan metadata (features/descriptions) — prices come from Stripe via API
const PLAN_META = {
  1: {
    name: 'Basic',
    description: 'For individuals getting started',
    features: ['3 ad spaces', 'Quick Ad Tool', 'Ticketing Options', 'Generate QR codes'],
  },
  2: {
    name: 'Plus',
    description: 'For growing businesses',
    features: ['10 ad spaces', 'Dedicated ad spaces', 'All Basic features included'],
  },
  3: {
    name: 'Premium',
    description: 'For established businesses',
    features: ['25 ad spaces', 'Tour/Season space included', 'All Plus features included'],
  },
};

const tableStyles = {
  headerCell: {
    fontWeight: 600,
    fontSize: '13px',
    color: '#6B7280',
    borderBottom: '1px solid #E5E7EB',
    padding: '10px 12px',
  },
  bodyCell: {
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
    padding: '12px',
  },
};

const BillingSection = () => {
  const { state } = useSettings();
  const stripe = useStripe();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [isOrgMember, setIsOrgMember] = useState(false); // true if user is under an org but not the owner

  // Change Plan dialog state
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState('monthly');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [systemSubscriptions, setSystemSubscriptions] = useState([]);
  const [changingPlan, setChangingPlan] = useState(false);

  // Fetch real subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken')) || localStorage.getItem('username');
        if (!userId) {
          setLoading(false);
          return;
        }

        // Check if user is an org member (not owner) — they shouldn't see billing
        try {
          const { getMyOrganizations } = await import('../../../services/organizationService');
          const myOrgsRes = await getMyOrganizations();
          const orgs = myOrgsRes?.data?.organizations || myOrgsRes?.data || [];
          if (orgs.length > 0 && orgs[0].role !== 'owner') {
            setIsOrgMember(true);
            setLoading(false);
            return;
          }
        } catch (e) { /* not in an org, continue normally */ }

        const response = await getCustomerSubscription({ userId });
        const subData = response?.data;

        if (subData && subData.hasSubscription) {
          // Use the real product name from Stripe
          const planName = subData.productName || subData.planName || 'Active Plan';

          // Store priceId so we can match against system subscriptions later
          setPlan({
            name: planName,
            price: subData.amount ? `$${(subData.amount / 100).toFixed(2)}` : '—',
            period: subData.interval === 'year' ? '/year' : subData.interval === 'month' && subData.intervalCount === 3 ? '/quarter' : '/month',
            status: subData.status || 'active',
            nextBilling: subData.currentPeriodEnd
              ? new Date(subData.currentPeriodEnd * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : 'N/A',
            currentPeriodEnd: subData.currentPeriodEnd,
            memberLimit: subData.memberLimit || 25,
            level: subData.level || 0,
            priceId: subData.priceId,
            sublevel: subData.sublevel || '',
          });

          // Set current level from subscription data if available
          if (subData.level) {
            setCurrentLevel(subData.level);
          }
          if (subData.sublevel) {
            setSelectedBillingPeriod(subData.sublevel);
          }
        } else {
          setPlan({
            name: 'No Active Plan',
            price: '$0',
            period: '',
            status: 'inactive',
            nextBilling: 'N/A',
            memberLimit: 0,
          });
        }
      } catch (err) {
        console.error('Failed to fetch subscription:', err);
        setPlan({
          name: 'Unable to load',
          price: '—',
          period: '',
          status: 'error',
          nextBilling: 'N/A',
          memberLimit: 0,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSubscription();
  }, [state.user?.userId]);

  // Fetch invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken')) || localStorage.getItem('username');
        if (!userId) return;
        const data = await getCustomerInvoices(userId);
        if (data?.invoices?.length) {
          setInvoices(data.invoices);
        }
      } catch (err) {
        console.log('Invoices endpoint not available, using mock data');
      }
    };
    fetchInvoices();
  }, [state.user?.userId]);

  // Fetch payment methods
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken')) || localStorage.getItem('username');
        if (!userId) return;
        const data = await getCustomerPaymentMethods(userId);
        if (data?.paymentMethods?.length) {
          setPaymentMethods(data.paymentMethods);
        }
      } catch (err) {
        console.log('Payment methods endpoint not available, using mock data');
      }
    };
    fetchPaymentMethods();
  }, [state.user?.userId]);

  // Fetch system subscriptions for plan change dialog
  useEffect(() => {
    const fetchSystemSubs = async () => {
      try {
        const response = await getSystemSubscriptions();
        if (response?.data) {
          setSystemSubscriptions(response.data);
        }
      } catch (err) {
        console.log('Could not fetch system subscriptions');
      }
    };
    fetchSystemSubs();
  }, []);

  // Once we have both plan and system subscriptions, match the priceId to find current level/sublevel
  useEffect(() => {
    if (plan?.priceId && systemSubscriptions.length > 0 && currentLevel === 0) {
      const matchingSub = systemSubscriptions.find((s) => s.priceId === plan.priceId);
      if (matchingSub) {
        setCurrentLevel(matchingSub.level);
        setSelectedBillingPeriod(matchingSub.sublevel || 'monthly');
      }
    }
  }, [plan, systemSubscriptions, currentLevel]);

  const handleOpenChangePlan = () => {
    setSelectedLevel(currentLevel || 1);
    // Keep the current billing period selected when opening
    if (!selectedBillingPeriod) {
      setSelectedBillingPeriod('monthly');
    }
    setChangePlanOpen(true);
  };

  // Build available plan levels and billing periods from system subscriptions
  const availableLevels = [...new Set(systemSubscriptions.map((s) => s.level))].sort();
  const availablePeriods = [...new Set(systemSubscriptions.map((s) => s.sublevel))];

  // Get price for a specific level + billing period from system subscriptions
  const getPriceForPlan = (level, period) => {
    const sub = systemSubscriptions.find((s) => s.level === level && s.sublevel === period);
    if (!sub) return null;
    return (sub.amount / 100).toFixed(2);
  };

  // Get the display price for a level (use selected billing period)
  const getDisplayPrice = (level) => {
    const sub = systemSubscriptions.find((s) => s.level === level && s.sublevel === selectedBillingPeriod)
      || systemSubscriptions.find((s) => s.level === level && s.sublevel === 'monthly')
      || systemSubscriptions.find((s) => s.level === level);
    if (!sub) return '0.00';
    return (sub.amount / 100).toFixed(2);
  };

  // Get plan name from system subscriptions
  const getPlanName = (level) => {
    const sub = systemSubscriptions.find((s) => s.level === level);
    if (!sub) return PLAN_META[level]?.name || `Plan ${level}`;
    // Extract base name (remove "Monthly", "Quarterly", "Yearly", "subscription" suffixes)
    const name = sub.name?.replace(/\s*(monthly|quarterly|yearly|annual|subscription)/gi, '').trim();
    // Capitalize first letter
    const capitalized = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
    return capitalized || PLAN_META[level]?.name || `Plan ${level}`;
  };

  const handleConfirmPlanChange = async () => {
    if (!selectedLevel || selectedLevel === currentLevel) {
      setChangePlanOpen(false);
      return;
    }

    setChangingPlan(true);
    try {
      const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken')) || localStorage.getItem('username');

      // Find the matching subscription from system subscriptions
      const matchingSub = systemSubscriptions.find(
        (sub) => sub.level === selectedLevel && sub.sublevel === selectedBillingPeriod
      );

      if (!matchingSub) {
        toast.error('Could not find matching subscription plan');
        setChangingPlan(false);
        return;
      }

      const sessionData = {
        userId,
        sublevel: selectedBillingPeriod,
        level: selectedLevel,
        newSubId: matchingSub._id,
      };

      const response = await updateCustomerSubscription(sessionData);

      if (
        response.data &&
        response.data.subscription &&
        response.data.subscription.cancel_at_period_end
      ) {
        // Downgrade scheduled at end of current period
        const downgradeDate = new Date(
          response.data.subscription.current_period_end * 1000
        ).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        toast.success(`Downgrade to ${getPlanName(selectedLevel)} scheduled for ${downgradeDate}`);
        setChangePlanOpen(false);
      } else if (response.data && response.data.sessionId) {
        // Upgrade — redirect to Stripe checkout
        if (stripe) {
          const result = await stripe.redirectToCheckout({ sessionId: response.data.sessionId });
          if (result?.error) {
            toast.error(result.error.message);
          }
        } else {
          toast.error('Payment system not available. Please try again.');
        }
      } else {
        toast.success('Subscription updated successfully!');
        setChangePlanOpen(false);
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to change plan:', err);
      toast.error('Failed to update subscription. Please try again.');
    } finally {
      setChangingPlan(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) return;
    setCanceling(true);
    try {
      const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken')) || localStorage.getItem('username');
      await cancelCustomerSubscription(userId);
      setPlan((prev) => prev ? { ...prev, status: 'canceled' } : prev);
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
    } finally {
      setCanceling(false);
    }
  };

  const handleSetDefault = (methodId) => {
    setPaymentMethods((prev) =>
      prev.map((m) => ({ ...m, isDefault: m.id === methodId }))
    );
  };

  const handleRemoveMethod = (methodId) => {
    setPaymentMethods((prev) => prev.filter((m) => m.id !== methodId));
  };

  const isUpgrade = selectedLevel > currentLevel;
  const isDowngrade = selectedLevel < currentLevel;

  // If user is an org member (not owner), billing is managed at org level
  if (isOrgMember) {
    return (
      <Box data-testid="section-billing">
        <Box sx={{ backgroundColor: '#fff', borderRadius: '16px', padding: '48px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#111827', mb: 1 }}>
            Billing Managed by Organization
          </Typography>
          <Typography sx={{ fontSize: '14px', color: '#6B7280' }}>
            Your subscription is managed by your organization owner. Contact them for billing changes.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box data-testid="section-billing">
      {/* Past-due warning banner */}
      {plan?.status === 'past_due' && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{
            mb: 3,
            borderRadius: '10px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            '& .MuiAlert-message': { fontSize: '14px', color: '#92400E' },
          }}
          data-testid="past-due-banner"
        >
          Your subscription is past due. Please update your payment method to avoid service interruption.
        </Alert>
      )}

      {/* Current Plan Card */}
      <SettingsCard
        title="Current Plan"
        subtitle="Your active subscription details"
        loading={loading}
      >
        {plan && (
          <>
            <Box
              sx={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                borderRadius: '12px',
                padding: '24px',
                color: '#fff',
              }}
              data-testid="plan-gradient-card"
            >
              <Typography sx={{ fontSize: '20px', fontWeight: 700, mb: 1 }}>
                {plan.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2 }}>
                <Typography sx={{ fontSize: '32px', fontWeight: 800 }}>
                  {plan.price}
                </Typography>
                <Typography sx={{ fontSize: '14px', fontWeight: 400, opacity: 0.8, ml: '4px' }}>
                  {plan.period}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: '16px', fontSize: '13px', opacity: 0.9, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '13px', opacity: 0.9 }}>
                  Status: {plan.status === 'active' ? '✓ Active' : plan.status === 'trialing' ? '⏳ Trial' : plan.status === 'canceled' ? 'Canceled' : plan.status}
                </Typography>
                <Typography sx={{ fontSize: '13px', opacity: 0.9 }}>
                  {plan.status === 'trialing'
                    ? `Trial ends: ${plan.nextBilling} (${plan.currentPeriodEnd ? Math.max(0, Math.ceil((plan.currentPeriodEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24))) : 0} days left)`
                    : `Next billing: ${plan.nextBilling}`}
                </Typography>
                {plan.memberLimit > 0 && (
                  <Typography sx={{ fontSize: '13px', opacity: 0.9 }}>
                    Up to {plan.memberLimit} members
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: '12px', mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleOpenChangePlan}
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '14px',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  backgroundColor: '#4F46E5',
                  '&:hover': { backgroundColor: '#4338CA' },
                }}
                data-testid="change-plan-button"
              >
                Change Plan
              </Button>
              {plan.status === 'active' && (
                <Button
                  variant="outlined"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '14px',
                    borderRadius: '8px',
                    padding: '9px 18px',
                    color: '#EF4444',
                    borderColor: '#FECACA',
                    '&:hover': {
                      backgroundColor: '#FEF2F2',
                      borderColor: '#EF4444',
                    },
                  }}
                  data-testid="cancel-subscription-button"
                >
                  {canceling ? 'Canceling...' : 'Cancel Subscription'}
                </Button>
              )}
            </Box>
          </>
        )}
      </SettingsCard>

      {/* Recent Invoices Card */}
      <SettingsCard
        title="Recent Invoices"
        subtitle="Your billing history and downloadable receipts"
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" data-testid="invoices-table">
            <TableHead>
              <TableRow>
                <TableCell sx={tableStyles.headerCell}>Date</TableCell>
                <TableCell sx={tableStyles.headerCell}>Amount</TableCell>
                <TableCell sx={tableStyles.headerCell}>Status</TableCell>
                <TableCell sx={tableStyles.headerCell}>Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: '#9CA3AF', fontSize: '14px' }}>
                    No invoices yet. Invoices will appear here after your first payment.
                  </TableCell>
                </TableRow>
              ) : invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell sx={tableStyles.bodyCell}>{invoice.date}</TableCell>
                  <TableCell sx={tableStyles.bodyCell}>{invoice.amount}</TableCell>
                  <TableCell sx={tableStyles.bodyCell}>
                    <Chip
                      label={invoice.status === 'paid' ? 'Paid' : 'Pending'}
                      size="small"
                      sx={{
                        backgroundColor: invoice.status === 'paid' ? '#ECFDF5' : '#FEF3C7',
                        color: invoice.status === 'paid' ? '#059669' : '#D97706',
                        fontWeight: 500,
                        fontSize: '12px',
                        height: '24px',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={tableStyles.bodyCell}>
                    <Button
                      size="small"
                      onClick={() => {
                        if (invoice.pdfUrl) {
                          window.open(invoice.pdfUrl, '_blank');
                        } else if (invoice.hostedUrl) {
                          window.open(invoice.hostedUrl, '_blank');
                        }
                      }}
                      disabled={!invoice.pdfUrl && !invoice.hostedUrl}
                      sx={{
                        textTransform: 'none',
                        fontSize: '13px',
                        color: invoice.pdfUrl || invoice.hostedUrl ? '#4F46E5' : '#9CA3AF',
                        fontWeight: 500,
                        padding: '4px 10px',
                        '&:hover': { backgroundColor: '#EEF2FF' },
                      }}
                      data-testid={`download-invoice-${invoice.id}`}
                    >
                      {invoice.pdfUrl || invoice.hostedUrl ? 'Download PDF' : 'Not available'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </SettingsCard>

      {/* Payment Methods Card */}
      <SettingsCard
        title="Payment Methods"
        subtitle="Manage your saved payment methods"
      >
        {paymentMethods.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ color: '#9CA3AF', fontSize: '14px' }}>
              No payment methods on file. Add a payment method to manage your subscription.
            </Typography>
          </Box>
        ) : paymentMethods.map((method) => (
          <Box
            key={method.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FAFBFC',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '12px',
            }}
            data-testid={`payment-method-${method.id}`}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Typography sx={{ fontSize: '20px' }}>💳</Typography>
              <Box>
                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {method.brand} •••• {method.last4}
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
                  Expires {method.expiry}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {method.isDefault && (
                <Chip
                  label="Default"
                  size="small"
                  sx={{
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    fontWeight: 500,
                    fontSize: '12px',
                    height: '24px',
                  }}
                />
              )}
              {!method.isDefault && (
                <Button
                  size="small"
                  onClick={() => handleSetDefault(method.id)}
                  sx={{
                    textTransform: 'none',
                    fontSize: '13px',
                    color: '#4F46E5',
                    fontWeight: 500,
                    padding: '4px 10px',
                    '&:hover': { backgroundColor: '#EEF2FF' },
                  }}
                  data-testid={`set-default-${method.id}`}
                >
                  Set Default
                </Button>
              )}
              <Button
                size="small"
                onClick={() => handleRemoveMethod(method.id)}
                sx={{
                  textTransform: 'none',
                  fontSize: '13px',
                  color: '#EF4444',
                  fontWeight: 500,
                  padding: '4px 10px',
                  '&:hover': { backgroundColor: '#FEF2F2' },
                }}
                data-testid={`remove-method-${method.id}`}
              >
                Remove
              </Button>
            </Box>
          </Box>
        ))}

        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #F3F4F6' }}>
          <Button
            variant="outlined"
            onClick={async () => {
              try {
                const userId = state.user?.userId || parseJwt(localStorage.getItem('idToken')) || localStorage.getItem('username');
                const res = await createSetupSession(userId);
                if (res?.url) {
                  window.location.href = res.url;
                } else {
                  toast.error('Failed to create setup session');
                }
              } catch (err) {
                console.error('Error creating setup session:', err);
                toast.error(err?.response?.data?.error || 'Failed to add payment method');
              }
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              padding: '9px 18px',
              color: '#4F46E5',
              borderColor: '#C7D2FE',
              '&:hover': {
                backgroundColor: '#EEF2FF',
                borderColor: '#4F46E5',
              },
            }}
            data-testid="add-payment-method-button"
          >
            Add Payment Method
          </Button>
        </Box>
      </SettingsCard>

      {/* Change Plan Dialog */}
      <Dialog
        open={changePlanOpen}
        onClose={() => !changingPlan && setChangePlanOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            padding: '8px',
          },
        }}
        data-testid="change-plan-dialog"
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '20px', color: '#111827', pb: 0 }}>
          Change Subscription Plan
        </DialogTitle>
        <Typography sx={{ px: 3, pt: 1, color: '#6B7280', fontSize: '14px' }}>
          {currentLevel > 0
            ? `You're currently on the ${getPlanName(currentLevel)} plan. Select a new plan below.`
            : 'Select a plan to subscribe to.'}
        </Typography>

        <DialogContent sx={{ pt: 2 }}>
          {/* Plan Selection */}
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: '12px', mb: 3, flexWrap: 'wrap' }}>
            {(availableLevels.length > 0 ? availableLevels : [1, 2, 3]).map((level) => {
              const isCurrent = level === currentLevel;
              const isSelected = level === selectedLevel;
              const wouldUpgrade = level > currentLevel;
              const wouldDowngrade = level < currentLevel;
              const meta = PLAN_META[level] || { name: `Plan ${level}`, description: '', features: [] };
              const displayPrice = getDisplayPrice(level);
              const planName = getPlanName(level);

              return (
                <Box
                  key={level}
                  onClick={() => !isCurrent && setSelectedLevel(level)}
                  sx={{
                    flex: '1 1 0',
                    minWidth: '200px',
                    border: isSelected
                      ? '2px solid #4F46E5'
                      : isCurrent
                      ? '2px solid #10B981'
                      : '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    cursor: isCurrent ? 'default' : 'pointer',
                    backgroundColor: isSelected && !isCurrent ? '#EEF2FF' : isCurrent ? '#F0FDF4' : '#fff',
                    transition: 'all 0.15s ease',
                    opacity: isCurrent ? 0.8 : 1,
                    '&:hover': !isCurrent ? {
                      borderColor: '#4F46E5',
                      backgroundColor: '#F5F3FF',
                    } : {},
                  }}
                  data-testid={`plan-option-${planName.toLowerCase()}`}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '4px' }}>
                        <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                          {planName}
                        </Typography>
                        {isCurrent && (
                          <Chip
                            icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important' }} />}
                            label="Current"
                            size="small"
                            sx={{
                              backgroundColor: '#ECFDF5',
                              color: '#059669',
                              fontWeight: 500,
                              fontSize: '11px',
                              height: '22px',
                              '& .MuiChip-icon': { color: '#059669' },
                            }}
                          />
                        )}
                        {!isCurrent && isSelected && wouldUpgrade && (
                          <Chip
                            icon={<ArrowUpwardIcon sx={{ fontSize: '14px !important' }} />}
                            label="Upgrade"
                            size="small"
                            sx={{
                              backgroundColor: '#EEF2FF',
                              color: '#4F46E5',
                              fontWeight: 500,
                              fontSize: '11px',
                              height: '22px',
                              '& .MuiChip-icon': { color: '#4F46E5' },
                            }}
                          />
                        )}
                        {!isCurrent && isSelected && wouldDowngrade && (
                          <Chip
                            icon={<ArrowDownwardIcon sx={{ fontSize: '14px !important' }} />}
                            label="Downgrade"
                            size="small"
                            sx={{
                              backgroundColor: '#FEF3C7',
                              color: '#D97706',
                              fontWeight: 500,
                              fontSize: '11px',
                              height: '22px',
                              '& .MuiChip-icon': { color: '#D97706' },
                            }}
                          />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
                        {meta.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: '8px', mt: 1, flexWrap: 'wrap' }}>
                        {meta.features.map((feat, i) => (
                          <Typography key={i} sx={{ fontSize: '12px', color: '#9CA3AF' }}>
                            • {feat}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right', mt: 1 }}>
                      <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>
                        ${displayPrice}
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>
                        /{selectedBillingPeriod === 'yearly' ? 'year' : selectedBillingPeriod === 'quarterly' ? 'quarter' : 'month'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Billing Period Selection */}
          {selectedLevel && availablePeriods.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', mb: 1 }}>
                Billing Period
              </Typography>
              <Box sx={{ display: 'flex', gap: '10px' }}>
                {availablePeriods.map((period) => {
                  const price = getPriceForPlan(selectedLevel, period);
                  return (
                    <Box
                      key={period}
                      onClick={() => setSelectedBillingPeriod(period)}
                      sx={{
                        flex: 1,
                        border: selectedBillingPeriod === period
                          ? '2px solid #4F46E5'
                          : '1px solid #E5E7EB',
                        borderRadius: '10px',
                        padding: '12px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: selectedBillingPeriod === period ? '#EEF2FF' : '#fff',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: '#4F46E5',
                        },
                      }}
                      data-testid={`billing-period-${period}`}
                    >
                      <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>
                        {period}
                      </Typography>
                      {price && (
                        <Typography sx={{ fontSize: '12px', color: '#6B7280', mt: '2px' }}>
                          ${price}/{period === 'yearly' ? 'yr' : period === 'quarterly' ? 'qtr' : 'mo'}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Downgrade notice */}
          {isDowngrade && selectedLevel !== currentLevel && (
            <Alert
              severity="info"
              sx={{
                mt: 2,
                borderRadius: '10px',
                '& .MuiAlert-message': { fontSize: '13px' },
              }}
            >
              Downgrades take effect at the end of your current billing period. You'll keep your current plan features until then.
            </Alert>
          )}

          {/* Upgrade notice */}
          {isUpgrade && selectedLevel !== currentLevel && (
            <Alert
              severity="info"
              sx={{
                mt: 2,
                borderRadius: '10px',
                '& .MuiAlert-message': { fontSize: '13px' },
              }}
            >
              Upgrades take effect immediately. You'll be redirected to complete payment.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: '8px' }}>
          <Button
            onClick={() => setChangePlanOpen(false)}
            disabled={changingPlan}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              padding: '9px 18px',
              color: '#6B7280',
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmPlanChange}
            disabled={changingPlan || selectedLevel === currentLevel}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '8px',
              padding: '9px 18px',
              backgroundColor: isDowngrade ? '#D97706' : '#4F46E5',
              '&:hover': { backgroundColor: isDowngrade ? '#B45309' : '#4338CA' },
              '&:disabled': { backgroundColor: '#E5E7EB', color: '#9CA3AF' },
            }}
            data-testid="confirm-plan-change-button"
          >
            {changingPlan ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : selectedLevel === currentLevel ? (
              'Select a different plan'
            ) : isUpgrade ? (
              `Upgrade to ${getPlanName(selectedLevel)}`
            ) : (
              `Downgrade to ${getPlanName(selectedLevel)}`
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingSection;
