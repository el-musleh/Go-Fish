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
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api, ApiError, getCurrentUserId } from '../api/client';
import ConfirmationDialog from '../components/ConfirmationDialog';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/SkeletonLoader';
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
  onCloseMobile?: () => void;
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

/**
 * TimelineDetailCollecting
 * Shown when event status is "collecting"
 * - Countdown timer
 * - Share button (for organizers)
 * - Respondents list with date chips
 * - "Waiting" message (for participants)
 */
function TimelineDetailCollecting({ event, onDelete }: TimelineDetailProps) {
  const navigate = useNavigate();
  const isOrganizer = event.inviter_id === getCurrentUserId();

  const [now, setNow] = useState(() => Date.now());
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [loadingRespondents, setLoadingRespondents] = useState(true);
  const [working, setWorking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isOrganizer) {
      setLoadingRespondents(false);
      return;
    }
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

  const handleGenerateOptions = useCallback(async () => {
    if (working) return;
    setWorking(true);
    try {
      await api.post(`/events/${event.id}/generate`);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) {
        console.error('Failed to trigger generation:', err);
      }
    } finally {
      setWorking(false);
    }
  }, [event.id, working]);

  const autoGenerateAttempted = useRef(false);
  useEffect(() => {
    if (isOrganizer && !expired && !working && !autoGenerateAttempted.current) {
      return;
    }
    if (isOrganizer && expired && !working && !autoGenerateAttempted.current) {
      autoGenerateAttempted.current = true;
      handleGenerateOptions();
    }
  }, [isOrganizer, expired, working, handleGenerateOptions]);

  function handlePromptDelete() {
    setConfirmingDelete(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/events/${event.id}`);
      onDelete?.(event.id);
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div
      className="gf-card gf-timeline-detail-card"
      style={{
        opacity: deleting ? 0.5 : 1,
        pointerEvents: deleting ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <div className="gf-timeline-detail-header">
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.inviter_email && !isOrganizer && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              by {formatOrganizerName(event.inviter_email)}
            </p>
          )}
        </div>
        <span className={`gf-status-chip ${STATUS_LABELS.collecting.cls}`}>Collecting</span>
      </div>

      {/* Countdown Section */}
      <div className="gf-timeline-detail-countdown">
        <span className={`gf-countdown${expired ? ' gf-countdown--expired' : ''}`}>
          {expired ? 'Generating...' : formatRemaining(remaining)}
        </span>
        <span className="gf-countdown__label">
          {expired ? 'Response window closed' : 'remaining'}
        </span>
      </div>

      {/* Organizer View: Share & Respondents */}
      {isOrganizer ? (
        <div className="gf-stack gf-stack--sm">
          {/* Share prompt */}
          <div className="gf-timeline-detail-share">
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              Share with your group to collect RSVPs
            </p>
            <button
              type="button"
              className="gf-button gf-button--secondary"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              Share Invite
            </button>
          </div>

          {/* Respondents List */}
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

          {/* End window button */}
          <button
            type="button"
            className="gf-button gf-button--secondary"
            disabled={working}
            onClick={handleGenerateOptions}
          >
            {working ? 'Generating…' : 'End window & generate'}
          </button>
        </div>
      ) : (
        /* Participant View */
        <div className="gf-timeline-detail-waiting">
          <p className="gf-muted" style={{ fontSize: '0.9rem' }}>
            Waiting for the group... The organizer will pick a time once responses are collected.
          </p>
          <button
            type="button"
            className="gf-button gf-button--primary"
            onClick={() => navigate(`/events/${event.id}`)}
          >
            View Details
          </button>
        </div>
      )}

      {/* Actions */}
      {isOrganizer && (
        <div className="gf-timeline-detail-actions">
          <button
            type="button"
            className="gf-button gf-button--ghost gf-inline-icon"
            style={{ color: 'var(--danger, #e53e3e)' }}
            onClick={handlePromptDelete}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

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

/**
 * TimelineDetailReady
 * Shown when event status is "options_ready"
 * - "Options ready" message
 * - CTA to pick activity (for organizers)
 * - "Waiting" message (for participants)
 */
function TimelineDetailReady({ event, onDelete }: TimelineDetailProps) {
  const navigate = useNavigate();
  const isOrganizer = event.inviter_id === getCurrentUserId();

  const [deleting, setDeleting] = useState(false);
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);

  function handlePromptDelete() {
    setConfirmingDelete(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/events/${event.id}`);
      onDelete?.(event.id);
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div
      className="gf-card gf-timeline-detail-card"
      style={{
        opacity: deleting ? 0.5 : 1,
        pointerEvents: deleting ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <div className="gf-timeline-detail-header">
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.inviter_email && !isOrganizer && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              by {formatOrganizerName(event.inviter_email)}
            </p>
          )}
        </div>
        <span className={`gf-status-chip ${STATUS_LABELS.options_ready.cls}`}>Ready</span>
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

      {/* CTA */}
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

      {/* Actions */}
      {isOrganizer && (
        <div className="gf-timeline-detail-actions">
          <button
            type="button"
            className="gf-button gf-button--ghost gf-inline-icon"
            style={{ color: 'var(--danger, #e53e3e)' }}
            onClick={handlePromptDelete}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

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

/**
 * TimelineDetailConfirmed
 * Shown when event status is "finalized"
 * - Selected activity info
 * - Add to Calendar dropdown
 * - Map & Navigation button
 * - View confirmation CTA
 */
function TimelineDetailConfirmed({ event, onDelete }: TimelineDetailProps) {
  const navigate = useNavigate();
  const isOrganizer = event.inviter_id === getCurrentUserId();

  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const calendarDropdownRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);

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

  function handlePromptDelete() {
    setConfirmingDelete(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/events/${event.id}`);
      onDelete?.(event.id);
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div
      className="gf-card gf-timeline-detail-card"
      style={{
        opacity: deleting ? 0.5 : 1,
        pointerEvents: deleting ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <div className="gf-timeline-detail-header">
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.inviter_email && !isOrganizer && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              by {formatOrganizerName(event.inviter_email)}
            </p>
          )}
        </div>
        <span className={`gf-status-chip ${STATUS_LABELS.finalized.cls}`}>Confirmed</span>
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

      {/* Description */}
      {event.description && (
        <div className="gf-timeline-detail-section">
          <h4 className="gf-timeline-detail-section-title">Description</h4>
          <p className="gf-muted" style={{ fontSize: '0.9rem' }}>
            {event.description}
          </p>
        </div>
      )}

      {/* Actions */}
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

      {/* Organizer delete */}
      {isOrganizer && (
        <div className="gf-timeline-detail-actions">
          <button
            type="button"
            className="gf-button gf-button--ghost gf-inline-icon"
            style={{ color: 'var(--danger, #e53e3e)' }}
            onClick={handlePromptDelete}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

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

/**
 * TimelineDetailGenerating
 * Shown when event status is "generating"
 * - Loading animation
 * - Status message
 */
function TimelineDetailGenerating({ event, onCloseMobile }: TimelineDetailProps) {
  const navigate = useNavigate();
  const isOrganizer = event.inviter_id === getCurrentUserId();
  void onCloseMobile; // Used for future mobile close button

  return (
    <div className="gf-card gf-timeline-detail-card">
      {/* Header */}
      <div className="gf-timeline-detail-header">
        <div>
          <h3 className="gf-card-title">{event.title}</h3>
          {event.inviter_email && !isOrganizer && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              by {formatOrganizerName(event.inviter_email)}
            </p>
          )}
        </div>
        <span className={`gf-status-chip ${STATUS_LABELS.generating.cls}`}>Generating</span>
      </div>

      {/* Loading State */}
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

/**
 * TimelineDetail
 * Routes to the appropriate state-specific component based on event.status
 */
function TimelineDetail({ event, onDelete, onCloseMobile }: TimelineDetailProps) {
  switch (event.status) {
    case 'collecting':
      return <TimelineDetailCollecting event={event} onDelete={onDelete} />;
    case 'options_ready':
      return <TimelineDetailReady event={event} onDelete={onDelete} />;
    case 'finalized':
      return <TimelineDetailConfirmed event={event} onDelete={onDelete} />;
    case 'generating':
      return <TimelineDetailGenerating event={event} onCloseMobile={onCloseMobile} />;
    default:
      return (
        <div className="gf-card gf-timeline-detail-card">
          <p className="gf-muted">Unknown event status: {event.status}</p>
        </div>
      );
  }
}

// ── Timeline helpers ───────────────────────────────────────────────────────────

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
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialEventId && events.find((e) => e.id === initialEventId)) return initialEventId;
    return events[0]?.id ?? null;
  });
  const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [animating, setAnimating] = useState(false);
  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState(() => Date.now());
  const [isMobile, setIsMobile] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 720);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const handleSelect = useCallback(
    (id: string) => {
      setAnimating(true);
      setSelectedId(id);
      // On mobile, also expand the selected card
      if (isMobile) {
        setExpandedMobileId(id);
      }
      setTimeout(() => setAnimating(false), 150);
    },
    [isMobile]
  );

  const handleToggleMobile = (id: string) => {
    if (expandedMobileId === id) {
      setExpandedMobileId(null);
    } else {
      setExpandedMobileId(id);
      setSelectedId(id);
    }
  };

  const handleCloseMobile = () => {
    setExpandedMobileId(null);
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
  }, [filteredEvents, selectedId, handleSelect]);

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
                    const isExpanded = expandedMobileId === ev.id;

                    return (
                      <div
                        key={ev.id}
                        className={`gf-timeline-card-wrapper${isExpanded ? ' gf-timeline-card-wrapper--expanded' : ''}`}
                      >
                        <button
                          onClick={() =>
                            isMobile ? handleToggleMobile(ev.id) : handleSelect(ev.id)
                          }
                          className={`gf-timeline-card${!isMobile && selected?.id === ev.id ? ' gf-timeline-card--selected' : ''}${isMobile && isExpanded ? ' gf-timeline-card--mobile-expanded' : ''}`}
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
                              {isMobile && (
                                <ChevronRight
                                  size={16}
                                  className={`gf-timeline-card__chevron${isExpanded ? ' gf-timeline-card__chevron--expanded' : ''}`}
                                />
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

                        {/* Mobile accordion content */}
                        {isMobile && isExpanded && (
                          <div className="gf-timeline-card__expanded-content">
                            <TimelineDetail
                              event={ev}
                              onDelete={onDelete}
                              onCloseMobile={handleCloseMobile}
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
        <p className="gf-timeline-updated">
          Updated{' '}
          {new Date(lastUpdatedTimestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Right: detail panel (desktop only) */}
      {!isMobile && (
        <div className={animating ? 'gf-timeline-detail--animating' : ''}>
          {selected ? (
            <TimelineDetail key={selected.id} event={selected} onDelete={onDelete} />
          ) : (
            <div className="gf-card">
              <p className="gf-muted">Select an event to view details.</p>
            </div>
          )}
        </div>
      )}
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
    <div className="gf-stack gf-stack--xl">
      {toast && <p className="gf-feedback gf-feedback--success">✓ {toast}</p>}
      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      <TimelineView
        events={timelineEvents}
        initialEventId={searchParams.get('event')}
        onDelete={handleDeleteEvent}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </div>
  );
}
