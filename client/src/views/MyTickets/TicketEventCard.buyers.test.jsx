import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TicketEventCard, ticketToPurchase } from './MyTicketsView';
import { getEventPayouts } from '../../services/paymentService';
import { getTicketsByEvent } from '../../services/ticketManagementService';

// Smoke tests for the per-event buyers/customers list on the Ticket Management
// event card and the buyer -> customer detail drill-in.
jest.mock('../../services/paymentService', () => ({
  getEventPayouts: jest.fn(),
}));

jest.mock('../../services/ticketManagementService', () => ({
  getTicketsByEvent: jest.fn(),
}));

const event = {
  _id: 'ev1',
  name: '3rd Ward Back To School Drive',
  startDate: '2026-09-04',
  tickets: [{ type: 'GA', price: 25, sold: 2, quantity: 100 }],
};

const ticketRows = [
  {
    _id: 'row1',
    ticketId: 'TKT-001',
    eventId: 'ev1',
    ticketType: 'GA',
    buyerName: 'Ada Lovelace',
    buyerEmail: 'ada@example.com',
    price: 25,
    status: 'active',
    purchasedAt: '2026-09-01T12:00:00.000Z',
  },
  {
    _id: 'row2',
    ticketId: 'TKT-002',
    eventId: 'ev1',
    ticketType: 'GA',
    buyerName: 'Alan Turing',
    buyerEmail: 'alan@example.com',
    price: 25,
    status: 'cancelled',
    purchasedAt: '2026-09-02T12:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  getEventPayouts.mockResolvedValue({ eventId: 'ev1', summary: null, rows: [] });
});

describe('ticketToPurchase', () => {
  it('maps a checkout-style ticket row to the purchase shape', () => {
    const p = ticketToPurchase(ticketRows[0]);
    expect(p.customerName).toBe('Ada Lovelace');
    expect(p.customerEmail).toBe('ada@example.com');
    expect(p.confirmationNumber).toBe('TKT-001');
    expect(p.totalAmount).toBe('25.00');
    expect(p.ticketDetails).toContain('GA');
    expect(p.raw).toBe(ticketRows[0]);
  });

  it('falls back to customerName/customerEmail and Guest for direct-payment rows', () => {
    const p = ticketToPurchase({ customerName: 'Grace', customerEmail: 'grace@example.com', ticketId: 'x' });
    expect(p.customerName).toBe('Grace');
    expect(p.customerEmail).toBe('grace@example.com');
    const g = ticketToPurchase({ ticketId: 'y' });
    expect(g.customerName).toBe('Guest');
  });
});

describe('TicketEventCard — buyers list', () => {
  it('renders in its default (collapsed) state without fetching buyers', () => {
    getTicketsByEvent.mockResolvedValue({ tickets: [], stats: {} });
    render(<TicketEventCard event={event} index={0} />);
    expect(getTicketsByEvent).not.toHaveBeenCalled();
    expect(screen.queryByTestId('event-buyers')).not.toBeInTheDocument();
  });

  it('loads the buyer list on expand and shows customers behind a toggle', async () => {
    getTicketsByEvent.mockResolvedValue({ tickets: ticketRows, stats: { ticketTypes: [{ type: 'GA', price: 25, sold: 2 }] } });
    render(<TicketEventCard event={event} index={0} />);

    fireEvent.click(screen.getByText('3rd Ward Back To School Drive'));

    await waitFor(() => expect(getTicketsByEvent).toHaveBeenCalledWith('ev1'));
    // Buyer count is visible; individual rows are behind the "View buyers" toggle.
    await waitFor(() => expect(screen.getByText('View buyers')).toBeInTheDocument());
    expect(screen.queryByTestId('event-buyer-row')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('View buyers'));
    await waitFor(() => expect(screen.getAllByTestId('event-buyer-row').length).toBe(2));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('alan@example.com')).toBeInTheDocument();
  });

  it('shows an empty state when the event has no ticket buyers', async () => {
    getTicketsByEvent.mockResolvedValue({ tickets: [], stats: {} });
    render(<TicketEventCard event={event} index={0} />);
    fireEvent.click(screen.getByText('3rd Ward Back To School Drive'));
    await waitFor(() => expect(screen.getByTestId('event-buyers-empty')).toBeInTheDocument());
  });

  it('invokes onSelectPurchase with the mapped purchase when a buyer row is clicked', async () => {
    getTicketsByEvent.mockResolvedValue({ tickets: ticketRows, stats: {} });
    const onSelectPurchase = jest.fn();
    render(<TicketEventCard event={event} index={0} onSelectPurchase={onSelectPurchase} />);

    fireEvent.click(screen.getByText('3rd Ward Back To School Drive'));
    // Wait for the lazy buyer fetch to resolve (the toggle only appears once
    // buyers are loaded).
    await waitFor(() => expect(screen.getByText('View buyers')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View buyers'));
    await waitFor(() => expect(screen.getAllByTestId('event-buyer-row').length).toBe(2));

    fireEvent.click(screen.getByText('Ada Lovelace'));
    expect(onSelectPurchase).toHaveBeenCalledTimes(1);
    expect(onSelectPurchase.mock.calls[0][0]).toMatchObject({
      customerName: 'Ada Lovelace',
      confirmationNumber: 'TKT-001',
    });
  });
});
