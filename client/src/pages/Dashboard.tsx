import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, getCurrentUserId } from '../api/client';

interface EventItem {
  id: string;
  title: string;
  description: string;
  status: string;
  response_window_end: string;
  respondent_count?: number;
  selected_activity?: { title: string; suggested_date: string } | null;
}

function prettyDate(d: string) {
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  collecting: { label: 'Collecting', cls: 'gf-status-chip--collecting' },
  generating: { label: 'Generating', cls: 'gf-status-chip--generating' },
  options_ready: { label: 'Pick activity', cls: 'gf-status-chip--ready' },
  finalized: { label: 'Confirmed', cls: 'gf-status-chip--finalized' },
};

function EventCard({ event, role, onDelete }: { event: EventItem; role: 'creator' | 'participant'; onDelete?: (id: string) => void }) {
  const s = STATUS_LABELS[event.status] || { label: event.status, cls: '' };
  const linkTo = event.status === 'options_ready' && role === 'creator'
    ? `/events/${event.id}/options`
    : event.status === 'finalized'
      ? `/events/${event.id}/confirmation`
      : `/events/${event.id}`;

  return (
    <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="gf-card gf-event-card">
        {onDelete && (
          <button
            className="gf-delete-btn"
            aria-label={`Delete ${event.title}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(event.id); }}
          >
            &#x2715;
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="gf-card-title">{event.title}</h3>
          <span className={`gf-status-chip ${s.cls}`}>{s.label}</span>
        </div>
        {event.status === 'finalized' && event.selected_activity && (
          <p className="gf-muted">
            🎯 {event.selected_activity.title} · 📅 {prettyDate(event.selected_activity.suggested_date)}
          </p>
        )}
        {role === 'creator' && event.respondent_count !== undefined && (
          <p className="gf-muted">👥 {event.respondent_count} responded</p>
        )}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [created, setCreated] = useState<EventItem[]>([]);
  const [joined, setJoined] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  async function handleDelete(eventId: string) {
    try {
      await api.delete<{ deleted: true }>(`/events/${eventId}`);
      setCreated(prev => prev.filter(e => e.id !== eventId));
    } catch {
      setError('Could not delete event.');
    }
  }

  useEffect(() => {
    if (searchParams.get('prefsUpdated')) {
      setToast('Preferences updated');
      setSearchParams({}, { replace: true });
      const t = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(t);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!getCurrentUserId()) { navigate('/login?returnTo=/dashboard', { replace: true }); return; }
    api.get<{ created: EventItem[]; joined: EventItem[] }>('/events')
      .then(data => { setCreated(data.created); setJoined(data.joined); })
      .catch(() => setError('Could not load the dashboard.'))
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      api.get<{ created: EventItem[]; joined: EventItem[] }>('/events')
        .then(data => { setCreated(data.created); setJoined(data.joined); })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [navigate]);

  if (loading) return <p className="gf-muted">Loading…</p>;

  const hasAny = created.length > 0 || joined.length > 0;

  return (
    <div className="gf-stack gf-stack--xl">
      {toast && <p className="gf-feedback gf-feedback--success">✓ {toast}</p>}
      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      {created.length > 0 && (
        <section className="gf-stack">
          <h2 className="gf-section-title">My Events</h2>
          <div className="gf-grid gf-grid--two">
            {created.map(e => <EventCard key={e.id} event={e} role="creator" onDelete={handleDelete} />)}
          </div>
        </section>
      )}

      {joined.length > 0 && (
        <section className="gf-stack">
          <h2 className="gf-section-title">Joined Events</h2>
          <div className="gf-grid gf-grid--two">
            {joined.map(e => <EventCard key={e.id} event={e} role="participant" />)}
          </div>
        </section>
      )}

      {!hasAny && (
        <div className="gf-card">
          <h3 className="gf-card-title">No groups yet</h3>
          <p className="gf-muted">Create an event to get started.</p>
        </div>
      )}
    </div>
  );
}
