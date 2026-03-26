import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  MapPin,
  Calendar,
  Navigation,
  Trash2,
  Search,
  CalendarPlus,
  X,
  Clock,
  ChevronDown,
  Bell,
} from 'lucide-react';
import { api, ApiError, getCurrentUserId } from '../api/client';
import ConfirmationDialog from '../components/ConfirmationDialog';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/SkeletonLoader';
import { getCalendarOptions, type CalendarEvent } from '../lib/calendar';

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
  selected_activity?: {
    title: string;
    suggested_date: string;
    suggested_time: string | null;
  } | null;
}

function prettyDate(d: string) {
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function prettyDateFull(d: string) {
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
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

interface NotificationsViewProps {
  created: EventItem[];
  joined: EventItem[];
}

function NotificationsView({ created, joined }: NotificationsViewProps) {
  const navigate = useNavigate();
  const [hideIds, setHideIds] = useState<Set<string>>(new Set());

  const myNewEvents = created.filter((e) => e.status === 'collecting');
  const joinedNewEvents = joined.filter((e) => e.status === 'collecting');

  const allNotifications = [
    ...myNewEvents.map((e) => ({
      event: e,
      role: 'creator' as const,
      time: e.response_window_end,
    })),
    ...joinedNewEvents.map((e) => ({
      event: e,
      role: 'participant' as const,
      time: e.response_window_end,
    })),
  ].filter((n) => !hideIds.has(n.event.id));

  const handleDismiss = (id: string) => {
    setHideIds((prev) => new Set([...prev, id]));
  };

  if (allNotifications.length === 0) {
    return (
      <EmptyState
        icon={<Bell size={48} />}
        title="All caught up!"
        description="You don't have any pending notifications. New event invitations will appear here."
      />
    );
  }

  return (
    <div className="gf-stack">
      <h2 className="gf-section-title">Pending Responses</h2>
      <p className="gf-muted" style={{ fontSize: '0.9rem', marginTop: '-12px' }}>
        Events waiting for your response or participant RSVPs
      </p>
      <div className="gf-grid gf-grid--two">
        {allNotifications.map(({ event, role }) => (
          <div key={event.id} className="gf-notification-card">
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div>
                <h3 className="gf-card-title">{event.title}</h3>
                {role === 'participant' && event.inviter_email && (
                  <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    Invited by {formatOrganizerName(event.inviter_email)}
                  </p>
                )}
                {role === 'creator' && event.respondent_count !== undefined && (
                  <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    {event.respondent_count} awaiting response
                  </p>
                )}
              </div>
              <button
                type="button"
                className="gf-delete-btn"
                onClick={() => handleDismiss(event.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
            <div className="gf-actions" style={{ marginTop: '12px' }}>
              {role === 'participant' ? (
                <button
                  type="button"
                  className="gf-button gf-button--primary"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  Respond Now
                </button>
              ) : (
                <button
                  type="button"
                  className="gf-button gf-button--primary"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  View Details
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Timeline helpers ────────────────────────────────────────────────────────

function getEventDate(event: EventItem): string | null {
  return event.selected_activity?.suggested_date ?? event.preferred_date ?? null;
}

function getFriendlyDateLabel(dateStr: string): { label: string; sublabel: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  if (d < today) {
    return { label: 'Past', sublabel: prettyDateFull(dateStr) };
  }
  if (d.getTime() === today.getTime()) {
    return { label: 'Today', sublabel: prettyDateFull(dateStr) };
  }
  if (d.getTime() === tomorrow.getTime()) {
    return { label: 'Tomorrow', sublabel: prettyDateFull(dateStr) };
  }
  if (d < nextWeek) {
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'long' }),
      sublabel: prettyDateFull(dateStr),
    };
  }
  return {
    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sublabel: prettyDateFull(dateStr),
  };
}

interface DateGroup {
  label: string;
  sublabel: string;
  rawDate: string | null;
  events: EventItem[];
}

function groupByDate(events: EventItem[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  for (const ev of events) {
    const d = getEventDate(ev);
    const key = d ? d.split('T')[0] : 'unscheduled';
    if (!map.has(key)) {
      const friendly = d ? getFriendlyDateLabel(d) : { label: 'Unscheduled', sublabel: '' };
      map.set(key, {
        label: friendly.label,
        sublabel: friendly.sublabel,
        rawDate: d ? d.split('T')[0] : null,
        events: [],
      });
    }
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
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const calendarDropdownRef = useRef<HTMLDivElement>(null);

  const selectedActivity = event.selected_activity;
  const suggestedDate = selectedActivity?.suggested_date || event.preferred_date;
  const suggestedTime = selectedActivity?.suggested_time || event.preferred_time;
  const canAddToCalendar = !!suggestedDate && event.status === 'finalized';

  const calendarEvent: CalendarEvent | null = canAddToCalendar
    ? {
        title: event.title,
        description: event.description || undefined,
        startDate: new Date(`${suggestedDate}T${suggestedTime || '12:00'}:00`),
        endDate: new Date(`${suggestedDate}T${suggestedTime || '14:00'}:00`),
      }
    : null;

  const calendarOptions = calendarEvent ? getCalendarOptions(calendarEvent, event.title) : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(e.target as Node)) {
        setShowCalendarDropdown(false);
      }
    }
    if (showCalendarDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalendarDropdown]);

  const handleGenerateOptions = useCallback(async () => {
    if (working || event.status !== 'collecting') return;
    setWorking(true);
    try {
      await api.post(`/events/${event.id}/generate`);
    } catch (err) {
      // 409 means generation is already in progress (race condition with EventDetail) — not an error
      if (!(err instanceof ApiError && err.status === 409)) {
        console.error('Failed to trigger generation:', err);
      }
    } finally {
      setWorking(false);
    }
  }, [event.id, event.status, working]);

  const autoGenerateAttempted = useRef(false);
  useEffect(() => {
    if (
      isOrganizer &&
      event.status === 'collecting' &&
      !windowOpen &&
      !working &&
      !autoGenerateAttempted.current
    ) {
      autoGenerateAttempted.current = true;
      handleGenerateOptions();
    }
  }, [isOrganizer, event.status, windowOpen, working, handleGenerateOptions]);

  function handlePromptDelete() {
    setConfirmingDelete(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/events/${event.id}`);
      onDelete(event.id);
      // No need to close dialog, as the component will unmount
    } catch {
      // TODO: Show toast error
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const isGenerating = event.status === 'generating' || working;

  const s = STATUS_LABELS[event.status] || { label: event.status, cls: '' };
  const activity = event.selected_activity;
  const suggestions = event.ai_suggestions;

  const venueValue = activity ? activity.title : (suggestions?.venue_ideas.join(', ') ?? null);

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
        <span
          className={`gf-detail-row__value${isEmpty ? ' gf-detail-row__value--placeholder' : ''}`}
        >
          {isEmpty ? placeholder : value}
        </span>
      </div>
    );
  }

  return (
    <div
      className="gf-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        opacity: deleting ? 0.5 : 1,
        pointerEvents: deleting ? 'none' : 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.respondent_count !== undefined && (
            <p
              className="gf-muted"
              style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={13} /> {event.respondent_count} participants
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`gf-status-chip ${s.cls}`}>{s.label}</span>
        </div>
      </div>

      <div className="gf-detail-rows">
        {detailRow(
          'Response window',
          formatWindowRemaining(event.response_window_end, event.status, working)
        )}
        {windowOpen && !suggestions && (
          <p className="gf-muted" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>
            Suggestions will appear once the response window closes.
          </p>
        )}
        {detailRow('Activity / Venue', venueValue)}
        {detailRow('Date', dateValue)}
        {detailRow('Per person', suggestions?.estimated_cost_per_person ?? null)}
        {detailRow('Duration', durationValue)}
        {(isOrganizer || event.inviter_email) &&
          detailRow('Organizer', isOrganizer ? 'You' : formatOrganizerName(event.inviter_email))}
      </div>

      {event.description && (
        <div>
          <span className="gf-label">Description</span>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
            {event.description}
          </p>
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
          <button type="button" className="gf-button gf-button--primary" disabled>
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
        {canAddToCalendar ? (
          <div style={{ position: 'relative' }} ref={calendarDropdownRef}>
            <button
              type="button"
              className="gf-button gf-button--ghost gf-inline-icon"
              onClick={() => setShowCalendarDropdown(!showCalendarDropdown)}
            >
              <Calendar size={14} /> Add to Calendar <ChevronDown size={12} />
            </button>
            {showCalendarDropdown && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '4px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '6px',
                  minWidth: '180px',
                  boxShadow: 'var(--shadow)',
                  zIndex: 10,
                }}
              >
                {calendarOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      opt.action();
                      setShowCalendarDropdown(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: '8px',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.08)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: '20px', textAlign: 'center', fontWeight: 700 }}>
                      {opt.icon}
                    </span>
                    {opt.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="gf-button gf-button--ghost gf-inline-icon"
            disabled
            style={{ opacity: 0.5 }}
            title="Available after event is confirmed"
          >
            <Calendar size={14} /> Add to Calendar
          </button>
        )}
        <button
          type="button"
          className="gf-button gf-button--ghost gf-inline-icon"
          title="Coming soon"
        >
          <Navigation size={14} /> Map &amp; Navigation
        </button>
        {isOrganizer && (
          <button
            type="button"
            className="gf-button gf-button--ghost gf-inline-icon"
            style={{ color: 'var(--error, #e53e3e)' }}
            onClick={handlePromptDelete}
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>

      <ConfirmationDialog
        open={isConfirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Event"
        description="Are you sure you want to permanently delete this event? This action cannot be undone."
        confirmText="Delete"
        isDestructive
        isLoading={deleting}
      />
    </div>
  );
}

type StatusFilter = 'all' | 'collecting' | 'options_ready' | 'finalized';

function TimelineView({
  events,
  initialEventId,
  onDelete,
  searchQuery,
  setSearchQuery,
}: {
  events: EventItem[];
  initialEventId?: string | null;
  onDelete: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialEventId && events.find((e) => e.id === initialEventId)) return initialEventId;
    return events[0]?.id ?? null;
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [animating, setAnimating] = useState(false);
  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLastUpdatedTimestamp(Date.now()), 100);
    return () => clearTimeout(timer);
  }, [events.length]);

  const filteredEvents = useMemo(() => {
    if (statusFilter === 'all') return events;
    return events.filter((e) => e.status === statusFilter);
  }, [events, statusFilter]);

  const grouped = useMemo(() => groupByDate(filteredEvents), [filteredEvents]);
  const selected = events.find((e) => e.id === selectedId) ?? filteredEvents[0] ?? null;

  const handleSelect = (id: string) => {
    setAnimating(true);
    setSelectedId(id);
    setTimeout(() => setAnimating(false), 150);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!filteredEvents.length) return;
      const currentIndex = filteredEvents.findIndex((ev) => ev.id === selectedId);
      if (e.key === 'ArrowDown' && currentIndex < filteredEvents.length - 1) {
        e.preventDefault();
        handleSelect(filteredEvents[currentIndex + 1].id);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        handleSelect(filteredEvents[currentIndex - 1].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredEvents, selectedId]);

  const filterButtons: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'collecting', label: 'Collecting' },
    { value: 'options_ready', label: 'Ready' },
    { value: 'finalized', label: 'Confirmed' },
  ];

  return (
    <div className="gf-timeline-layout">
      {/* Left: event list grouped by date */}
      <div className="gf-timeline-list">
        <h2 className="gf-section-title" style={{ marginBottom: '4px' }}>
          Timeline
        </h2>
        <p className="gf-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
          View and manage your events at a glance
        </p>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="gf-input"
            style={{
              paddingLeft: '38px',
              borderRadius: '999px',
              fontSize: '0.9rem',
              width: '100%',
            }}
          />
        </div>
        <div className="gf-timeline-filters" style={{ marginBottom: '16px' }}>
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              type="button"
              className={`gf-timeline-filter-btn${statusFilter === btn.value ? ' gf-timeline-filter-btn--active' : ''}`}
              onClick={() => setStatusFilter(btn.value)}
            >
              {btn.label}
            </button>
          ))}
        </div>
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={<CalendarPlus size={48} />}
            title={searchQuery ? 'No matching events' : 'No events yet'}
            description={
              searchQuery
                ? `We couldn't find any events matching "${searchQuery}".`
                : 'Get started by creating a new event for you and your friends.'
            }
            action={
              !searchQuery && (
                <Link to="/events/new" className="gf-button gf-button--primary">
                  Create New Event
                </Link>
              )
            }
          />
        ) : (
          <div ref={listRef}>
            {grouped.map(({ label, sublabel, events: evs }) => (
              <div key={label} style={{ marginBottom: '16px' }}>
                <div className="gf-timeline-group__date" title={sublabel}>
                  {label}
                  <span className="gf-timeline-group__sublabel">{sublabel}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {evs.map((ev) => {
                    const s = STATUS_LABELS[ev.status] || { label: ev.status, cls: '' };
                    return (
                      <button
                        key={ev.id}
                        onClick={() => handleSelect(ev.id)}
                        className={`gf-timeline-card${selected?.id === ev.id ? ' gf-timeline-card--selected' : ''}`}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '4px',
                          }}
                        >
                          <p className="gf-timeline-card__title" style={{ margin: 0 }}>
                            {ev.title}
                          </p>
                          <span
                            className={`gf-status-chip ${s.cls}`}
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                          >
                            {s.label}
                          </span>
                        </div>
                        {ev.inviter_id !== getCurrentUserId() && ev.inviter_email && (
                          <p
                            className="gf-muted"
                            style={{ fontSize: '0.75rem', marginBottom: '4px' }}
                          >
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
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="gf-timeline-updated">
          Updated{' '}
          {new Date(lastUpdatedTimestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Right: detail panel */}
      <div className={animating ? 'gf-timeline-detail--animating' : ''}>
        {selected ? (
          <TimelineDetail key={selected.id} event={selected} onDelete={onDelete} />
        ) : (
          <div className="gf-card">
            <p className="gf-muted">Select an event to view details.</p>
          </div>
        )}
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
  const tab = (searchParams.get('tab') === 'notifications' ? 'notifications' : 'timeline') as
    | 'timeline'
    | 'notifications';
  const [searchQuery, setSearchQuery] = useState('');

  function handleDeleteEvent(eventId: string) {
    setCreated((prev) => prev.filter((e) => e.id !== eventId));
    setJoined((prev) => prev.filter((e) => e.id !== eventId));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery('');
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('prefsUpdated')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast('Preferences updated');
      setSearchParams({}, { replace: true });
      const t = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(t);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!getCurrentUserId()) {
      navigate('/?auth=1&returnTo=/dashboard', { replace: true });
      return;
    }
    api
      .get<{ created: EventItem[]; joined: EventItem[] }>('/events')
      .then((data) => {
        setCreated(data.created);
        setJoined(data.joined);
      })
      .catch(() => setError('Could not load the dashboard.'))
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      api
        .get<{ created: EventItem[]; joined: EventItem[] }>('/events')
        .then((data) => {
          setCreated((prev) =>
            prev.length === data.created.length &&
            prev.every(
              (e, i) =>
                e.id === data.created[i].id &&
                e.status === data.created[i].status &&
                JSON.stringify(e.ai_suggestions) ===
                  JSON.stringify(data.created[i].ai_suggestions) &&
                e.inviter_email === data.created[i].inviter_email &&
                e.archived === data.created[i].archived &&
                e.respondent_count === data.created[i].respondent_count &&
                JSON.stringify(e.selected_activity) ===
                  JSON.stringify(data.created[i].selected_activity)
            )
              ? prev
              : data.created
          );
          setJoined((prev) =>
            prev.length === data.joined.length &&
            prev.every(
              (e, i) =>
                e.id === data.joined[i].id &&
                e.status === data.joined[i].status &&
                JSON.stringify(e.ai_suggestions) ===
                  JSON.stringify(data.joined[i].ai_suggestions) &&
                e.inviter_email === data.joined[i].inviter_email &&
                e.archived === data.joined[i].archived &&
                e.respondent_count === data.joined[i].respondent_count &&
                JSON.stringify(e.selected_activity) ===
                  JSON.stringify(data.joined[i].selected_activity)
            )
              ? prev
              : data.joined
          );
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [navigate]);

  const matchesSearch = useCallback(
    (e: EventItem) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (e.title?.toLowerCase() || '').includes(q) ||
        (e.description?.toLowerCase().includes(q) ?? false)
      );
    },
    [searchQuery]
  );

  if (loading) {
    return (
      <div className="gf-stack gf-stack--xl">
        <div className="gf-tabs" style={{ marginBottom: '8px' }}>
          <div className="gf-skeleton--button" style={{ width: '100px' }} />
          <div className="gf-skeleton--button" style={{ width: '100px' }} />
        </div>
        <section className="gf-stack">
          <div className="gf-skeleton--heading" style={{ width: '200px' }} />
          <div className="gf-grid gf-grid--two">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </section>
      </div>
    );
  }

  const timelineEvents = [...created, ...joined].filter((e) => !e.archived && matchesSearch(e));

  return (
    <div className="gf-stack gf-stack--xl">
      {toast && <p className="gf-feedback gf-feedback--success">✓ {toast}</p>}
      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      <div className="gf-tabs" style={{ marginBottom: '8px' }}>
        <button
          type="button"
          className={`gf-tab ${tab === 'timeline' ? 'gf-tab--active' : ''}`}
          onClick={() => setSearchParams({ tab: 'timeline' })}
        >
          <span className="gf-inline-icon">
            <Clock size={16} /> Timeline
          </span>
        </button>
        <button
          type="button"
          className={`gf-tab ${tab === 'notifications' ? 'gf-tab--active' : ''}`}
          onClick={() => setSearchParams({ tab: 'notifications' })}
        >
          <span className="gf-inline-icon">
            <Bell size={16} /> Notifications
          </span>
        </button>
      </div>

      {tab === 'notifications' && (
        <>
          <NotificationsView created={created} joined={joined} />
        </>
      )}

      {tab === 'timeline' && (
        <TimelineView
          events={timelineEvents}
          initialEventId={searchParams.get('event')}
          onDelete={handleDeleteEvent}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}
    </div>
  );
}
