import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  MapPin,
  Calendar,
  Navigation,
  Search,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
} from 'lucide-react';
import { api, getCurrentUserId } from '../api/client';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/SkeletonLoader';
import ShareEvent from '../components/ShareEvent';
import { getCalendarOptions, type CalendarEvent } from '../lib/calendar';

// ── Types ────────────────────────────────────────────────────────────────────

interface EventSuggestions {
  venue_ideas: string[];
  estimated_cost_per_person: string;
  estimated_duration_minutes: number;
  suggested_time: string;
  suggested_day: string;
}

interface Respondent {
  id: string;
  email: string;
  available_dates: { date: string; start_time: string; end_time: string }[];
  responded_at: string;
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

interface TimelineDetailProps {
  event: EventItem;
  onDelete?: (id: string) => void;
  onClose?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  collecting: { label: 'Collecting', cls: 'gf-status-chip--collecting' },
  generating: { label: 'Generating', cls: 'gf-status-chip--generating' },
  options_ready: { label: 'Pick activity', cls: 'gf-status-chip--ready' },
  finalized: { label: 'Confirmed', cls: 'gf-status-chip--finalized' },
};

// ── Utility functions ──────────────────────────────────────────────────────────

function formatOrganizerName(email?: string | null): string {
  if (!email) return 'Unknown';
  return email;
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

function formatRemaining(ms: number) {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ── State-specific detail components ──────────────────────────────────────────

function TimelineDetailCollecting({ event, onClose }: TimelineDetailProps) {
  const navigate = useNavigate();
  const isOrganizer = event.inviter_id === getCurrentUserId();

  const [now, setNow] = useState(() => Date.now());
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [loadingRespondents, setLoadingRespondents] = useState(isOrganizer);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isOrganizer) return;
    api
      .get<{ respondents: Respondent[] }>(`/events/${event.id}/respondents`)
      .then((d) => setRespondents(d.respondents))
      .catch(() => {})
      .finally(() => setLoadingRespondents(false));
  }, [event.id, isOrganizer]);

  const remaining = event.response_window_end
    ? new Date(event.response_window_end).getTime() - now
    : 0;
  const expired = remaining <= 0;

  return (
    <div className="gf-card gf-timeline-detail-card">
      {/* Header */}
      <div className="gf-timeline-detail-header" onClick={onClose} style={{ cursor: 'pointer' }}>
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.inviter_email && !isOrganizer && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              by {formatOrganizerName(event.inviter_email)}
            </p>
          )}
        </div>
        <div className="gf-timeline-card__right">
          <span
            className={`gf-status-chip ${expired ? 'gf-status-chip--ready' : STATUS_LABELS.collecting.cls}`}
            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
          >
            {expired ? 'Ready' : 'Collecting'}
          </span>
          <ChevronUp
            size={16}
            className="gf-timeline-card__chevron gf-timeline-card__chevron--expanded"
          />
        </div>
      </div>

      {/* Countdown */}
      <div className="gf-timeline-detail-countdown">
        <span className={`gf-countdown${expired ? ' gf-countdown--expired' : ''}`}>
          {expired ? 'Ready' : formatRemaining(remaining)}
        </span>
        <span className="gf-countdown__label">
          {expired ? 'Response window closed' : 'remaining'}
        </span>
      </div>

      {/* Organizer View */}
      {isOrganizer ? (
        <div className="gf-stack gf-stack--sm">
          {/* Respondents */}
          <div className="gf-timeline-detail-section">
            <h4 className="gf-timeline-detail-section-title">
              <Users size={14} /> Respondents ({respondents.length})
            </h4>
            {loadingRespondents ? (
              <div className="gf-timeline-detail-loading">
                <Loader2 size={16} className="gf-loading-spinner__icon" />
                <span className="gf-muted" style={{ fontSize: '0.85rem' }}>
                  Loading...
                </span>
              </div>
            ) : respondents.length === 0 ? (
              <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
                No responses yet.
              </p>
            ) : (
              <div className="gf-timeline-detail-respondents">
                {respondents.map((r) => (
                  <div key={r.id} className="gf-timeline-detail-respondent">
                    <span className="gf-timeline-detail-respondent__name">{r.email}</span>
                    <div className="gf-timeline-detail-respondent__dates">
                      {r.available_dates.map((d) => (
                        <span
                          key={d.date}
                          className="gf-chip gf-chip--active"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        >
                          {prettyDate(d.date)} {d.start_time}–{d.end_time}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compact Share */}
          <ShareEvent eventId={event.id} eventTitle={event.title} compact />
        </div>
      ) : (
        <div className="gf-timeline-detail-waiting">
          <p className="gf-muted" style={{ fontSize: '0.9rem' }}>
            Waiting for the group... The organizer will pick a time once responses are collected.
          </p>
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <button
        type="button"
        className="gf-button gf-button--secondary"
        style={{ width: '100%' }}
        onClick={() => navigate(`/events/${event.id}`)}
      >
        View full event
      </button>
    </div>
  );
}

function TimelineDetailReady({ event, onClose }: TimelineDetailProps) {
  const navigate = useNavigate();
  const isOrganizer = event.inviter_id === getCurrentUserId();

  return (
    <div className="gf-card gf-timeline-detail-card">
      {/* Header */}
      <div className="gf-timeline-detail-header" onClick={onClose} style={{ cursor: 'pointer' }}>
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.inviter_email && !isOrganizer && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              by {formatOrganizerName(event.inviter_email)}
            </p>
          )}
        </div>
        <div className="gf-timeline-card__right">
          <span
            className={`gf-status-chip ${STATUS_LABELS.options_ready.cls}`}
            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
          >
            Ready
          </span>
          <ChevronUp
            size={16}
            className="gf-timeline-card__chevron gf-timeline-card__chevron--expanded"
          />
        </div>
      </div>

      {/* Content */}
      <div className="gf-timeline-detail-ready">
        <div className="gf-timeline-detail-ready__icon">✨</div>
        <h4 className="gf-timeline-detail-ready__title">Activity options are ready!</h4>
        <p className="gf-muted" style={{ fontSize: '0.9rem', textAlign: 'center' }}>
          {isOrganizer
            ? 'The AI has created activity suggestions for your group.'
            : 'The organizer will review and pick the final activity soon.'}
        </p>
      </div>

      {isOrganizer ? (
        <button
          type="button"
          className="gf-button gf-button--primary"
          onClick={() => navigate(`/events/${event.id}/options`)}
        >
          Pick Activity
        </button>
      ) : (
        <p className="gf-timeline-detail-ready__waiting">
          Waiting for organizer to make a decision...
        </p>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <button
        type="button"
        className="gf-button gf-button--secondary"
        style={{ width: '100%' }}
        onClick={() => navigate(`/events/${event.id}`)}
      >
        View full event
      </button>
    </div>
  );
}

function TimelineDetailConfirmed({ event, onClose }: TimelineDetailProps) {
  const navigate = useNavigate();
  const isOrganizer = event.inviter_id === getCurrentUserId();

  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const calendarDropdownRef = useRef<HTMLDivElement>(null);

  const selectedActivity = event.selected_activity;
  const suggestedDate = selectedActivity?.suggested_date || event.preferred_date;
  const suggestedTime = selectedActivity?.suggested_time || event.preferred_time;

  const calendarEvent: CalendarEvent | null = suggestedDate
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

  return (
    <div className="gf-card gf-timeline-detail-card">
      {/* Header */}
      <div className="gf-timeline-detail-header" onClick={onClose} style={{ cursor: 'pointer' }}>
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.inviter_email && !isOrganizer && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              by {formatOrganizerName(event.inviter_email)}
            </p>
          )}
        </div>
        <div className="gf-timeline-card__right">
          <span
            className={`gf-status-chip ${STATUS_LABELS.finalized.cls}`}
            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
          >
            Confirmed
          </span>
          <ChevronUp
            size={16}
            className="gf-timeline-card__chevron gf-timeline-card__chevron--expanded"
          />
        </div>
      </div>

      {/* Selected Activity */}
      {selectedActivity ? (
        <div className="gf-timeline-detail-activity">
          <div className="gf-timeline-detail-activity__icon">🎯</div>
          <div className="gf-timeline-detail-activity__info">
            <h4 className="gf-timeline-detail-activity__title">{selectedActivity.title}</h4>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              {prettyDateFull(selectedActivity.suggested_date)}
              {selectedActivity.suggested_time && ` at ${selectedActivity.suggested_time}`}
            </p>
          </div>
        </div>
      ) : (
        <p className="gf-muted" style={{ fontSize: '0.9rem' }}>
          No activity selected yet.
        </p>
      )}

      {event.description && (
        <div className="gf-timeline-detail-section">
          <h4 className="gf-timeline-detail-section-title">Description</h4>
          <p className="gf-muted" style={{ fontSize: '0.9rem' }}>
            {event.description}
          </p>
        </div>
      )}

      <div className="gf-timeline-detail-confirmed-actions">
        <button
          type="button"
          className="gf-button gf-button--primary"
          onClick={() => navigate(`/events/${event.id}/confirmation`)}
        >
          View Confirmation
        </button>

        {selectedActivity && (
          <div style={{ position: 'relative' }} ref={calendarDropdownRef}>
            <button
              type="button"
              className="gf-button gf-button--ghost gf-inline-icon"
              onClick={() => setShowCalendarDropdown(!showCalendarDropdown)}
            >
              <Calendar size={14} /> Add to Calendar <ChevronDown size={12} />
            </button>
            {showCalendarDropdown && (
              <div className="gf-timeline-detail-calendar-dropdown">
                {calendarOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="gf-timeline-detail-calendar-option"
                    onClick={() => {
                      opt.action();
                      setShowCalendarDropdown(false);
                    }}
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
        )}

        <button
          type="button"
          className="gf-button gf-button--ghost gf-inline-icon"
          title="Coming soon"
        >
          <Navigation size={14} /> Map &amp; Navigation
        </button>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <button
        type="button"
        className="gf-button gf-button--secondary"
        style={{ width: '100%' }}
        onClick={() => navigate(`/events/${event.id}`)}
      >
        View full event
      </button>
    </div>
  );
}

function TimelineDetailGenerating({ event, onClose }: TimelineDetailProps) {
  const navigate = useNavigate();
  const isOrganizer = event.inviter_id === getCurrentUserId();

  return (
    <div className="gf-card gf-timeline-detail-card">
      {/* Header */}
      <div className="gf-timeline-detail-header" onClick={onClose} style={{ cursor: 'pointer' }}>
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.inviter_email && !isOrganizer && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              by {formatOrganizerName(event.inviter_email)}
            </p>
          )}
        </div>
        <div className="gf-timeline-card__right">
          <span
            className={`gf-status-chip ${STATUS_LABELS.generating.cls}`}
            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
          >
            Generating
          </span>
          <ChevronUp
            size={16}
            className="gf-timeline-card__chevron gf-timeline-card__chevron--expanded"
          />
        </div>
      </div>

      <div className="gf-timeline-detail-generating">
        <div className="gf-timeline-detail-generating__spinner">
          <Loader2 size={32} className="gf-loading-spinner__icon" />
        </div>
        <h4 className="gf-timeline-detail-generating__title">Creating activity options...</h4>
        <p className="gf-muted" style={{ fontSize: '0.85rem', textAlign: 'center' }}>
          {isOrganizer
            ? "You can safely leave this page. We'll notify you when options are ready."
            : 'The organizer will get the shortlist shortly. Check back soon!'}
        </p>
      </div>

      <button
        type="button"
        className="gf-button gf-button--secondary"
        onClick={() => navigate(`/events/${event.id}`)}
      >
        View Details
      </button>
    </div>
  );
}

function TimelineDetail({ event, onDelete, onClose }: TimelineDetailProps) {
  switch (event.status) {
    case 'collecting':
      return <TimelineDetailCollecting event={event} onDelete={onDelete} onClose={onClose} />;
    case 'options_ready':
      return <TimelineDetailReady event={event} onDelete={onDelete} onClose={onClose} />;
    case 'finalized':
      return <TimelineDetailConfirmed event={event} onDelete={onDelete} onClose={onClose} />;
    case 'generating':
      return <TimelineDetailGenerating event={event} onClose={onClose} />;
    default:
      return (
        <div className="gf-card gf-timeline-detail-card">
          <div
            onClick={onClose}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <p className="gf-muted" style={{ margin: 0 }}>
              Unknown event status: {event.status}
            </p>
            <ChevronUp size={16} className="gf-timeline-card__chevron" />
          </div>
        </div>
      );
  }
}

// ── Timeline helpers ───────────────────────────────────────────────────────────

function getEventDate(event: EventItem): string | null {
  return event.selected_activity?.suggested_date ?? event.preferred_date ?? null;
}

function getFriendlyDateLabel(
  dateStr: string,
  style: 'friendly' | 'numeric' | 'long' = 'friendly',
  dateFormat: string = 'MM/DD/YYYY'
): { label: string; sublabel: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const fullLabel = prettyDateFull(dateStr);

  if (style === 'long') {
    return { label: fullLabel, sublabel: '' };
  }

  if (style === 'numeric') {
    const parts = dateStr.split('-');
    const [y, m, day] = parts;
    const numericLabel = dateFormat.replace('YYYY', y).replace('MM', m).replace('DD', day);
    return { label: numericLabel, sublabel: fullLabel };
  }

  // friendly (default)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  if (d < today) return { label: 'Past', sublabel: fullLabel };
  if (d.getTime() === today.getTime()) return { label: 'Today', sublabel: fullLabel };
  if (d.getTime() === tomorrow.getTime()) return { label: 'Tomorrow', sublabel: fullLabel };
  if (d < nextWeek)
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'long' }),
      sublabel: fullLabel,
    };
  return {
    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sublabel: fullLabel,
  };
}

interface DateGroup {
  label: string;
  sublabel: string;
  rawDate: string | null;
  events: EventItem[];
}

function groupByDate(
  events: EventItem[],
  style: 'friendly' | 'numeric' | 'long' = 'friendly',
  dateFormat: string = 'MM/DD/YYYY'
): DateGroup[] {
  const map = new Map<string, DateGroup>();
  for (const ev of events) {
    const d = getEventDate(ev);
    const key = d ? d.split('T')[0] : 'unscheduled';
    if (!map.has(key)) {
      const friendly =
        key !== 'unscheduled'
          ? getFriendlyDateLabel(key, style, dateFormat)
          : { label: 'Unscheduled', sublabel: '' };
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

// ── TimelineView ───────────────────────────────────────────────────────────────

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
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    if (initialEventId && events.find((e) => e.id === initialEventId)) return initialEventId;
    return null;
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);

  const { dateDisplayStyle, dateFormat } = useMemo(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('gofish_preferences') ?? '{}');
      return {
        dateDisplayStyle: (prefs?.regional?.date_display_style ?? 'friendly') as
          | 'friendly'
          | 'numeric'
          | 'long',
        dateFormat: (prefs?.regional?.date_format ?? 'MM/DD/YYYY') as string,
      };
    } catch {
      return { dateDisplayStyle: 'friendly' as const, dateFormat: 'MM/DD/YYYY' };
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLastUpdatedTimestamp(Date.now()), 100);
    return () => clearTimeout(timer);
  }, [events.length]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isExpiredCollecting = useCallback(
    (e: EventItem) =>
      e.status === 'collecting' &&
      !!e.response_window_end &&
      new Date(e.response_window_end).getTime() <= now,
    [now]
  );

  const filteredEvents = useMemo(() => {
    if (statusFilter === 'all') return events;
    if (statusFilter === 'options_ready')
      return events.filter(
        (e) => e.status === 'options_ready' || e.status === 'generating' || isExpiredCollecting(e)
      );
    if (statusFilter === 'collecting')
      return events.filter(
        (e) =>
          e.status === 'collecting' &&
          (!e.response_window_end || new Date(e.response_window_end).getTime() > now)
      );
    return events.filter((e) => e.status === statusFilter);
  }, [events, statusFilter, now, isExpiredCollecting]);

  const grouped = useMemo(
    () => groupByDate(filteredEvents, dateDisplayStyle, dateFormat),
    [filteredEvents, dateDisplayStyle, dateFormat]
  );

  // Flat list in the exact visual order (date-sorted groups, events within each group)
  const orderedEvents = useMemo(() => grouped.flatMap((g) => g.events), [grouped]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!orderedEvents.length) return;
      const currentIndex = orderedEvents.findIndex((ev) => ev.id === expandedId);
      if (e.key === 'ArrowDown' && currentIndex < orderedEvents.length - 1) {
        e.preventDefault();
        setExpandedId(orderedEvents[currentIndex + 1].id);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        setExpandedId(orderedEvents[currentIndex - 1].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orderedEvents, expandedId]);

  const filterButtons: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'collecting', label: 'Collecting' },
    { value: 'options_ready', label: 'Ready' },
    { value: 'finalized', label: 'Confirmed' },
  ];

  return (
    <div className="gf-timeline-layout gf-timeline-layout--single">
      <div className="gf-timeline-list">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <h2 className="gf-section-title" style={{ margin: 0 }}>
            Timeline
          </h2>
          <Link to="/events/new" className="gf-button gf-button--primary" style={{ gap: '6px' }}>
            <Plus size={16} /> New event
          </Link>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <p className="gf-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
            View and manage your events at a glance
          </p>
          <p
            className="gf-timeline-updated"
            style={{ margin: 0, paddingTop: 0, borderTop: 'none' }}
          >
            Updated{' '}
            {new Date(lastUpdatedTimestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
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
                <div className="gf-timeline-group__date" title={sublabel || label}>
                  {label}
                  {sublabel && <span className="gf-timeline-group__sublabel">{sublabel}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {evs.map((ev) => {
                    const s = isExpiredCollecting(ev)
                      ? { label: 'Ready', cls: 'gf-status-chip--ready' }
                      : STATUS_LABELS[ev.status] || { label: ev.status, cls: '' };
                    const isExpanded = expandedId === ev.id;

                    return (
                      <div
                        key={ev.id}
                        className={`gf-timeline-card-wrapper${isExpanded ? ' gf-timeline-card-wrapper--expanded' : ''}`}
                      >
                        {!isExpanded && (
                          <button
                            onClick={() => handleToggle(ev.id)}
                            className={`gf-timeline-card${isExpanded ? ' gf-timeline-card--selected gf-timeline-card--mobile-expanded' : ''}`}
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
                              <div className="gf-timeline-card__right">
                                <span
                                  className={`gf-status-chip ${s.cls}`}
                                  style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                >
                                  {s.label}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp size={16} className="gf-timeline-card__chevron" />
                                ) : (
                                  <ChevronDown size={16} className="gf-timeline-card__chevron" />
                                )}
                              </div>
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
                        )}

                        {isExpanded && (
                          <div className="gf-timeline-card__expanded-content">
                            <TimelineDetail
                              event={ev}
                              onDelete={onDelete}
                              onClose={() => handleToggle(ev.id)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [created, setCreated] = useState<EventItem[]>([]);
  const [joined, setJoined] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
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
    <>
      {toast && <p className="gf-feedback gf-feedback--success">✓ {toast}</p>}
      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      <TimelineView
        events={timelineEvents}
        initialEventId={searchParams.get('event')}
        onDelete={handleDeleteEvent}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </>
  );
}
