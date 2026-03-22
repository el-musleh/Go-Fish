import { describe, expect, it } from 'vitest';
import {
  getPostAuthDestination,
  getSessionEmailForSync,
  shouldBlockDuringAuthBootstrap,
} from './authSession';

describe('getSessionEmailForSync', () => {
  it('returns the email for SIGNED_IN when no app user is loaded yet', () => {
    expect(
      getSessionEmailForSync('SIGNED_IN', { user: { email: 'test@example.com' } }, null)
    ).toBe('test@example.com');
  });

  it('returns the email for INITIAL_SESSION on OAuth callback reload', () => {
    expect(
      getSessionEmailForSync('INITIAL_SESSION', { user: { email: 'test@example.com' } }, null)
    ).toBe('test@example.com');
  });

  it('returns null when an app user id already exists', () => {
    expect(
      getSessionEmailForSync('SIGNED_IN', { user: { email: 'test@example.com' } }, 'user-1')
    ).toBeNull();
  });

  it('returns null for unrelated auth events', () => {
    expect(
      getSessionEmailForSync('SIGNED_OUT', { user: { email: 'test@example.com' } }, null)
    ).toBeNull();
  });
});

describe('getPostAuthDestination', () => {
  it('keeps existing users on their current route', () => {
    expect(getPostAuthDestination('/events/evt-1/respond', false)).toBeNull();
  });

  it('sends new users to benchmark and preserves the intended destination', () => {
    expect(getPostAuthDestination('/events/evt-1/respond?foo=bar', true)).toBe(
      '/benchmark?returnTo=%2Fevents%2Fevt-1%2Frespond%3Ffoo%3Dbar'
    );
  });
});

describe('shouldBlockDuringAuthBootstrap', () => {
  it('blocks protected routes while auth is still bootstrapping', () => {
    expect(shouldBlockDuringAuthBootstrap('/dashboard', true)).toBe(true);
    expect(shouldBlockDuringAuthBootstrap('/events/evt-1/respond', true)).toBe(true);
  });

  it('allows public routes during auth bootstrap', () => {
    expect(shouldBlockDuringAuthBootstrap('/', true)).toBe(false);
    expect(shouldBlockDuringAuthBootstrap('/login', true)).toBe(false);
  });

  it('stops blocking once auth bootstrap is done', () => {
    expect(shouldBlockDuringAuthBootstrap('/dashboard', false)).toBe(false);
  });
});
