import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

    const card = await screen.findByTestId('plan-gradient-card');
    expect(card).toHaveTextContent('Enterprise');
    expect(card).toHaveTextContent('Complimentary');
    expect(card).not.toHaveTextContent('No Active Plan');
    expect(card).not.toHaveTextContent('$0');
    // The exempt status is made explicit: a badge, an "Exempt" plan label, and
    // a clear managed note. Change Plan is hidden for exempt accounts.
    expect(screen.getByTestId('plan-exempt-badge')).toHaveTextContent('Exempt');
    expect(card).toHaveTextContent('Enterprise (Exempt)');
    expect(card).toHaveTextContent('✓ Exempt');
    expect(card).not.toHaveTextContent('Next billing');
    expect(screen.getByTestId('plan-managed-note')).toHaveTextContent('Exempt account — managed by MyTabs. No billing applies.');
    expect(screen.queryByTestId('change-plan-button')).not.toBeInTheDocument();
  });

  it('still shows "No Active Plan" when there is no Stripe sub and no premium row', async () => {
    getCustomerSubscription.mockResolvedValue({ data: { hasSubscription: false } });
    getUserPremiumSubscription.mockResolvedValue({ data: null });

    render(<BillingSection />);

    const card = await screen.findByTestId('plan-gradient-card');
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

    const card = await screen.findByTestId('plan-gradient-card');
    expect(card).toHaveTextContent('Growth');
    expect(card).toHaveTextContent('$49.00');
    expect(screen.getByTestId('change-plan-button')).toBeInTheDocument();
    // Premium-row fallback should not be consulted when Stripe has a sub.
    expect(getUserPremiumSubscription).not.toHaveBeenCalled();
    expect(screen.queryByTestId('plan-managed-note')).not.toBeInTheDocument();
  });
});

describe('BillingSection — admin-assigned pricing banner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCustomerInvoices.mockResolvedValue({ invoices: [] });
    getCustomerPaymentMethods.mockResolvedValue({ paymentMethods: [] });
    getSystemSubscriptions.mockResolvedValue({ data: [] });
    getUserPremiumSubscription.mockResolvedValue({ data: null });
  });

  it('shows the banner with an "Update now" action when pricing is assigned WITH allowUpdate', async () => {
    getCustomerSubscription.mockResolvedValue({
      data: {
        hasSubscription: false,
        assignedPricing: {
          pricingEffectiveDate: '2000-01-01',
          allowUpdate: true,
          expiresAt: '2999-01-01T00:00:00.000Z',
        },
      },
    });

    render(<BillingSection />);

    const banner = await screen.findByTestId('assigned-pricing-banner');
    expect(banner).toHaveTextContent('Update now');
    expect(banner).toHaveTextContent(/update your subscription/i);
  });

  it('shows the banner WITHOUT an update action when allowUpdate is false (view-only)', async () => {
    getCustomerSubscription.mockResolvedValue({
      data: {
        hasSubscription: false,
        assignedPricing: {
          pricingEffectiveDate: '2000-01-01',
          allowUpdate: false,
          expiresAt: '2999-01-01T00:00:00.000Z',
        },
      },
    });

    render(<BillingSection />);

    const banner = await screen.findByTestId('assigned-pricing-banner');
    expect(banner).not.toHaveTextContent('Update now');
  });

  it('does NOT show the assigned-pricing banner when no assignment is present', async () => {
    getCustomerSubscription.mockResolvedValue({ data: { hasSubscription: false } });

    render(<BillingSection />);

    await screen.findByTestId('plan-gradient-card');
    expect(screen.queryByTestId('assigned-pricing-banner')).not.toBeInTheDocument();
  });
});

describe('BillingSection — Change Plan modal resolves the current tier for legacy/exempt accounts', () => {
  // The current catalog only carries the NEW pricing rows; a Growth (level 2) row is
  // provided so the modal has plans to render and a known "Current" tier to match.
  const currentCatalog = [
    { _id: 'sub-starter-m', level: 1, sublevel: 'monthly', name: 'Starter Monthly', amount: 18700, priceId: 'price_starter_new' },
    { _id: 'sub-growth-m', level: 2, sublevel: 'monthly', name: 'Growth Monthly', amount: 56300, priceId: 'price_growth_new' },
    { _id: 'sub-pro-m', level: 3, sublevel: 'monthly', name: 'Pro Monthly', amount: 122100, priceId: 'price_pro_new' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getCustomerInvoices.mockResolvedValue({ invoices: [] });
    getCustomerPaymentMethods.mockResolvedValue({ paymentMethods: [] });
    getSystemSubscriptions.mockResolvedValue({ data: currentCatalog });
    getUserPremiumSubscription.mockResolvedValue({ data: null });
  });

  it('treats a LEGACY-priced Growth sub as Current (not "Upgrade") even when its priceId is not in the catalog', async () => {
    // Grandfathered Stripe price that no longer exists in the current catalog.
    getCustomerSubscription.mockResolvedValue({
      data: {
        hasSubscription: true,
        productName: 'Growth',
        amount: 1998,
        interval: 'month',
        status: 'active',
        currentPeriodEnd: 1893456000,
        memberLimit: 25,
        priceId: 'price_growth_LEGACY', // not in currentCatalog
        // no `level` — forces the fallback to resolve the tier from the name
      },
    });

    render(<BillingSection />);

    fireEvent.click(await screen.findByTestId('change-plan-button'));

    // Modal opens pre-selected on the resolved current tier (Growth), so the confirm
    // button invites picking a different plan rather than mislabeling the same tier.
    const confirmBtn = await screen.findByTestId('confirm-plan-change-button');
    expect(confirmBtn).toHaveTextContent('Select a different plan');
    expect(confirmBtn).not.toHaveTextContent('Upgrade to Growth');
  });

  it('resolves the current tier for an assigned-pricing account that opens the modal via "Update now"', async () => {
    // Legacy account pinned by an admin with allowUpdate — Stripe returns nothing,
    // the tier lives on the DynamoDB premium row's planId.
    getCustomerSubscription.mockResolvedValue({
      data: {
        hasSubscription: false,
        assignedPricing: { pricingEffectiveDate: '2000-01-01', allowUpdate: true, expiresAt: '2999-01-01T00:00:00.000Z' },
      },
    });
    getUserPremiumSubscription.mockResolvedValue({
      data: { isActive: true, billingMode: 'paid', planId: '2000-01-01Growth' },
    });

    render(<BillingSection />);

    const banner = await screen.findByTestId('assigned-pricing-banner');
    fireEvent.click(within(banner).getByText('Update now'));

    // With currentLevel resolved to Growth (2), the modal opens on the current tier.
    const confirmBtn = await screen.findByTestId('confirm-plan-change-button');
    expect(confirmBtn).toHaveTextContent('Select a different plan');
    expect(confirmBtn).not.toHaveTextContent('Upgrade to');
  });
});
