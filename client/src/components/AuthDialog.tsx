import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api, setCurrentUserId } from '../api/client';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  returnTo?: string;
}

type Mode = 'signin' | 'signup';

export default function AuthDialog({ open, onClose, returnTo = '/dashboard' }: AuthDialogProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('');
      setMode('signin');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  async function syncWithBackend(userEmail: string) {
    return api.post<{ userId: string; isNew: boolean }>('/auth/email', { email: userEmail });
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + returnTo },
      });
      if (authError) throw authError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign in with Google.');
      setLoading(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      const { userId, isNew } = await syncWithBackend(data.user.email!);
      setCurrentUserId(userId);
      onClose();
      navigate(isNew ? `/benchmark?returnTo=${encodeURIComponent(returnTo)}` : returnTo, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      if (data.user && !data.session) {
        setSuccess('Check your email to confirm your account.');
      } else if (data.user) {
        const { userId, isNew } = await syncWithBackend(data.user.email!);
        setCurrentUserId(userId);
        onClose();
        navigate(isNew ? `/benchmark?returnTo=${encodeURIComponent(returnTo)}` : returnTo, { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="gf-dialog-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="gf-dialog" onClick={e => e.stopPropagation()}>
        <button className="gf-dialog__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 className="gf-section-title">{mode === 'signin' ? 'Sign in' : 'Sign up'}</h2>

        <button
          className="gf-button gf-button--google"
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="gf-auth-divider"><span>or</span></div>

        <div className="gf-auth-tabs">
          <button
            className={`gf-auth-tab${mode === 'signin' ? ' gf-auth-tab--active' : ''}`}
            onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`gf-auth-tab${mode === 'signup' ? ' gf-auth-tab--active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
            type="button"
          >
            Sign up
          </button>
        </div>

        {mode === 'signin' ? (
          <form className="gf-stack" onSubmit={handleSignIn}>
            <label className="gf-field">
              <span className="gf-field__label">Email</span>
              <input
                className="gf-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="gf-field">
              <span className="gf-field__label">Password</span>
              <input
                className="gf-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="gf-feedback gf-feedback--error">{error}</p>}
            <button className="gf-button gf-button--primary" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form className="gf-stack" onSubmit={handleSignUp}>
            <label className="gf-field">
              <span className="gf-field__label">Email</span>
              <input
                className="gf-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="gf-field">
              <span className="gf-field__label">Password</span>
              <input
                className="gf-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="gf-field">
              <span className="gf-field__label">Confirm password</span>
              <input
                className="gf-input"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            {error && <p className="gf-feedback gf-feedback--error">{error}</p>}
            {success && <p className="gf-feedback gf-feedback--success">{success}</p>}
            <button className="gf-button gf-button--primary" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
