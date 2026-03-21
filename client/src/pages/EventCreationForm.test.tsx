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

function renderForm() {
  return render(
    <MemoryRouter>
      <EventCreationForm />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EventCreationForm', () => {
  it('renders title and description inputs with a submit button', () => {
    renderForm();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create event/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty fields', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /create event/i }));

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows title error when only description is filled', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/description/i), 'Some description');
    await userEvent.click(screen.getByRole('button', { name: /create event/i }));

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.queryByText('Description is required')).not.toBeInTheDocument();
  });

  it('navigates to event detail on successful creation', async () => {
    mockPost.mockResolvedValueOnce({ id: 'evt-123' });
    renderForm();

    await userEvent.type(screen.getByLabelText(/title/i), 'Game Night');
    await userEvent.type(screen.getByLabelText(/description/i), 'Board games at my place');
    await userEvent.click(screen.getByRole('button', { name: /create event/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/evt-123');
    });
    expect(mockPost).toHaveBeenCalledWith('/events', {
      title: 'Game Night',
      description: 'Board games at my place',
    });
  });

  it('displays server field errors from API', async () => {
    mockPost.mockRejectedValueOnce(
      new MockApiError(400, { error: 'missing_fields', fields: ['title'] }),
    );
    renderForm();

    // Type only description, leave title empty to trigger client-side validation
    await userEvent.type(screen.getByLabelText(/description/i), 'desc');
    await userEvent.click(screen.getByRole('button', { name: /create event/i }));

    expect(screen.getByText('Title is required')).toBeInTheDocument();
  });

  it('displays generic error on server failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    renderForm();

    await userEvent.type(screen.getByLabelText(/title/i), 'Title');
    await userEvent.type(screen.getByLabelText(/description/i), 'Desc');
    await userEvent.click(screen.getByRole('button', { name: /create event/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to create event. Please try again.')).toBeInTheDocument();
    });
  });

  it('clears field error when user starts typing', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /create event/i }));
    expect(screen.getByText('Title is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/title/i), 'A');
    expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
  });
});
