import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setCurrentUserId } from '../api/client';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.post<{ userId: string; isNew: boolean }>('/auth/email', { email: email.trim() });
      setCurrentUserId(data.userId);
      navigate(data.isNew ? `/benchmark?returnTo=${encodeURIComponent(returnTo)}` : returnTo, { replace: true });
    } catch {
      setError('Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gf-page-center">
      <div className="gf-card gf-auth-panel">
        <h2 className="gf-section-title">Sign in</h2>
        <div className="gf-auth-panel__grid">
          <form className="gf-stack" onSubmit={handleSubmit}>
            <label className="gf-field">
              <span className="gf-field__label">Email</span>
              <input
                className="gf-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            {error && <p className="gf-feedback gf-feedback--error">{error}</p>}
            <button className="gf-button gf-button--primary" type="submit" disabled={loading}>
              {loading ? 'Working...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
