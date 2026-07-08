import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsCard from './SettingsCard';
import { toast } from 'react-toastify';

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SettingsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<SettingsCard title="Personal Info">Content</SettingsCard>);
    expect(screen.getByText('Personal Info')).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(
      <SettingsCard title="Personal Info" subtitle="Update your details">
        Content
      </SettingsCard>
    );
    expect(screen.getByText('Update your details')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <SettingsCard title="Test">
        <p>Child content here</p>
      </SettingsCard>
    );
    expect(screen.getByText('Child content here')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading is true', () => {
    render(<SettingsCard title="Test" loading>Content</SettingsCard>);
    expect(screen.getByTestId('settings-card-loading')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows dirty indicator dot when dirty is true', () => {
    render(
      <SettingsCard title="Test" dirty>
        Content
      </SettingsCard>
    );
    expect(screen.getByTestId('dirty-indicator')).toBeInTheDocument();
  });

  it('does not show dirty indicator when dirty is false', () => {
    render(<SettingsCard title="Test">Content</SettingsCard>);
    expect(screen.queryByTestId('dirty-indicator')).not.toBeInTheDocument();
  });

  it('renders Save/Cancel footer when onSave is provided and dirty is true', () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    render(
      <SettingsCard title="Test" onSave={onSave} onCancel={onCancel} dirty>
        Content
      </SettingsCard>
    );
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not render footer when onSave is not provided', () => {
    render(<SettingsCard title="Test">Content</SettingsCard>);
    expect(screen.queryByTestId('settings-card-footer')).not.toBeInTheDocument();
  });

  it('calls onSave and shows success toast on successful save', async () => {
    const onSave = jest.fn().mockResolvedValue();
    render(
      <SettingsCard title="Test" onSave={onSave} dirty>
        Content
      </SettingsCard>
    );

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Changes saved successfully');
    });
  });

  it('shows inline error with retry on save failure', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Network error'));
    render(
      <SettingsCard title="Test" onSave={onSave} dirty>
        Content
      </SettingsCard>
    );

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-card-error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries save when Retry button is clicked', async () => {
    const onSave = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce();

    render(
      <SettingsCard title="Test" onSave={onSave} dirty>
        Content
      </SettingsCard>
    );

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('Changes saved successfully');
    });
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    render(
      <SettingsCard title="Test" onSave={onSave} onCancel={onCancel} dirty>
        Content
      </SettingsCard>
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  describe('collapsible behavior', () => {
    it('shows content by default when defaultExpanded is true', () => {
      render(
        <SettingsCard title="Test" collapsible defaultExpanded>
          <p>Visible content</p>
        </SettingsCard>
      );
      expect(screen.getByText('Visible content')).toBeVisible();
    });

    it('hides content when collapsed', () => {
      render(
        <SettingsCard title="Test" collapsible defaultExpanded={false}>
          <p>Hidden content</p>
        </SettingsCard>
      );
      // MUI Collapse hides content when in=false
      const content = screen.getByTestId('settings-card-content');
      expect(content.closest('.MuiCollapse-hidden')).toBeInTheDocument();
    });

    it('toggles expanded state on header click', () => {
      render(
        <SettingsCard title="Test" collapsible defaultExpanded>
          <p>Toggle content</p>
        </SettingsCard>
      );

      const header = screen.getByTestId('settings-card-header');
      expect(header).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(header);

      expect(header).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not collapse when collapsible is false', () => {
      render(
        <SettingsCard title="Test" collapsible={false}>
          <p>Always visible</p>
        </SettingsCard>
      );

      const header = screen.getByTestId('settings-card-header');
      fireEvent.click(header);

      expect(screen.getByText('Always visible')).toBeVisible();
    });
  });
});
