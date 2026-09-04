import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PayoutsSection from './PayoutsSection';
import {
  getPayoutStatus,
  createPayoutAccountSession,
  resetPayouts,
  getPayoutHistory,
} from '../../../services/paymentService';
import { getBusiness } from '../../../services/businessService';

// Mock the payout service (no network in tests).
jest.mock('../../../services/paymentService', () => ({
  getPayoutStatus: jest.fn(),
  createPayoutAccountSession: jest.fn(),
  resetPayouts: jest.fn(),
  getPayoutHistory: jest.fn(),
}));

// The component resolves the SPECIFIC selected business _id via getBusiness before
// calling any payout endpoint (so the backend never guesses which business). Mock it
// to return Urban HTX's concrete _id.
jest.mock('../../../services/businessService', () => ({
  getBusiness: jest.fn().mockResolvedValue({ data: { _id: 'b3acf234', name: 'Urban HTX' } }),
}));
jest.mock('../../../utils/common', () => ({
  parseJwt: () => 'c2481a85',
}));

// Mock the local Stripe Connect wrapper so tests never load the ESM @stripe/connect-js
// (CRA's Jest doesn't transform node_modules ESM). loadConnectAndInitialize returns a
// stub instance; the embedded components render nothing in tests (their internals are
// Stripe's and are verified at runtime, not in this smoke test).
// The provider just renders children; the onboarding stub exposes buttons that fire the
// real callbacks (onStepChange / onExit) so tests can drive the embedded flow's events.
jest.mock('../../../utils/stripeConnect', () => {
  const React = require('react');
  return {
    __esModule: true,
    loadConnectAndInitialize: () => ({ __mockConnectInstance: true }),
    ConnectComponentsProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    ConnectAccountOnboarding: ({ onStepChange, onExit }) =>
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          { 'data-testid': 'mock-step-change', onClick: () => onStepChange && onStepChange({ step: 'business_details' }) },
          'step'
        ),
        React.createElement(
          'button',
          { 'data-testid': 'mock-exit', onClick: () => onExit && onExit() },
          'exit'
        )
      ),
  };
});

jest.mock('react-toastify', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

describe('PayoutsSection — embedded Payouts & Banking (Req 10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks wipes implementations — re-establish the default business resolution.
    getBusiness.mockResolvedValue({ data: { _id: 'b3acf234', name: 'Urban HTX' } });
    // History defaults to empty so existing tests don't hit an unmocked call.
    getPayoutHistory.mockResolvedValue({ summary: { outstandingPayableCents: 0, lifetimeEarnedCents: 0, lifetimePaidOutCents: 0, currency: 'usd' }, rows: [] });
  });

  it('renders the section title once loaded', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'none' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByText('Payouts & Banking')).toBeInTheDocument());
    expect(getPayoutStatus).toHaveBeenCalled();
  });

  it('shows the "Set up payouts" CTA for the none state', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'none' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-cta-button')).toHaveTextContent('Set up payouts'));
    expect(screen.getByTestId('payout-status-chip-none')).toBeInTheDocument();
  });

  it('shows "Finish setup" for the onboarding state', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'onboarding', accountId: 'acct_1' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-onboarding')).toBeInTheDocument());
    expect(screen.getByTestId('payout-cta-button')).toHaveTextContent('Finish setup');
  });

  it('shows an active status for the enabled state', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'enabled', payoutsEnabled: true, accountId: 'acct_1' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-enabled')).toBeInTheDocument());
    expect(screen.getByText('Payouts active')).toBeInTheDocument();
  });

  it('shows an action-needed state for restricted', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'restricted', accountId: 'acct_1' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-restricted')).toBeInTheDocument());
    expect(screen.getByTestId('payout-cta-button')).toHaveTextContent('Resolve requirements');
  });

  it('treats a 404 (no business) as the none state, not an error', async () => {
    getPayoutStatus.mockRejectedValue({ response: { status: 404 } });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-none')).toBeInTheDocument());
    expect(screen.queryByTestId('payout-status-error')).not.toBeInTheDocument();
  });

  it('shows an error state when status fails (non-404)', async () => {
    getPayoutStatus.mockRejectedValue({ response: { status: 500 } });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-error')).toBeInTheDocument());
  });

  it('fetches an account session for EMBEDDED onboarding on CTA click (no redirect)', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'none' });
    createPayoutAccountSession.mockResolvedValue({
      clientSecret: 'acct_sess_secret',
      accountId: 'acct_1',
      publishableKey: 'pk_test_123',
    });
    // If it redirected instead of embedding, window.location.href would be set — assert it isn't.
    const hrefBefore = window.location.href;
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-cta-button')).toBeEnabled());

    fireEvent.click(screen.getByTestId('payout-cta-button'));

    // Behavioral contract: fetch an Account Session (embedded), not a redirect link.
    await waitFor(() => expect(createPayoutAccountSession).toHaveBeenCalledTimes(1));
    expect(window.location.href).toBe(hrefBefore);
  });

  it('scopes payout calls to the SELECTED business _id (switcher-aware, no guessing)', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'none' });
    createPayoutAccountSession.mockResolvedValue({
      clientSecret: 'acct_sess_secret',
      accountId: 'acct_1',
      publishableKey: 'pk_test_123',
    });
    render(<PayoutsSection />);

    // Status is fetched for the resolved business _id (Urban HTX), not a userId/guess.
    await waitFor(() => expect(getBusiness).toHaveBeenCalled());
    await waitFor(() => expect(getPayoutStatus).toHaveBeenCalledWith('b3acf234'));

    // Onboarding also passes the concrete business _id.
    await waitFor(() => expect(screen.getByTestId('payout-cta-button')).toBeEnabled());
    fireEvent.click(screen.getByTestId('payout-cta-button'));
    await waitFor(() => expect(createPayoutAccountSession).toHaveBeenCalledWith('b3acf234'));
  });

  it('does not render the fee (fee is admin-only, Req 10.6)', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'enabled', payoutsEnabled: true, platformFeePercent: 4, accountId: 'acct_1' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-enabled')).toBeInTheDocument());
    expect(screen.queryByText(/fee/i)).not.toBeInTheDocument();
    expect(screen.queryByText('4%')).not.toBeInTheDocument();
  });

  it('never exposes the raw Stripe account id in the UI', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'enabled', payoutsEnabled: true, accountId: 'acct_SECRET123' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-enabled')).toBeInTheDocument());
    // The raw acct_ id must not be surfaced anywhere in the rendered UI.
    expect(screen.queryByText(/acct_/i)).not.toBeInTheDocument();
  });

  it('shows connected bank details in the body when payouts are active', async () => {
    getPayoutStatus.mockResolvedValue({
      status: 'enabled',
      payoutsEnabled: true,
      accountId: 'acct_1',
      bankAccount: { bankName: 'STRIPE TEST BANK', last4: '6789', currency: 'usd' },
    });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-bank-details')).toBeInTheDocument());
    const details = screen.getByTestId('payout-bank-details');
    expect(details).toHaveTextContent('STRIPE TEST BANK');
    expect(details).toHaveTextContent('6789');
    // Never surface the raw account id.
    expect(details).not.toHaveTextContent('acct_');
  });

  // ── Organization-managed payouts (child business inherits the org's account) ──
  it('shows a read-only "managed by your organization" state for a child business', async () => {
    getPayoutStatus.mockResolvedValue({
      status: 'enabled',
      payoutsEnabled: true,
      accountId: 'acct_org',
      isChildInheriting: true,
      ownedByOrg: true,
      bankAccount: { bankName: 'ORG BANK', last4: '4321', currency: 'usd' },
    });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-org-managed')).toBeInTheDocument());
    // Org's bank summary is shown read-only.
    expect(screen.getByTestId('payout-bank-details')).toHaveTextContent('ORG BANK');
    expect(screen.getByTestId('payout-bank-details')).toHaveTextContent('4321');
    // No self-serve setup or reset for a child business.
    expect(screen.queryByTestId('payout-cta-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payout-reset-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('payout-org-managed-note')).toBeInTheDocument();
  });

  it('tells the ORGANIZATION owner that this banking covers all child businesses', async () => {
    getPayoutStatus.mockResolvedValue({
      status: 'none',
      ownedByOrg: true,
      isChildInheriting: false,
    });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-org-owner-banner')).toBeInTheDocument());
    expect(screen.getByTestId('payout-org-owner-banner')).toHaveTextContent(/all of its businesses/i);
    // Org owner still sets up/manages payouts.
    expect(screen.getByTestId('payout-cta-button')).toBeInTheDocument();
    expect(screen.getByTestId('payout-org-owner-note')).toBeInTheDocument();
  });

  it('does NOT show the org-owner banner for a standalone business', async () => {
    getPayoutStatus.mockResolvedValue({
      status: 'none',
      ownedByOrg: false,
      isChildInheriting: false,
    });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-cta-button')).toBeInTheDocument());
    expect(screen.queryByTestId('payout-org-owner-banner')).not.toBeInTheDocument();
  });

  it('still shows setup/reset for a business that owns its own payouts (not a child)', async () => {
    getPayoutStatus.mockResolvedValue({
      status: 'enabled',
      payoutsEnabled: true,
      accountId: 'acct_1',
      isChildInheriting: false,
      ownedByOrg: false,
      bankAccount: { bankName: 'STRIPE TEST BANK', last4: '6789', currency: 'usd' },
    });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-connect-prompt')).toBeInTheDocument());
    expect(screen.getByTestId('payout-cta-button')).toBeInTheDocument();
    expect(screen.getByTestId('payout-reset-button')).toBeInTheDocument();
    expect(screen.queryByTestId('payout-org-managed')).not.toBeInTheDocument();
  });

  it('does not show bank details before payouts are active', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'onboarding', accountId: 'acct_1' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-onboarding')).toBeInTheDocument());
    expect(screen.queryByTestId('payout-bank-details')).not.toBeInTheDocument();
  });

  // ── Payout history (journal-derived) ────────────────────────────────────────
  it('shows payout history summary + rows when payouts are active', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'enabled', payoutsEnabled: true, accountId: 'acct_1' });
    getPayoutHistory.mockResolvedValue({
      summary: { outstandingPayableCents: 12000, lifetimeEarnedCents: 15000, lifetimePaidOutCents: 3000, currency: 'usd' },
      rows: [
        { transactionId: 't2', type: 'SALE', eventId: 'ev2', organizerAmountCents: 5000, effectiveAt: '2026-09-05T00:00:00.000Z', currency: 'usd' },
        { transactionId: 't1', type: 'SALE', eventId: 'ev1', organizerAmountCents: 10000, effectiveAt: '2026-09-04T00:00:00.000Z', currency: 'usd' },
      ],
    });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-history')).toBeInTheDocument());
    // Outstanding payable shown as dollars.
    expect(screen.getByTestId('payout-outstanding')).toHaveTextContent('120.00');
    // One row per sale.
    const rows = screen.getAllByTestId('payout-history-row');
    expect(rows.length).toBe(2);
    expect(rows[0]).toHaveTextContent('50.00');
  });

  it('shows an empty-state when there is no payout history yet', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'enabled', payoutsEnabled: true, accountId: 'acct_1' });
    getPayoutHistory.mockResolvedValue({
      summary: { outstandingPayableCents: 0, lifetimeEarnedCents: 0, lifetimePaidOutCents: 0, currency: 'usd' },
      rows: [],
    });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-history-empty')).toBeInTheDocument());
    expect(screen.queryAllByTestId('payout-history-row').length).toBe(0);
  });

  it('does not fetch history before payouts are active', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'none' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-none')).toBeInTheDocument());
    expect(getPayoutHistory).not.toHaveBeenCalled();
    expect(screen.queryByTestId('payout-history')).not.toBeInTheDocument();
  });

  // ── Layout: status summary in its own (right) card, middle reserved for Connect ──
  it('renders the status summary in a dedicated card, separate from the Connect prompt', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'none' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-connect-prompt')).toBeInTheDocument());
    expect(screen.getByTestId('payout-status-card')).toBeInTheDocument();
    // The middle column holds the Connect content (prompt + CTA), NOT the status chip.
    const prompt = screen.getByTestId('payout-connect-prompt');
    expect(prompt).toContainElement(screen.getByTestId('payout-cta-button'));
    expect(prompt).not.toContainElement(screen.getByTestId('payout-status-chip-none'));
    // The status chip lives in the status card.
    expect(screen.getByTestId('payout-status-card')).toContainElement(
      screen.getByTestId('payout-status-chip-none')
    );
  });

  it('updates the status card to "in progress" as the user advances through onboarding', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'none' });
    createPayoutAccountSession.mockResolvedValue({
      clientSecret: 'acct_sess_secret',
      accountId: 'acct_1',
      publishableKey: 'pk_test_123',
    });
    render(<PayoutsSection />);

    // Starts as "not set up".
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-none')).toBeInTheDocument());

    // Enter onboarding, then advance a step.
    await waitFor(() => expect(screen.getByTestId('payout-cta-button')).toBeEnabled());
    fireEvent.click(screen.getByTestId('payout-cta-button'));
    await waitFor(() => expect(screen.getByTestId('mock-step-change')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('mock-step-change'));

    // The status card (left/right summary) now reflects in-progress, not "not set up".
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-onboarding')).toBeInTheDocument());
    expect(screen.queryByTestId('payout-status-chip-none')).not.toBeInTheDocument();
  });

  it('keeps the status card visible alongside the embedded onboarding (middle = Connect only)', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'onboarding', accountId: 'acct_1' });
    createPayoutAccountSession.mockResolvedValue({
      clientSecret: 'acct_sess_secret',
      accountId: 'acct_1',
      publishableKey: 'pk_test_123',
    });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-cta-button')).toBeEnabled());
    fireEvent.click(screen.getByTestId('payout-cta-button'));

    // Embedded onboarding mounts in the middle; status card stays on the right.
    await waitFor(() => expect(screen.getByTestId('payout-embedded-onboarding')).toBeInTheDocument());
    expect(screen.getByTestId('payout-status-card')).toBeInTheDocument();
  });

  // ── Reset payouts (start-over) ──────────────────────────────────────────────
  it('does NOT show the Reset button when payouts are not set up (none)', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'none' });
    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-status-chip-none')).toBeInTheDocument());
    expect(screen.queryByTestId('payout-reset-button')).not.toBeInTheDocument();
  });

  it('opens a styled confirmation dialog and resets the SELECTED business on confirm', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'enabled', payoutsEnabled: true, accountId: 'acct_1' });
    resetPayouts.mockResolvedValue({ reset: true, closedAccountId: 'acct_1' });

    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-reset-button')).toBeInTheDocument());

    // Clicking the button opens the dialog (does NOT reset immediately).
    fireEvent.click(screen.getByTestId('payout-reset-button'));
    await waitFor(() => expect(screen.getByTestId('payout-reset-dialog')).toBeInTheDocument());
    expect(resetPayouts).not.toHaveBeenCalled();

    // Confirming resets, scoped to the concrete business _id (no guessing).
    fireEvent.click(screen.getByTestId('payout-reset-confirm'));
    await waitFor(() => expect(resetPayouts).toHaveBeenCalledWith('b3acf234'));
    // Re-fetches status after reset.
    await waitFor(() => expect(getPayoutStatus).toHaveBeenCalledTimes(2));
  });

  it('does NOT reset when the confirmation dialog is cancelled', async () => {
    getPayoutStatus.mockResolvedValue({ status: 'enabled', payoutsEnabled: true, accountId: 'acct_1' });

    render(<PayoutsSection />);
    await waitFor(() => expect(screen.getByTestId('payout-reset-button')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('payout-reset-button'));
    await waitFor(() => expect(screen.getByTestId('payout-reset-dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('payout-reset-cancel'));
    expect(resetPayouts).not.toHaveBeenCalled();
  });
});
