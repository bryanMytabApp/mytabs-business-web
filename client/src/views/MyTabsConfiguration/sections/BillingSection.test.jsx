import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import BillingSection from './BillingSection';
import {
  getCustomerSubscription,
  getUserPremiumSubscription,
  getCustomerInvoices,
  getCustomerPaymentMethods,
  getSystemSubscriptions,
} from '../../../services/paymentService';

// No network in tests — mock every payment service call BillingSection makes.
jest.mock('../../../services/paymentService', () => ({
  getCustomerSubscription: jest.fn(),
  getUserPremiumSubscription: jest.fn(),
  cancelCustomerSubscription: jest.fn(),
  getCustomerInvoices: jest.fn(),
  getCustomerPaymentMethods: jest.fn(),
  getSystemSubscriptions: jest.fn(),
  updateCustomerSubscription: jest.fn(),
  createCheckoutSession: jest.fn(),
  createSetupSession: jest.fn(),
}));

// The org-member early-return uses a dynamic import of organizationService.
jest.mock('../../../services/organizationService', () => ({
  getMyOrganizations: jest.fn().mockResolvedValue({ data: { organizations: [] } }),
}));

// Provide a stable userId so fetchSubscription runs.
jest.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ state: { user: { userId: 'user-123' } }, dispatch: jest.fn() }),
}));

// Stripe hook is unused in these paths; return null.
jest.mock('@stripe/react-stripe-js', () => ({ useStripe: () => null }));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

describe('BillingSection — Current Plan card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCustomerInvoices.mockResolvedValue({ invoices: [] });
    getCustomerPaymentMethods.mockResolvedValue({ paymentMethods: [] });
    getSystemSubscriptions.mockResolvedValue({ data: [] });
    // Default: no premium row unless a test overrides it.
    getUserPremiumSubscription.mockResolvedValue({ data: null });
  });

  it('shows the granted plan (not "No Active Plan") for an EXEMPT account with no Stripe sub', async () => {
    // Stripe has nothing for a comped/enterprise account.
    getCustomerSubscription.mockResolvedValue({ data: { hasSubscription: false } });
    // DynamoDB row grants Enterprise via billingMode=exempt.
    getUserPremiumSubscription.mockResolvedValue({
      data: { isActive: true, billingMode: 'exempt', planId: '2026-09-01Enterprise' },
    });

    render(<BillingSection />);

    await waitFor(() => expect(screen.getByTestId('plan-gradient-card')).toBeInTheDocument());
    const card = screen.getByTestId('plan-gradient-card');
    expect(card).toHaveTextContent('Enterprise');
    expect(card).toHaveTextContent('Complimentary');
    expect(card).not.toHaveTextContent('No Active Plan');
    expect(card).not.toHaveTextContent('$0');
    // Managed note is surfaced and Change Plan is hidden for exempt accounts.
    expect(screen.getByTestId('plan-managed-note')).toHaveTextContent('Managed by MyTabs');
    expect(screen.queryByTestId('change-plan-button')).not.toBeInTheDocument();
  });

  it('still shows "No Active Plan" when there is no Stripe sub and no premium row', async () => {
    getCustomerSubscription.mockResolvedValue({ data: { hasSubscription: false } });
    getUserPremiumSubscription.mockResolvedValue({ data: null });

    render(<BillingSection />);

    await waitFor(() => expect(screen.getByTestId('plan-gradient-card')).toBeInTheDocument());
    const card = screen.getByTestId('plan-gradient-card');
    expect(card).toHaveTextContent('No Active Plan');
    // Normal no-plan accounts keep the Change Plan button (to subscribe).
    expect(screen.getByTestId('change-plan-button')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-managed-note')).not.toBeInTheDocument();
  });

  it('leaves normal paid Stripe subscriptions unchanged (Change Plan visible, real price)', async () => {
    getCustomerSubscription.mockResolvedValue({
      data: {
        hasSubscription: true,
        productName: 'Growth',
        amount: 4900,
        interval: 'month',
        status: 'active',
        currentPeriodEnd: 1893456000,
        memberLimit: 25,
        level: 2,
      },
    });

    render(<BillingSection />);

    await waitFor(() => expect(screen.getByTestId('plan-gradient-card')).toBeInTheDocument());
    const card = screen.getByTestId('plan-gradient-card');
    expect(card).toHaveTextContent('Growth');
    expect(card).toHaveTextContent('$49.00');
    expect(screen.getByTestId('change-plan-button')).toBeInTheDocument();
    // Premium-row fallback should not be consulted when Stripe has a sub.
    expect(getUserPremiumSubscription).not.toHaveBeenCalled();
    expect(screen.queryByTestId('plan-managed-note')).not.toBeInTheDocument();
  });
});
