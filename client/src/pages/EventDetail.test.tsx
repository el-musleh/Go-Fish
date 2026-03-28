import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EventDetail from './EventDetail';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/respondents')) return Promise.resolve({ respondents: [] });
      if (url.endsWith('/options')) return Promise.resolve({ options: [] });
      // If it's the main event fetch, use the mockGet value
      if (url.startsWith('/events/')) return mockGet();
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    }),
    post: vi.fn(),
  },
  getCurrentUserId: vi.fn().mockReturnValue('user-123'),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number) {
      super(`API Error ${status}`);
      this.status = status;
    }
  },
}));

function renderDetail(eventId = 'evt-1') {
  return render(
    <MemoryRouter initialEntries={[`/events/${eventId}`]}>
      <Routes>
        <Route path="/events/:eventId" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EventDetail', () => {
  it('loads and displays event info', async () => {
    // Set date to far in the future
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    mockGet.mockResolvedValue({
      id: 'evt-1',
      title: 'Game Night',
      description: 'Board games at my place',
      status: 'collecting',
      inviter_id: 'user-123',
      response_window_end: futureDate.toISOString(),
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('Game Night')).toBeInTheDocument();
    });
    expect(screen.getByText('Board games at my place')).toBeInTheDocument();
    // When collecting and window is open, it shows countdown and "remaining"
    expect(screen.getByText(/remaining/i)).toBeInTheDocument();
  });

  it('shows error on fetch failure', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('Could not load the event.')).toBeInTheDocument();
    });
  });

  it('renders share panel for creator', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    mockGet.mockResolvedValue({
      id: 'evt-1',
      title: 'Game Night',
      description: 'desc',
      status: 'collecting',
      inviter_id: 'user-123',
      response_window_end: futureDate.toISOString(),
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('Share Invite')).toBeInTheDocument();
    });
  });
});
