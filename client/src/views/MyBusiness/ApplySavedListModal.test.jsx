import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ApplySavedListModal from './ApplySavedListModal';
import { getSavedLists, applySavedListToEvent } from '../../services/savedListService';

jest.mock('../../services/savedListService');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const mockLists = [
  { listId: 'list-1', listName: 'VIP Guests', memberCount: 3, updatedAt: 1700000000000 },
  { listId: 'list-2', listName: 'Staff', memberCount: 5, updatedAt: 1700100000000 },
];

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  businessId: 'biz-123',
  eventId: 'event-456',
  onApplySuccess: jest.fn(),
};

describe('ApplySavedListModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when fetching lists', () => {
    getSavedLists.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ApplySavedListModal {...defaultProps} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Loading saved lists...')).toBeInTheDocument();
  });

  it('renders list of saved lists', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    render(<ApplySavedListModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('3 members')).toBeInTheDocument();
    expect(screen.getByText('5 members')).toBeInTheDocument();
  });

  it('renders empty state when no saved lists exist', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: [] } });
    render(<ApplySavedListModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No saved lists available.')).toBeInTheDocument();
    });
  });

  it('shows confirmation step when a list is selected', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    render(<ApplySavedListModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('VIP Guests'));

    expect(screen.getByText('VIP Guests', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/to this event/)).toBeInTheDocument();
    expect(screen.getByText('Apply List')).toBeInTheDocument();
  });

  it('shows progress indicator during apply', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    applySavedListToEvent.mockReturnValue(new Promise(() => {})); // never resolves

    render(<ApplySavedListModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('VIP Guests'));
    fireEvent.click(screen.getByText('Apply List'));

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/Applying.*VIP Guests/)).toBeInTheDocument();
  });

  it('shows success summary on 200 response', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    applySavedListToEvent.mockResolvedValue({
      status: 200,
      data: { added: 2, skipped: 1, failed: 0, total: 3 },
    });

    render(<ApplySavedListModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('VIP Guests'));
    fireEvent.click(screen.getByText('Apply List'));

    await waitFor(() => {
      expect(screen.getByText('List applied successfully!')).toBeInTheDocument();
    });
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows partial failure with retry on 207 response', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    applySavedListToEvent.mockResolvedValue({
      status: 207,
      data: { added: 1, skipped: 0, failed: 2, total: 3 },
    });

    render(<ApplySavedListModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('VIP Guests'));
    fireEvent.click(screen.getByText('Apply List'));

    await waitFor(() => {
      expect(screen.getByText('Some members could not be added.')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows error message on complete failure', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    applySavedListToEvent.mockRejectedValue({
      response: { status: 500, data: { error: 'Internal server error' } },
    });

    render(<ApplySavedListModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('VIP Guests'));
    fireEvent.click(screen.getByText('Apply List'));

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    render(<ApplySavedListModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not render when open is false', () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    const { container } = render(<ApplySavedListModal {...defaultProps} open={false} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });
});
