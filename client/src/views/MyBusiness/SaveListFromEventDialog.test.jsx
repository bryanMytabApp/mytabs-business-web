import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SaveListFromEventDialog from './SaveListFromEventDialog';
import { createSavedList } from '../../services/savedListService';
import { toast } from 'react-toastify';

jest.mock('../../services/savedListService');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockMembers = [
  { name: 'Alice Smith', email: 'alice@example.com' },
  { memberName: 'Bob Jones', email: 'bob@example.com' },
];

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  businessId: 'biz-123',
  members: mockMembers,
};

describe('SaveListFromEventDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog with list name input when open', () => {
    render(<SaveListFromEventDialog {...defaultProps} />);
    expect(screen.getByText('Save as List')).toBeInTheDocument();
    expect(screen.getByLabelText('List Name')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    const { container } = render(<SaveListFromEventDialog {...defaultProps} open={false} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('shows validation error when name is empty', () => {
    render(<SaveListFromEventDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('List name is required')).toBeInTheDocument();
  });

  it('shows validation error for invalid characters', () => {
    render(<SaveListFromEventDialog {...defaultProps} />);
    const input = screen.getByLabelText('List Name');
    fireEvent.change(input, { target: { value: 'Invalid@Name!' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('List name can only contain letters, numbers, spaces, hyphens, and underscores')).toBeInTheDocument();
  });

  it('shows validation error when name exceeds 100 characters', () => {
    render(<SaveListFromEventDialog {...defaultProps} />);
    const input = screen.getByLabelText('List Name');
    fireEvent.change(input, { target: { value: 'A'.repeat(101) } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('List name must be 100 characters or fewer')).toBeInTheDocument();
  });

  it('calls createSavedList with correct payload on valid submit', async () => {
    createSavedList.mockResolvedValue({ status: 201, data: {} });
    render(<SaveListFromEventDialog {...defaultProps} />);

    const input = screen.getByLabelText('List Name');
    fireEvent.change(input, { target: { value: 'VIP Guests' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(createSavedList).toHaveBeenCalledWith('biz-123', {
        name: 'VIP Guests',
        members: [
          { name: 'Alice Smith', email: 'alice@example.com' },
          { name: 'Bob Jones', email: 'bob@example.com' },
        ],
      });
    });
  });

  it('shows success toast and closes on successful save', async () => {
    createSavedList.mockResolvedValue({ status: 201, data: {} });
    render(<SaveListFromEventDialog {...defaultProps} />);

    const input = screen.getByLabelText('List Name');
    fireEvent.change(input, { target: { value: 'VIP Guests' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('List "VIP Guests" saved with 2 members');
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows duplicate name error on 409 response', async () => {
    createSavedList.mockRejectedValue({ response: { status: 409 } });
    render(<SaveListFromEventDialog {...defaultProps} />);

    const input = screen.getByLabelText('List Name');
    fireEvent.change(input, { target: { value: 'Existing List' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('A list with this name already exists')).toBeInTheDocument();
    });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('shows generic error on server/network failure and preserves input', async () => {
    createSavedList.mockRejectedValue({ response: { status: 500 } });
    render(<SaveListFromEventDialog {...defaultProps} />);

    const input = screen.getByLabelText('List Name');
    fireEvent.change(input, { target: { value: 'My List' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
    expect(input.value).toBe('My List');
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('shows loading spinner during save', async () => {
    createSavedList.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SaveListFromEventDialog {...defaultProps} />);

    const input = screen.getByLabelText('List Name');
    fireEvent.change(input, { target: { value: 'Test List' } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<SaveListFromEventDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('clears error on input change', () => {
    render(<SaveListFromEventDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('List name is required')).toBeInTheDocument();

    const input = screen.getByLabelText('List Name');
    fireEvent.change(input, { target: { value: 'A' } });
    expect(screen.queryByText('List name is required')).not.toBeInTheDocument();
  });
});
