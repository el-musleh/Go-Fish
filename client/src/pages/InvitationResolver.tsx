import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, getCurrentUserId } from '../api/client';

export default function InvitationResolver() {
  const { linkToken } = useParams<{ linkToken: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!linkToken) return;

    if (!getCurrentUserId()) {
      navigate(`/login?returnTo=/invite/${linkToken}`, { replace: true });
      return;
    }

    api.get<{ eventId: string }>(`/invite/${linkToken}`)
      .then((data) => {
        api.get('/taste-benchmark')
          .then(() => {
            navigate(`/events/${data.eventId}/respond`, { replace: true });
          })
          .catch((err) => {
            if (err instanceof ApiError && err.status === 404) {
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
    <div className="gf-page-center">
      <div className="gf-card" style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>😕</div>
        <p className="gf-feedback gf-feedback--error">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="gf-page-center">
      <p className="gf-muted">Resolving invitation…</p>
    </div>
  );
}
