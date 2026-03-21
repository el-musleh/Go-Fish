import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, setCurrentUserId } from '../api/client';
import { colors, shared } from '../theme';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const returnTo = searchParams.get('returnTo') || '/dashboard';

  function handleSuccess() {
    navigate(returnTo);
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/google');
      handleSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { error?: string; message?: string };
        setError(body.message || body.error || 'Google login failed.');
      } else {
        setError('Google login failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed) { setError('Please enter your email.'); return; }

    setLoading(true);
    try {
      const result = await api.post<{ userId: string; isNew: boolean }>('/auth/email', { email: trimmed });
      setCurrentUserId(result.userId);
      if (result.isNew) {
        navigate(`/benchmark?returnTo=${encodeURIComponent(returnTo)}`);
      } else {
        handleSuccess();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { error?: string; message?: string };
        setError(body.message || body.error || 'Login failed.');
      } else {
        setError('Login failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={shared.page}>
      <div style={{ ...shared.container, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ ...shared.card, width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🐟</div>
            <h1 style={{ ...shared.title, fontSize: '1.5rem' }}>Welcome to Go Fish</h1>
            <p style={{ ...shared.subtitle, margin: 0, fontSize: '0.9rem' }}>Plan the perfect group activity</p>
          </div>

          {error && <div style={shared.errorBox} role="alert">{error}</div>}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '10px 16px', fontSize: '0.95rem', fontWeight: 500,
              border: `1px solid ${colors.border}`, borderRadius: 10, backgroundColor: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              ...(loading ? shared.btnDisabled : {}),
            }}
            aria-label="Sign in with Google"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
              <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.71.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
              <path d="M4.51 10.53a4.8 4.8 0 0 1 0-3.06V5.4H1.83a8 8 0 0 0 0 7.18l2.68-2.05z" fill="#FBBC05"/>
              <path d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4l2.68 2.07c.63-1.89 2.39-3.29 4.47-3.29z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: colors.textMuted, fontSize: '0.8rem' }}>
            <span style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <span>or continue with email</span>
            <span style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </div>

          <form onSubmit={handleEmailLogin}>
            <label htmlFor="email-input" style={{ display: 'none' }}>Email</label>
            <input
              id="email-input" type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ ...shared.input, marginBottom: 12 }}
              disabled={loading} autoComplete="email" required
            />
            <button type="submit" disabled={loading}
              style={{ ...shared.btn, width: '100%', ...(loading ? shared.btnDisabled : {}) }}>
              {loading ? 'Signing in…' : 'Continue with email'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
