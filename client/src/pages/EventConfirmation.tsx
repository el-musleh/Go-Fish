import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

interface ActivityOption { id: string; title: string; description: string; suggested_date: string; suggested_time: string | null; rank: number; is_selected: boolean; }

function prettyDate(d: string) {
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EventConfirmation() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ActivityOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    api.get<{ options: ActivityOption[] }>(`/events/${eventId}/options`)
      .then((data) => setSelected(data.options.find((o) => o.is_selected) ?? null))
      .catch(() => setError('Failed to load confirmation.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <p className="gf-muted">Loading…</p>;
  if (error) return <p className="gf-feedback gf-feedback--error">{error}</p>;

  if (!selected) return (
    <div className="gf-card gf-text-center">
      <p className="gf-muted">No activity selected yet.</p>
    </div>
  );

  return (
    <div className="gf-stack gf-stack--xl">
      <div className="gf-celebration">
        <h2 className="gf-celebration__heading">🎉 Event Confirmed</h2>
      </div>

      <div className="gf-card gf-option-card gf-option-card--featured">
        <h3 className="gf-card-title">{selected.title}</h3>
        <p className="gf-muted">{selected.description}</p>
        <p className="gf-muted">
          {prettyDate(selected.suggested_date)}{selected.suggested_time ? ` at ${selected.suggested_time}` : ''}
        </p>
      </div>

      <p className="gf-feedback gf-feedback--success gf-text-center">
        Emails sent to all participants
      </p>

      <div className="gf-actions" style={{ justifyContent: 'center' }}>
        <button type="button" className="gf-button gf-button--ghost" onClick={() => navigate(`/dashboard?tab=timeline&event=${eventId}`)}>
          View in Timeline
        </button>
      </div>
    </div>
  );
}
