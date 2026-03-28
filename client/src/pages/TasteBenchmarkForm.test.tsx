import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TasteBenchmarkForm from './TasteBenchmarkForm';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
  };
});

const { MockApiError, mockPost, mockGet } = vi.hoisted(() => {
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
  return { MockApiError, mockPost: vi.fn(), mockGet: vi.fn() };
});

vi.mock('../api/client', () => ({
  ApiError: MockApiError,
  api: {
    post: mockPost,
    get: mockGet,
  },
}));

vi.mock('../components/Toaster', () => ({
  toast: {
    promise: vi.fn().mockImplementation(async (promise, { success, error }) => {
      try {
        const res = await promise;
        if (success) success(res);
      } catch (e) {
        if (error) {
          const msg = typeof error === 'function' ? error(e) : error;
          const errorEl = document.createElement('div');
          errorEl.textContent = msg;
          document.body.appendChild(errorEl);
        }
      }
      return promise;
    }),
  },
}));

function renderForm(route = '/benchmark') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TasteBenchmarkForm />
    </MemoryRouter>
  );
}

async function answerAllQuestions(user: ReturnType<typeof userEvent.setup>) {
  // Questions are q1 to q10. We just need to click one chip for each.
  const options = [
    'Hiking',
    'Board games',
    'Italian',
    'Basketball',
    'Painting',
    'Small groups',
    'Live music',
    'Rock climbing',
    'Yoga',
    'Workshops',
  ];
  for (const opt of options) {
    const chip = screen.getByRole('button', { name: new RegExp(opt, 'i') });
    await user.click(chip);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockRejectedValue(new Error('404')); // Default to no benchmark
});

describe('TasteBenchmarkForm', () => {
  it('renders 10 questions', async () => {
    renderForm();
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/What outdoor activities do you enjoy/i)).toBeInTheDocument();
    expect(screen.getByText(/What learning activities appeal to you/i)).toBeInTheDocument();
  });

  it('shows validation errors for unanswered questions on submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /submit preferences/i }));

    const alerts = await screen.findAllByText(/please select at least one option/i);
    expect(alerts.length).toBe(10);
  });

  it('submits successfully and navigates to dashboard', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({});
    renderForm();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await answerAllQuestions(user);
    await user.click(screen.getByRole('button', { name: /submit preferences/i }));

    expect(mockPost).toHaveBeenCalledWith('/taste-benchmark', {
      answers: expect.objectContaining({ q1: ['Hiking'], q10: ['Workshops'] }),
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('loads existing benchmark and shows Update Preferences', async () => {
    mockGet.mockResolvedValueOnce({
      answers: { q1: ['Hiking'], q2: ['Cooking'] },
    });
    renderForm();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Update Preferences').length).toBeGreaterThan(0);
    const hikingChip = screen.getByRole('button', { name: /hiking/i });
    expect(hikingChip.getAttribute('aria-pressed')).toBe('true');
  });
});
