import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssignPlanDialog from './AssignPlanDialog';
import {
  getPlanAssignment,
  assignPlanToCustomer,
  clearPlanAssignment,
} from '../../services/paymentService';

jest.mock('../../services/paymentService', () => ({
  getPlanAssignment: jest.fn(),
  assignPlanToCustomer: jest.fn(),
  clearPlanAssignment: jest.fn(),
}));

// Deterministic pricing-version list for the dropdown.
jest.mock('../../config/pricingVersions', () => ({
  pricingVersions: [
    { effectiveDate: '2000-01-01', expiryDate: '2026-09-06' },
    { effectiveDate: '2026-09-06', expiryDate: '9999-12-31' },
  ],
}));

// Admin grid row: ownerUserId = the account owner (assignment key), businessId =
// the row's business (backend resolves the account businessId from it).
const business = {
  ownerUserId: 'user-123',
  userId: 'user-123',
  businessId: 'biz-123',
  name: 'Red Rooster',
};

describe('AssignPlanDialog (pricing version)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPlanAssignment.mockResolvedValue({ assignment: null });
  });

  it('renders with the customer name and a pricing-version selector when open', async () => {
    render(<AssignPlanDialog open business={business} onClose={jest.fn()} />);
    expect(screen.getByTestId('assign-plan-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Red Rooster/)).toBeInTheDocument();
    expect(screen.getByTestId('version-select')).toBeInTheDocument();
    // The "also allow update" toggle is present and on by default.
    expect(screen.getByTestId('allow-update-toggle')).toBeInTheDocument();
    await waitFor(() => expect(getPlanAssignment).toHaveBeenCalledWith('user-123'));
  });

  it('does not render dialog content when closed', () => {
    render(<AssignPlanDialog open={false} business={business} onClose={jest.fn()} />);
    expect(screen.queryByTestId('assign-plan-dialog')).not.toBeInTheDocument();
  });

  it('warns and disables assign when the row has no account owner', async () => {
    render(<AssignPlanDialog open business={{ name: 'No Owner Row' }} onClose={jest.fn()} />);
    expect(await screen.findByText(/no account owner/i)).toBeInTheDocument();
    expect(screen.getByTestId('assign-plan-submit')).toBeDisabled();
  });

  it('shows an existing pricing assignment when one is returned', async () => {
    getPlanAssignment.mockResolvedValue({
      assignment: {
        pricingEffectiveDate: '2000-01-01',
        allowUpdate: true,
        expiresAt: '2999-01-01T00:00:00.000Z',
      },
    });
    render(<AssignPlanDialog open business={business} onClose={jest.fn()} />);
    const existing = await screen.findByTestId('existing-assignment');
    expect(existing).toHaveTextContent('Legacy pricing');
    expect(existing).toHaveTextContent('can update');
  });

  it('assigns the selected pricing version with allowUpdate and shows success', async () => {
    assignPlanToCustomer.mockResolvedValue({
      assignment: { pricingEffectiveDate: '2000-01-01', allowUpdate: true, expiresAt: '2999-01-01T00:00:00.000Z' },
    });
    render(<AssignPlanDialog open business={business} onClose={jest.fn()} />);

    // Select the Legacy version via the MUI select.
    const combobox = await screen.findByRole('combobox', { name: /pricing version/i });
    fireEvent.mouseDown(combobox);
    const option = await screen.findByRole('option', { name: /Legacy pricing/i });
    fireEvent.click(option);

    await waitFor(() => expect(screen.getByTestId('assign-plan-submit')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('assign-plan-submit'));

    await waitFor(() =>
      expect(assignPlanToCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          businessId: 'biz-123',
          pricingEffectiveDate: '2000-01-01',
          allowUpdate: true,
        })
      )
    );
    expect(await screen.findByText(/Pricing assigned/i)).toBeInTheDocument();
  });

  it('passes allowUpdate=false when the toggle is turned off', async () => {
    assignPlanToCustomer.mockResolvedValue({
      assignment: { pricingEffectiveDate: '2000-01-01', allowUpdate: false, expiresAt: '2999-01-01T00:00:00.000Z' },
    });
    render(<AssignPlanDialog open business={business} onClose={jest.fn()} />);

    const combobox = await screen.findByRole('combobox', { name: /pricing version/i });
    fireEvent.mouseDown(combobox);
    fireEvent.click(await screen.findByRole('option', { name: /Legacy pricing/i }));

    // Turn the "also allow update" toggle off (MUI Switch exposes a checkbox role).
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(screen.getByTestId('assign-plan-submit')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('assign-plan-submit'));

    await waitFor(() =>
      expect(assignPlanToCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ pricingEffectiveDate: '2000-01-01', allowUpdate: false })
      )
    );
  });

  it('clears an existing assignment', async () => {
    getPlanAssignment.mockResolvedValue({
      assignment: { pricingEffectiveDate: '2000-01-01', allowUpdate: true, expiresAt: '2999-01-01T00:00:00.000Z' },
    });
    clearPlanAssignment.mockResolvedValue({ cleared: true });
    render(<AssignPlanDialog open business={business} onClose={jest.fn()} />);

    await screen.findByTestId('existing-assignment');
    fireEvent.click(screen.getByTestId('clear-assignment'));

    await waitFor(() => expect(clearPlanAssignment).toHaveBeenCalledWith('user-123'));
    expect(await screen.findByText(/Assignment cleared/i)).toBeInTheDocument();
  });
});
