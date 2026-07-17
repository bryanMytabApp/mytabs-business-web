import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MemberListsTab from './MemberListsTab';
import { getSavedLists, getSavedList } from '../../services/savedListService';

jest.mock('../../services/savedListService');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const mockLists = [
  { listId: 'list-1', listName: 'VIP Guests', memberCount: 3, updatedAt: 1700000000000 },
  { listId: 'list-2', listName: 'Staff', memberCount: 5, updatedAt: 1700100000000 },
];

const mockMembers = [
  { memberName: 'Charlie', email: 'charlie@example.com' },
  { memberName: 'Alice', email: 'alice@example.com' },
  { memberName: 'Bob', email: 'bob@example.com' },
];

describe('MemberListsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    getSavedLists.mockReturnValue(new Promise(() => {})); // never resolves
    render(<MemberListsTab selectedBusinessId="biz-123" userRole="owner" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Loading member lists...')).toBeInTheDocument();
  });

  it('renders saved lists when data loads', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    render(<MemberListsTab selectedBusinessId="biz-123" userRole="owner" />);

    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });
    expect(screen.getByText('Staff')).toBeInTheDocument();
  });

  it('renders empty state when no lists exist', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: [] } });
    render(<MemberListsTab selectedBusinessId="biz-123" userRole="owner" />);

    await waitFor(() => {
      expect(screen.getByText('No saved member lists yet.')).toBeInTheDocument();
    });
  });

  it('renders expanded view with members sorted alphabetically', async () => {
    getSavedLists.mockResolvedValue({ data: { lists: mockLists } });
    getSavedList.mockResolvedValue({ data: { members: mockMembers } });

    render(<MemberListsTab selectedBusinessId="biz-123" userRole="owner" />);

    // Wait for lists to load
    await waitFor(() => {
      expect(screen.getByText('VIP Guests')).toBeInTheDocument();
    });

    // Click on the first list to expand it
    fireEvent.click(screen.getByText('VIP Guests'));

    // Wait for members to load and verify they appear sorted alphabetically
    await waitFor(() => {
      expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('bob@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('charlie@example.com').length).toBeGreaterThan(0);

    // Verify alphabetical order by checking DOM order of member names
    const memberNames = screen.getAllByText(/^(Alice|Bob|Charlie)$/);
    expect(memberNames[0]).toHaveTextContent('Alice');
    expect(memberNames[1]).toHaveTextContent('Bob');
    expect(memberNames[2]).toHaveTextContent('Charlie');
  });
});
