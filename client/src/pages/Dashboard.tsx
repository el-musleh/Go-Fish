import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, MapPin, Calendar, Navigation, Split } from 'lucide-react';
import { api, getCurrentUserId, getCurrentUserEmail } from '../api/client';

interface EventItem {
  id: string;
  title: string;
  description: string;
  status: string;
  response_window_end: string;
  preferred_date: string | null;
  preferred_time: string | null;
  duration_minutes: number | null;
  respondent_count?: number;
  selected_activity?: { title: string; suggested_date: string; suggested_time: string | null } | null;
}

function prettyDate(d: string) {
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function prettyDateFull(d: string) {
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
            🎯 {event.selected_activity.title} · 📅 {prettyDate(event.selected_activity.suggested_date)}{event.selected_activity.suggested_time ? ` at ${event.selected_activity.suggested_time}` : ''}
          </p>
        )}
        {role === 'creator' && event.respondent_count !== undefined && (
          <p className="gf-muted">👥 {event.respondent_count} responded</p>
        )}
      </div>
    </Link>
  );
}

// ── Timeline helpers ────────────────────────────────────────────────────────

function getEventDate(event: EventItem): string | null {
  return event.selected_activity?.suggested_date ?? event.preferred_date ?? null;
}

interface DateGroup { label: string; rawDate: string | null; events: EventItem[]; }

function groupByDate(events: EventItem[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  for (const ev of events) {
    const d = getEventDate(ev);
    const key = d ? d.split('T')[0] : 'unscheduled';
    if (!map.has(key)) map.set(key, { label: d ? prettyDateFull(d) : 'Unscheduled', rawDate: d ? d.split('T')[0] : null, events: [] });
    map.get(key)!.events.push(ev);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.rawDate === null) return -1;
    if (b.rawDate === null) return 1;
    return a.rawDate.localeCompare(b.rawDate);
  });
}

interface EventSuggestions {
  venue_ideas: string[];
  estimated_cost_per_person: string;
  estimated_duration_minutes: number;
  suggested_time: string;
  suggested_day: string;
}

function TimelineDetail({ event }: { event: EventItem }) {
  const navigate = useNavigate();
  const cache = useRef<Map<string, EventSuggestions>>(new Map());
  const [suggestions, setSuggestions] = useState<EventSuggestions | null>(() => cache.current.get(event.id) ?? null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(!cache.current.has(event.id));

  useEffect(() => {
    if (cache.current.has(event.id)) {
      setSuggestions(cache.current.get(event.id)!);
      setLoadingSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    setSuggestions(null);
    api.get<EventSuggestions>(`/events/${event.id}/suggestions`)
      .then(data => {
        cache.current.set(event.id, data);
        setSuggestions(data);
      })
      .catch(() => setSuggestions(null))
      .finally(() => setLoadingSuggestions(false));
  }, [event.id]);

  const s = STATUS_LABELS[event.status] || { label: event.status, cls: '' };
  const activity = event.selected_activity;

  const venueValue = activity
    ? activity.title
    : suggestions?.venue_ideas.join(', ') ?? null;

  const dateValue = activity
    ? `${prettyDate(activity.suggested_date)}${activity.suggested_time ? ` at ${activity.suggested_time}` : ''}`
    : event.preferred_date
      ? `${prettyDate(event.preferred_date)}${event.preferred_time ? ` at ${event.preferred_time}` : ''} (preferred)`
      : suggestions
        ? `${suggestions.suggested_day} · ${suggestions.suggested_time} (suggested)`
        : null;

  const durationValue = event.duration_minutes
    ? `${event.duration_minutes} min`
    : suggestions?.estimated_duration_minutes
      ? `~${suggestions.estimated_duration_minutes} min (suggested)`
      : null;

  function detailRow(label: string, value: string | null, placeholder = '—') {
    const isEmpty = !value;
    return (
      <div className="gf-detail-row" key={label}>
        <span className="gf-detail-row__label">{label}</span>
        <span className={`gf-detail-row__value${isEmpty ? ' gf-detail-row__value--placeholder' : ''}`}>
          {isEmpty ? placeholder : value}
        </span>
      </div>
    );
  }

  return (
    <div className="gf-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.respondent_count !== undefined && (
            <p className="gf-muted" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={13} /> {event.respondent_count} participants
            </p>
          )}
        </div>
        <span className={`gf-status-chip ${s.cls}`}>{s.label}</span>
      </div>

      <div className="gf-detail-rows">
        {loadingSuggestions && (
          <p className="gf-muted" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>
            Generating suggestions…
          </p>
        )}
        {detailRow('Activity / Venue', venueValue)}
        {detailRow('Date', dateValue)}
        {detailRow('Per person', suggestions?.estimated_cost_per_person ?? null)}
        {detailRow('Duration', durationValue)}
        <div className="gf-detail-row">
          <span className="gf-detail-row__label">Payment status</span>
          <span className="gf-detail-row__value gf-detail-row__value--placeholder">— (coming soon)</span>
        </div>
        {detailRow('Organizer', getCurrentUserEmail())}
      </div>

      {event.description && (
        <div>
          <span className="gf-label">Description</span>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>{event.description}</p>
        </div>
      )}

      <div className="gf-actions">
        <button
          type="button"
          className="gf-button gf-button--primary"
          onClick={() => navigate(`/events/${event.id}/respond`)}
        >
          RSVP
        </button>
        <button type="button" className="gf-button gf-button--ghost gf-inline-icon" title="Coming soon">
          <Split size={14} /> Split Cost
        </button>
        <button type="button" className="gf-button gf-button--ghost gf-inline-icon" title="Coming soon">
          <Calendar size={14} /> Add to Calendar
        </button>
        <button type="button" className="gf-button gf-button--ghost gf-inline-icon" title="Coming soon">
          <Navigation size={14} /> Map &amp; Navigation
        </button>
      </div>
    </div>
  );
}

function TimelineView({ events, initialEventId }: { events: EventItem[]; initialEventId?: string | null }) {
  const [selected, setSelected] = useState<EventItem | null>(() => {
    if (initialEventId) {
      const found = events.find(e => e.id === initialEventId);
      if (found) return found;
    }
    return events[0] ?? null;
  });
  const grouped = groupByDate(events);

  if (events.length === 0) {
    return (
      <div className="gf-card">
        <h3 className="gf-card-title">No events yet</h3>
        <p className="gf-muted">Create or join an event to see it here.</p>
      </div>
    );
  }

  return (
    <div className="gf-timeline-layout">
      {/* Left: event list grouped by date */}
      <div className="gf-timeline-list">
        {grouped.map(({ label, events: evs }) => (
          <div key={label}>
            <p className="gf-timeline-group__date">{label}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {evs.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setSelected(ev)}
                  className={`gf-timeline-card${selected?.id === ev.id ? ' gf-timeline-card--selected' : ''}`}
                >
                  <p className="gf-timeline-card__title">{ev.title}</p>
                  <div className="gf-timeline-card__meta">
                    {ev.respondent_count !== undefined && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={11} /> {ev.respondent_count}
                      </span>
                    )}
                    {ev.selected_activity && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={11} /> {ev.selected_activity.title}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Right: detail panel */}
      <div>
        {selected
          ? <TimelineDetail event={selected} />
          : <div className="gf-card"><p className="gf-muted">Select an event to view details.</p></div>
        }
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [created, setCreated] = useState<EventItem[]>([]);
  const [joined, setJoined] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'events' | 'timeline'>(() =>
    searchParams.get('tab') === 'timeline' ? 'timeline' : 'events',
  );

  async function handleDelete(eventId: string) {
    try {
      await api.delete<{ deleted: true }>(`/events/${eventId}`);
      setCreated(prev => prev.filter(e => e.id !== eventId));
    } catch {
      setError('Could not delete event.');
    }
  }

  useEffect(() => {
    setTab(searchParams.get('tab') === 'timeline' ? 'timeline' : 'events');
  }, [searchParams]);

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
  const allEvents = [...created, ...joined];

  return (
    <div className="gf-stack gf-stack--xl">
      {toast && <p className="gf-feedback gf-feedback--success">✓ {toast}</p>}
      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      {tab === 'events' && (
        <>
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
        </>
      )}

      {tab === 'timeline' && <TimelineView events={allEvents} initialEventId={searchParams.get('event')} />}
    </div>
  );
}
