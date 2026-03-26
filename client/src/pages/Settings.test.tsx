import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';

// Mock api client
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
  getCurrentUserId: vi.fn(() => '00000000-0000-0000-0000-000000000001'),
}));

import { api } from '../api/client';

describe('Settings Page', () => {
  const mockProfile = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    name: 'Test User',
    auth_provider: 'email',
    ai_api_key: null,
    created_at: new Date().toISOString(),
  };

  const mockStorageInfo = {
    eventsCreated: 5,
    responsesSubmitted: 10,
    hasTasteBenchmark: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve(mockProfile);
      if (url === '/auth/storage-info') return Promise.resolve(mockStorageInfo);
      if (url === '/taste-benchmark') return Promise.resolve({ answers: {} });
      return Promise.reject(new Error('Not found'));
    });
  });

  it('renders navigation tabs including Infrastructure', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Profile/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Preferences/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Infrastructure/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Data & Storage/i).length).toBeGreaterThan(0);
    });
  });

  it('displays infrastructure details and AI configuration', async () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=infrastructure']}>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/AI Configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/PostgreSQL/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/sk-or-v1-.../i)).toBeInTheDocument();
    });
  });

  it('updates AI API key successfully', async () => {
    (api.patch as any).mockResolvedValue({ ...mockProfile, ai_api_key: 'new-key' });

    render(
      <MemoryRouter initialEntries={['/settings?tab=infrastructure']}>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByPlaceholderText(/sk-or-v1-.../i));

    const input = screen.getByPlaceholderText(/sk-or-v1-.../i);
    await userEvent.type(input, 'new-key');
    
    const submitBtn = screen.getByRole('button', { name: /Update AI Settings/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/auth/me', { ai_api_key: 'new-key' });
    });
  });
});
