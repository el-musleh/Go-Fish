import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from './AuthPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const { MockApiError, mockPost } = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super(`API error ${status}`);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  }
  return { MockApiError, mockPost: vi.fn() };
});

vi.mock('../api/client', () => ({
  ApiError: MockApiError,
  api: {
    post: mockPost,
    get: vi.fn(),
  },
}));

function renderAuth(route = '/login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthPage', () => {
  it('renders Google sign-in button and email form', () => {
    renderAuth();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeInTheDocument();
  });

  it('navigates to /events/new on successful Google login', async () => {
    mockPost.mockResolvedValueOnce({});
    renderAuth();

    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/new');
    });
    expect(mockPost).toHaveBeenCalledWith('/auth/google');
  });

  it('navigates to returnTo URL on successful Google login', async () => {
    mockPost.mockResolvedValueOnce({});
    renderAuth('/login?returnTo=/events/abc/respond');

    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/abc/respond');
    });
  });

  it('displays error on Google login failure', async () => {
    mockPost.mockRejectedValueOnce(
      new MockApiError(401, { message: 'Google authentication was denied' }),
    );
    renderAuth();

    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Google authentication was denied');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('submits email and navigates on success', async () => {
    mockPost.mockResolvedValueOnce({});
    renderAuth();

    await userEvent.type(screen.getByPlaceholderText(/email address/i), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: /continue with email/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/new');
    });
    expect(mockPost).toHaveBeenCalledWith('/auth/email', { email: 'user@example.com' });
  });

  it('displays error on email login failure', async () => {
    mockPost.mockRejectedValueOnce(
      new MockApiError(401, { message: 'Email verification failed. Please try again.' }),
    );
    renderAuth();

    await userEvent.type(screen.getByPlaceholderText(/email address/i), 'bad@example.com');
    await userEvent.click(screen.getByRole('button', { name: /continue with email/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email verification failed');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows fallback error for non-API errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    renderAuth();

    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Google authentication failed. Please try again.',
      );
    });
  });
});
