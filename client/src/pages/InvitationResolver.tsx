import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, getCurrentUserId } from '../api/client';
import { colors, shared } from '../theme';

export default function InvitationResolver() {
  const { linkToken } = useParams<{ linkToken: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!linkToken) return;

    // Must be logged in first
    if (!getCurrentUserId()) {
      navigate(`/login?returnTo=/invite/${linkToken}`, { replace: true });
      return;
    }

    api.get<{ eventId: string }>(`/invite/${linkToken}`)
      .then((data) => {
        // Check if user needs benchmark by trying to get their benchmark
        api.get('/taste-benchmark')
          .then(() => {
            // Has benchmark, go to response form
            navigate(`/events/${data.eventId}/respond`, { replace: true });
          })
          .catch((err) => {
            if (err instanceof ApiError && err.status === 404) {
              // No benchmark yet, send to benchmark first
              navigate(`/benchmark?returnTo=/events/${data.eventId}/respond`, { replace: true });
            } else {
              navigate(`/events/${data.eventId}/respond`, { replace: true });
            }
          });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate(`/login?returnTo=/invite/${linkToken}`, { replace: true });
        } else if (err instanceof ApiError && err.status === 404) {
          setError('This invitation link is invalid or expired.');
        } else {
          setError('Something went wrong. Please try again.');
        }
      });
  }, [linkToken, navigate]);

  if (error) return (
    <div style={shared.page}><div style={shared.container}><div style={shared.logo}>🐟 Go Fish</div>
      <div style={{ ...shared.card, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>😕</div>
        <p role="alert" style={{ color: colors.error }}>{error}</p>
      </div>
    </div></div>
  );

  return (
    <div style={{ ...shared.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: colors.textSecondary }}>Resolving invitation…</p>
    </div>
  );
}
