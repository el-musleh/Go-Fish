import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EventDetail from './EventDetail';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('../api/client', () => ({
  api: {
    get: mockGet,
    post: vi.fn(),
  },
}));

function renderDetail(eventId = 'evt-1') {
  return render(
    <MemoryRouter initialEntries={[`/events/${eventId}`]}>
      <Routes>
        <Route path="/events/:eventId" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EventDetail', () => {
  it('loads and displays event info', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'evt-1',
      title: 'Game Night',
      description: 'Board games at my place',
      status: 'collecting',
      response_window_end: '2025-01-15T12:00:00Z',
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('Game Night')).toBeInTheDocument();
    });
    expect(screen.getByText('Board games at my place')).toBeInTheDocument();
    expect(screen.getByText(/collecting/)).toBeInTheDocument();
  });

  it('shows error on fetch failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('fail'));
    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load event');
    });
  });

  it('renders invitation link panel', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'evt-1',
      title: 'Game Night',
      description: 'desc',
      status: 'collecting',
      response_window_end: '2025-01-15T12:00:00Z',
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('Invitation Link')).toBeInTheDocument();
    });
  });
});
