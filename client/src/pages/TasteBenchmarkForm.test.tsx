import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TasteBenchmarkForm from './TasteBenchmarkForm';

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
  api: { post: mockPost, get: vi.fn() },
}));

function renderForm(route = '/benchmark') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TasteBenchmarkForm />
    </MemoryRouter>,
  );
}

/** Select one option per question by clicking the first checkbox in each fieldset */
async function answerAllQuestions(user: ReturnType<typeof userEvent.setup>) {
  const fieldsets = screen.getAllByRole('group');
  for (const fs of fieldsets) {
    const checkbox = within(fs).getAllByRole('checkbox')[0];
    await user.click(checkbox);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TasteBenchmarkForm', () => {
  it('renders 10 questions with checkboxes', () => {
    renderForm();
    const fieldsets = screen.getAllByRole('group');
    expect(fieldsets).toHaveLength(10);
    // Each question has at least 3 options
    for (const fs of fieldsets) {
      expect(within(fs).getAllByRole('checkbox').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('shows validation errors for unanswered questions on submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /submit/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(10);
    expect(alerts[0]).toHaveTextContent('Please select at least one option');
  });

  it('clears validation error when a question is answered', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getAllByRole('alert')).toHaveLength(10);

    // Answer the first question
    const firstFieldset = screen.getAllByRole('group')[0];
    await user.click(within(firstFieldset).getAllByRole('checkbox')[0]);

    expect(screen.getAllByRole('alert')).toHaveLength(9);
  });

  it('submits successfully and navigates to /events/new', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({});
    renderForm();

    await answerAllQuestions(user);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(mockPost).toHaveBeenCalledWith('/taste-benchmark', {
      answers: expect.objectContaining({ q1: expect.any(Array), q10: expect.any(Array) }),
    });
    expect(mockNavigate).toHaveBeenCalledWith('/events/new');
  });

  it('navigates to returnTo URL on success', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({});
    renderForm('/benchmark?returnTo=/events/abc/respond');

    await answerAllQuestions(user);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/events/abc/respond');
  });

  it('shows server validation errors for missing questions', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce(
      new MockApiError(400, { error: 'incomplete_benchmark', missingQuestions: ['q3', 'q7'] }),
    );
    renderForm();

    await answerAllQuestions(user);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Should show errors for q3 and q7
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(2);
  });

  it('shows generic error for non-validation API errors', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    renderForm();

    await answerAllQuestions(user);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to submit. Please try again.');
  });

  it('disables submit button while submitting', async () => {
    const user = userEvent.setup();
    let resolvePost: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((r) => { resolvePost = r; }));
    renderForm();

    await answerAllQuestions(user);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();

    resolvePost!({});
  });
});
