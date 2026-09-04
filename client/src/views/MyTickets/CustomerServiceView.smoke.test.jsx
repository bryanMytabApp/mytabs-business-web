import { render, screen, fireEvent } from '@testing-library/react';
import CustomerServiceView from './CustomerServiceView';

// Smoke tests: the customer detail view renders real purchase data (not the
// old hardcoded "Sample Event" mock), lays out its sections as tabs, and does
// not crash in its default state.
jest.mock('../../services/receiptService', () => ({
  __esModule: true,
  default: { downloadReceipt: jest.fn(), emailReceipt: jest.fn() },
}));

jest.mock('../../services/ticketManagementService', () => ({
  __esModule: true,
  default: { cancelTicket: jest.fn(), updateCustomerDetails: jest.fn(), resendTicket: jest.fn() },
}));

const purchase = {
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  confirmationNumber: 'TKT-001',
  totalAmount: '25.00',
  paymentMethod: 'Card',
  purchaseDate: 'Sep 1, 2026',
  timeAgo: '3 days ago',
  ticketDetails: '1x GA',
  status: 'active',
  eventName: '3rd Ward Back To School Drive',
  raw: { eventId: 'ev1', eventName: '3rd Ward Back To School Drive' },
};

describe('CustomerServiceView — smoke', () => {
  it('renders the default Customer tab with real customer data', () => {
    render(<CustomerServiceView purchase={purchase} onBack={() => {}} />);
    // Email appears in the header and the customer tab body.
    expect(screen.getAllByText(/ada@example.com/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/#TKT-001/)).toBeInTheDocument();
    // The old mock placeholder must be gone.
    expect(screen.queryByText(/Sample Event/)).not.toBeInTheDocument();
  });

  it('renders the tab navigation with all sections and no Actions tab', () => {
    render(<CustomerServiceView purchase={purchase} onBack={() => {}} />);
    ['Customer', 'Purchase', 'History', 'Notes'].forEach((label) => {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    });
    // Actions are a persistent rail now, not a tab.
    expect(screen.queryByRole('tab', { name: /Actions/ })).not.toBeInTheDocument();
  });

  it('shows the action rail buttons persistently (not behind a tab)', () => {
    render(<CustomerServiceView purchase={purchase} onBack={() => {}} />);
    // Visible on the default tab without any navigation.
    expect(screen.getByText(/Resend Tickets/)).toBeInTheDocument();
    expect(screen.getByText(/Cancel \(w\/ Refund\)/)).toBeInTheDocument();
  });

  it('shows the real event name and status on the Purchase tab', () => {
    render(<CustomerServiceView purchase={purchase} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /Purchase/ }));
    expect(screen.getByText(/3rd Ward Back To School Drive/)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('renders a cancelled purchase status variant without crashing', () => {
    render(
      <CustomerServiceView
        purchase={{ ...purchase, status: 'cancelled' }}
        onBack={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /Purchase/ }));
    expect(screen.getAllByText(/cancelled/i).length).toBeGreaterThan(0);
  });
});
