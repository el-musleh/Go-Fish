import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvitationLinkPanel from './InvitationLinkPanel';

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock('../api/client', () => ({
  api: {
    post: mockPost,
    get: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('InvitationLinkPanel', () => {
  it('renders generate button initially', () => {
    render(<InvitationLinkPanel eventId="evt-1" />);
    expect(screen.getByRole('button', { name: /generate link/i })).toBeInTheDocument();
  });

  it('generates and displays invitation link', async () => {
    mockPost.mockResolvedValueOnce({ token: 'abc123', link: '/api/invite/abc123' });
    render(<InvitationLinkPanel eventId="evt-1" />);

    await userEvent.click(screen.getByRole('button', { name: /generate link/i }));

    await waitFor(() => {
      const input = screen.getByLabelText(/invitation link/i) as HTMLInputElement;
      expect(input.value).toContain('/invite/abc123');
    });
    expect(mockPost).toHaveBeenCalledWith('/events/evt-1/link');
  });

  it('copies link to clipboard', async () => {
    mockPost.mockResolvedValueOnce({ token: 'abc123', link: '/api/invite/abc123' });
    render(<InvitationLinkPanel eventId="evt-1" />);

    await userEvent.click(screen.getByRole('button', { name: /generate link/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/invite/abc123')
      );
    });
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it('shows error on generation failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('fail'));
    render(<InvitationLinkPanel eventId="evt-1" />);

    await userEvent.click(screen.getByRole('button', { name: /generate link/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to generate link.')).toBeInTheDocument();
    });
  });
});
