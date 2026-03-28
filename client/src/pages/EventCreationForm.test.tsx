import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EventCreationForm from './EventCreationForm';

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

vi.mock('../components/Toaster', () => ({
  toast: {
    promise: vi.fn().mockImplementation(async (promise, { success, error }) => {
      try {
        const res = await promise;
        if (success) success(res);
      } catch (e) {
        const msg = typeof error === 'function' ? error(e) : error;
        const errorEl = document.createElement('div');
        errorEl.textContent = msg;
        document.body.appendChild(errorEl);
      }
      return promise;
    }),
  },
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <EventCreationForm />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clear any toast elements from previous tests
  document.body.innerHTML = '';
});

describe('EventCreationForm', () => {
  it('renders title and description inputs with a submit button', () => {
    renderForm();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create event & continue/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty fields', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /create event & continue/i }));

    expect(
      await screen.findByText(/event title must be at least 3 characters long/i)
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('navigates to event respond on successful creation', async () => {
    mockPost.mockResolvedValueOnce({ id: 'evt-123' });
    renderForm();

    await userEvent.type(screen.getByLabelText(/title/i), 'Game Night');
    await userEvent.type(screen.getByLabelText(/description/i), 'Board games at my place');
    await userEvent.click(screen.getByRole('button', { name: /create event & continue/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/evt-123/respond');
    });
    expect(mockPost).toHaveBeenCalledWith('/events', {
      title: 'Game Night',
      description: 'Board games at my place',
    });
  });

  it('displays generic error on server failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    renderForm();

    await userEvent.type(screen.getByLabelText(/title/i), 'Title');
    await userEvent.type(screen.getByLabelText(/description/i), 'Desc');
    await userEvent.click(screen.getByRole('button', { name: /create event & continue/i }));

    expect(
      await screen.findByText('Failed to create event. Please try again.')
    ).toBeInTheDocument();
  });

  it('clears field error when user starts typing', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: /create event & continue/i }));
    expect(
      await screen.findByText(/event title must be at least 3 characters long/i)
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/title/i), 'Valid Title');
    await waitFor(() => {
      expect(
        screen.queryByText(/event title must be at least 3 characters long/i)
      ).not.toBeInTheDocument();
    });
  });
});
