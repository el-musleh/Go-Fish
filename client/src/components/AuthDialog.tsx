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
