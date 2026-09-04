import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TicketEventCard } from './MyTicketsView';
import { getEventPayouts } from '../../services/paymentService';
import { getTicketsByEvent } from '../../services/ticketManagementService';

// Smoke test for the payout-details section on the Ticket Management event card.
jest.mock('../../services/paymentService', () => ({
  getEventPayouts: jest.fn(),
}));

// The card now also lazily loads the per-buyer list on expand; mock it so these
// payout-focused tests don't hit the network.
jest.mock('../../services/ticketManagementService', () => ({
  getTicketsByEvent: jest.fn(),
}));

beforeEach(() => getTicketsByEvent.mockResolvedValue({ tickets: [], stats: {} }));

const event = {
  _id: 'ev1',
  name: '3rd Ward Back To School Drive',
  startDate: '2026-09-04',
  tickets: [{ type: 'GA', price: 25, sold: 4, quantity: 100 }],
};

beforeEach(() => jest.clearAllMocks());

describe('TicketEventCard — payout details', () => {
  it('does not fetch payouts until the card is expanded', () => {
    render(<TicketEventCard event={event} index={0} />);
    expect(getEventPayouts).not.toHaveBeenCalled();
    expect(screen.queryByTestId('event-payout-details')).not.toBeInTheDocument();
  });

  it('loads and shows payout details for the event when expanded', async () => {
    getEventPayouts.mockResolvedValue({
      eventId: 'ev1',
      summary: { outstandingPayableCents: 9600, lifetimeEarnedCents: 9600, lifetimePaidOutCents: 0, currency: 'usd' },
      rows: [
        { transactionId: 't1', type: 'SALE', eventId: 'ev1', organizerAmountCents: 9600, effectiveAt: '2026-09-04T00:00:00.000Z', currency: 'usd' },
      ],
    });
    render(<TicketEventCard event={event} index={0} />);

    // Expand by clicking the card row (the event name is inside it).
    fireEvent.click(screen.getByText('3rd Ward Back To School Drive'));

    await waitFor(() => expect(getEventPayouts).toHaveBeenCalledWith('ev1'));
    await waitFor(() => expect(screen.getByTestId('event-payout-details')).toBeInTheDocument());
    expect(screen.getByTestId('event-payout-outstanding')).toHaveTextContent('96.00');
    expect(screen.getAllByTestId('event-payout-row').length).toBe(1);
  });

  it('shows an empty state when the event has no payouts', async () => {
    getEventPayouts.mockResolvedValue({ eventId: 'ev1', summary: { outstandingPayableCents: 0, lifetimeEarnedCents: 0, lifetimePaidOutCents: 0, currency: 'usd' }, rows: [] });
    render(<TicketEventCard event={event} index={0} />);
    fireEvent.click(screen.getByText('3rd Ward Back To School Drive'));
    await waitFor(() => expect(screen.getByTestId('event-payout-empty')).toBeInTheDocument());
  });
});
