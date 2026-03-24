import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, MapPin, Calendar, Navigation, Trash2, Search } from 'lucide-react';
import { api, getCurrentUserId } from '../api/client';

function formatWindowRemaining(end: string, status: string, working: boolean): string {
  if (status === 'options_ready' || status === 'finalized') return 'Closed';
  if (status === 'generating' || working) return 'Generating...';
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return 'Generating...';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

interface EventSuggestions {
  venue_ideas: string[];
  estimated_cost_per_person: string;
  estimated_duration_minutes: number;
  suggested_time: string;
  suggested_day: string;
}

interface EventItem {
  id: string;
  inviter_id: string;
  inviter_email?: string;
  title: string;
  description: string;
  status: string;
  archived?: boolean;
  response_window_end: string;
  preferred_date: string | null;
  preferred_time: string | null;
  duration_minutes: number | null;
  ai_suggestions: EventSuggestions | null;
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

function formatOrganizerName(email?: string | null): string {
  if (!email) return 'Unknown';
  return email;
}

function EventCard({ event, role, onHide }: { event: EventItem; role: 'creator' | 'participant'; onHide?: (e: React.MouseEvent, id: string) => void }) {
  const s = STATUS_LABELS[event.status] || { label: event.status, cls: '' };
  const linkTo = event.status === 'options_ready' && role === 'creator'
    ? `/events/${event.id}/options`
    : event.status === 'finalized'
      ? `/events/${event.id}/confirmation`
      : `/events/${event.id}`;

  return (
    <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="gf-card gf-event-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 className="gf-card-title">{event.title}</h3>
            {role === 'participant' && event.inviter_email && (
              <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                by {formatOrganizerName(event.inviter_email)}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`gf-status-chip ${s.cls}`}>{s.label}</span>
            {onHide && (
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted)', fontSize: '1rem' }}
                onClick={(e) => onHide(e, event.id)}
                aria-label="Hide event"
              >
                ✕
              </button>
            )}
          </div>
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

function TimelineDetail({ event, onDelete }: { event: EventItem; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  
  // Force re-render every second to update countdown and trigger auto-generation when expired
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const windowOpen = new Date(event.response_window_end).getTime() > now;
  const isOrganizer = event.inviter_id === getCurrentUserId();

  const [working, setWorking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleGenerateOptions = useCallback(async () => {
    if (working || event.status !== 'collecting') return;
    setWorking(true);
    try {
      await api.post(`/events/${event.id}/generate`);
    } catch {
      // ignore
    } finally {
      setWorking(false);
    }
  }, [event.id, event.status, working]);

  const autoGenerateAttempted = useRef(false);
  useEffect(() => {
    if (isOrganizer && event.status === 'collecting' && !windowOpen && !working && !autoGenerateAttempted.current) {
      autoGenerateAttempted.current = true;
      handleGenerateOptions();
    }
  }, [isOrganizer, event.status, windowOpen, working, handleGenerateOptions]);

  async function handleDeleteEvent() {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    setDeleting(true);
    try {
      await api.delete(`/events/${event.id}`);
      onDelete(event.id);
    } catch {
      setDeleting(false);
    }
  }

  const isGenerating = event.status === 'generating' || working;

  const s = STATUS_LABELS[event.status] || { label: event.status, cls: '' };
  const activity = event.selected_activity;
  const suggestions = event.ai_suggestions;

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
    <div className="gf-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: deleting ? 0.5 : 1, pointerEvents: deleting ? 'none' : 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.respondent_count !== undefined && (
            <p className="gf-muted" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={13} /> {event.respondent_count} participants
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`gf-status-chip ${s.cls}`}>{s.label}</span>
        </div>
      </div>

      <div className="gf-detail-rows">
        {detailRow('Response window', formatWindowRemaining(event.response_window_end, event.status, working))}
        {windowOpen && !suggestions && (
          <p className="gf-muted" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>
            Suggestions will appear once the response window closes.
          </p>
        )}
        {detailRow('Activity / Venue', venueValue)}
        {detailRow('Date', dateValue)}
        {detailRow('Per person', suggestions?.estimated_cost_per_person ?? null)}
        {detailRow('Duration', durationValue)}
        {(isOrganizer || event.inviter_email) && detailRow('Organizer', isOrganizer ? 'You' : formatOrganizerName(event.inviter_email))}
      </div>

      {event.description && (
        <div>
          <span className="gf-label">Description</span>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>{event.description}</p>
        </div>
      )}

      <div className="gf-actions">
        {event.status === 'options_ready' && isOrganizer ? (
          <button
            type="button"
            className="gf-button gf-button--primary"
            onClick={() => navigate(`/events/${event.id}/options`)}
          >
            Pick activity
          </button>
        ) : event.status === 'finalized' ? (
          <button
            type="button"
            className="gf-button gf-button--primary"
            onClick={() => navigate(`/events/${event.id}/confirmation`)}
          >
            View confirmation
          </button>
        ) : isGenerating ? (
          <button
            type="button"
            className="gf-button gf-button--primary"
            disabled
          >
            Generating options...
          </button>
        ) : (
          <button
            type="button"
            className="gf-button gf-button--primary"
            onClick={() => navigate(`/events/${event.id}/respond`)}
          >
            RSVP
          </button>
        )}
        {isOrganizer && windowOpen && event.status === 'collecting' && (
          <button
            type="button"
            className="gf-button gf-button--secondary"
            disabled={working}
            onClick={handleGenerateOptions}
          >
            {working ? 'Generating…' : 'End window & generate'}
          </button>
        )}
        <button type="button" className="gf-button gf-button--ghost gf-inline-icon" title="Coming soon">
          <Calendar size={14} /> Add to Calendar
        </button>
        <button type="button" className="gf-button gf-button--ghost gf-inline-icon" title="Coming soon">
          <Navigation size={14} /> Map &amp; Navigation
        </button>
        {isOrganizer && (
          <button
            type="button"
            className="gf-button gf-button--ghost gf-inline-icon"
            style={{ color: 'var(--error, #e53e3e)' }}
            onClick={handleDeleteEvent}
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

function TimelineView({ events, initialEventId, onDelete, searchQuery, setSearchQuery }: { events: EventItem[]; initialEventId?: string | null; onDelete: (id: string) => void; searchQuery: string; setSearchQuery: (q: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialEventId && events.find(e => e.id === initialEventId)) return initialEventId;
    return events[0]?.id ?? null;
  });
  const grouped = useMemo(() => groupByDate(events), [events]);
  // Derive the selected event from the live events array so it always reflects the latest poll data.
  const selected = events.find(e => e.id === selectedId) ?? events[0] ?? null;

  return (
    <div className="gf-timeline-layout">
      {/* Left: event list grouped by date */}
      <div className="gf-timeline-list">
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Search timeline..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="gf-input"
            style={{ paddingLeft: '38px', borderRadius: '999px', fontSize: '0.9rem', width: '100%' }}
          />
        </div>
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p className="gf-muted">{searchQuery ? 'No matching events found.' : 'No events yet.'}</p>
          </div>
        ) : (
          grouped.map(({ label, events: evs }) => (
            <div key={label}>
              <p className="gf-timeline-group__date">{label}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {evs.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedId(ev.id)}
                    className={`gf-timeline-card${selected?.id === ev.id ? ' gf-timeline-card--selected' : ''}`}
                  >
                    <p className="gf-timeline-card__title">{ev.title}</p>
                    {ev.inviter_id !== getCurrentUserId() && ev.inviter_email && (
                      <p className="gf-muted" style={{ fontSize: '0.8rem', textAlign: 'left', marginBottom: '4px' }}>
                        by {formatOrganizerName(ev.inviter_email)}
                      </p>
                    )}
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
          ))
        )}
      </div>

      {/* Right: detail panel */}
      <div>
        {selected
          ? <TimelineDetail key={selected.id} event={selected} onDelete={onDelete} />
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
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createdLimit, setCreatedLimit] = useState(6);
  const [joinedLimit, setJoinedLimit] = useState(4);
  const [archivedLimit, setArchivedLimit] = useState(4);
  const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('gofish_hidden_events');
      if (stored) return new Set(JSON.parse(stored));
    } catch { /* ignore */ }
    return new Set();
  });

  const handleHideEvent = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setHiddenEventIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('gofish_hidden_events', JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  }, []);

  function handleDeleteEvent(eventId: string) {
    setCreated(prev => prev.filter(e => e.id !== eventId));
    setJoined(prev => prev.filter(e => e.id !== eventId));
  }

  useEffect(() => {
    setTab(searchParams.get('tab') === 'timeline' ? 'timeline' : 'events');
    setSearchQuery('');
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
    if (!getCurrentUserId()) { navigate('/?auth=1&returnTo=/dashboard', { replace: true }); return; }
    api.get<{ created: EventItem[]; joined: EventItem[] }>('/events')
      .then(data => { setCreated(data.created); setJoined(data.joined); })
      .catch(() => setError('Could not load the dashboard.'))
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      api.get<{ created: EventItem[]; joined: EventItem[] }>('/events')
        .then(data => {
          setCreated(prev =>
            prev.length === data.created.length && prev.every((e, i) => e.id === data.created[i].id && e.status === data.created[i].status && JSON.stringify(e.ai_suggestions) === JSON.stringify(data.created[i].ai_suggestions) && e.inviter_email === data.created[i].inviter_email && e.archived === data.created[i].archived)
              ? prev : data.created
          );
          setJoined(prev =>
            prev.length === data.joined.length && prev.every((e, i) => e.id === data.joined[i].id && e.status === data.joined[i].status && JSON.stringify(e.ai_suggestions) === JSON.stringify(data.joined[i].ai_suggestions) && e.inviter_email === data.joined[i].inviter_email && e.archived === data.joined[i].archived)
              ? prev : data.joined
          );
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [navigate]);

  const matchesSearch = useCallback((e: EventItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (e.title?.toLowerCase() || '').includes(q) || (e.description?.toLowerCase().includes(q) ?? false);
  }, [searchQuery]);

  if (loading) return <p className="gf-muted">Loading…</p>;

  const activeCreated = created.filter(e => !e.archived && matchesSearch(e) && !hiddenEventIds.has(e.id));
  const archivedCreated = created.filter(e => e.archived && matchesSearch(e) && !hiddenEventIds.has(e.id));
  const activeJoined = joined.filter(e => !e.archived && matchesSearch(e) && !hiddenEventIds.has(e.id));
  const archivedJoined = joined.filter(e => e.archived && matchesSearch(e) && !hiddenEventIds.has(e.id));

  const allArchived = [
    ...archivedCreated.map(e => ({ e, role: 'creator' as const })),
    ...archivedJoined.map(e => ({ e, role: 'participant' as const }))
  ];

  const timelineEvents = [...created, ...joined].filter(e => !e.archived && matchesSearch(e));

  const hasAnyActive = activeCreated.length > 0 || activeJoined.length > 0;
  const hasAnyArchived = archivedCreated.length > 0 || archivedJoined.length > 0;

  return (
    <div className="gf-stack gf-stack--xl">
      {toast && <p className="gf-feedback gf-feedback--success">✓ {toast}</p>}
      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      {tab === 'events' && (
        <>
          {activeCreated.length > 0 && (
            <section className="gf-stack">
              <h2 className="gf-section-title">My Events</h2>
              <div className="gf-grid gf-grid--two">
                {activeCreated.slice(0, createdLimit).map(e => <EventCard key={e.id} event={e} role="creator" onHide={handleHideEvent} />)}
              </div>
              {activeCreated.length > createdLimit && (
                <button
                  type="button"
                  className="gf-button gf-button--ghost"
                  onClick={() => setCreatedLimit(prev => prev + 6)}
                  style={{ alignSelf: 'center', marginTop: '8px' }}
                >
                  Show more
                </button>
              )}
            </section>
          )}

          {activeJoined.length > 0 && (
            <section className="gf-stack">
              <h2 className="gf-section-title">Joined Events</h2>
              <div className="gf-grid gf-grid--two">
                {activeJoined.slice(0, joinedLimit).map(e => <EventCard key={e.id} event={e} role="participant" onHide={handleHideEvent} />)}
              </div>
              {activeJoined.length > joinedLimit && (
                <button
                  type="button"
                  className="gf-button gf-button--ghost"
                  onClick={() => setJoinedLimit(prev => prev + 4)}
                  style={{ alignSelf: 'center', marginTop: '8px' }}
                >
                  Show more
                </button>
              )}
            </section>
          )}

          {!hasAnyActive && !hasAnyArchived && (
            <div className="gf-card">
              <h3 className="gf-card-title">{searchQuery ? 'No matching events' : 'No groups yet'}</h3>
              <p className="gf-muted">{searchQuery ? 'Try adjusting your search.' : 'Create an event to get started.'}</p>
            </div>
          )}

          {hasAnyArchived && (
            <section className="gf-stack" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="gf-section-title" style={{ color: 'var(--muted)' }}>Past Events</h2>
                <button
                  type="button"
                  className="gf-button gf-button--ghost gf-button--sm"
                  onClick={() => setShowArchived(!showArchived)}
                >
                  {showArchived ? 'Hide' : 'Show'}
                </button>
              </div>
              {showArchived && (
                <>
                  <div className="gf-grid gf-grid--two" style={{ opacity: 0.7 }}>
                    {allArchived.slice(0, archivedLimit).map(({ e, role }) => <EventCard key={e.id} event={e} role={role} onHide={handleHideEvent} />)}
                  </div>
                  {allArchived.length > archivedLimit && (
                    <button
                      type="button"
                      className="gf-button gf-button--ghost"
                      onClick={() => setArchivedLimit(prev => prev + 4)}
                      style={{ alignSelf: 'center', marginTop: '8px' }}
                    >
                      Show more
                    </button>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}

      {tab === 'timeline' && <TimelineView events={timelineEvents} initialEventId={searchParams.get('event')} onDelete={handleDeleteEvent} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
    </div>
  );
}
