import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api, ApiError, getCurrentUserId } from '../api/client';
import ConfirmationDialog from '../components/ConfirmationDialog';
import OptionGenerationState from '../components/OptionGenerationState';
import ShareEvent from '../components/ShareEvent';

interface EventData {
  id: string;
  title: string;
  description: string;
  status: string;
  response_window_end: string;
  inviter_id: string;
  location_city?: string;
}
interface Respondent {
  id: string;
  email: string;
  available_dates: { date: string; start_time: string; end_time: string }[];
  responded_at: string;
}
interface ActivityOption {
  id: string;
  title: string;
  description: string;
  suggested_date: string;
  suggested_time: string | null;
  rank: number;
  is_selected: boolean;
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

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  const remaining = target ? new Date(target).getTime() - now : 0;
  return { remaining, expired: remaining <= 0 && !!target };
}

function prettyDate(d: string) {
  // Handle both "2025-02-15" and "2025-02-15T00:00:00.000Z" formats
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function EventDetail() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [options, setOptions] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReactNode>('');
  const [working, setWorking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isCreator = event?.inviter_id === getCurrentUserId();

  const fetchEvent = useCallback(() => {
    if (!eventId) return;
    api
      .get<EventData>(`/events/${eventId}`)
      .then(setEvent)
      .catch(() => setError('Could not load the event.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Poll every 5s
  useEffect(() => {
    if (!eventId || !isCreator) return;
    if (event?.status === 'finalized') return;
    const id = setInterval(() => {
      api
        .get<EventData>(`/events/${eventId}`)
        .then(setEvent)
        .catch(() => {});
      api
        .get<{ respondents: Respondent[] }>(`/events/${eventId}/respondents`)
        .then((d) => setRespondents(d.respondents))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [eventId, isCreator, event?.status]);

  useEffect(() => {
    if (!eventId || !isCreator) return;
    api
      .get<{ respondents: Respondent[] }>(`/events/${eventId}/respondents`)
      .then((d) => setRespondents(d.respondents))
      .catch(() => {});
  }, [eventId, isCreator]);

  useEffect(() => {
    if (!eventId || !event || event.status !== 'finalized') return;
    api
      .get<{ options: ActivityOption[] }>(`/events/${eventId}/options`)
      .then((d) => setOptions([...d.options].sort((a, b) => a.rank - b.rank)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, event?.status]);

  const { remaining, expired } = useCountdown(event?.response_window_end || '');

  const handleGenerate = useCallback(async () => {
    if (!eventId) return;
    setWorking(true);
    setError('');
    try {
      await api.post(`/events/${eventId}/generate`);
      const updated = await api.get<EventData>(`/events/${eventId}`);
      setEvent(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        api
          .get<EventData>(`/events/${eventId}`)
          .then(setEvent)
          .catch(() => {});
      } else if (
        err instanceof ApiError &&
        err.body &&
        typeof err.body === 'object' &&
        'error' in err.body &&
        err.body.error === 'NEEDS_API_KEY'
      ) {
        setError(
          <span>
            Add your API key in{' '}
            <a href="/settings?tab=infrastructure" style={{ color: 'var(--color-primary)' }}>
              Settings
            </a>{' '}
            to generate suggestions.
          </span>
        );
      } else {
        setError('Generation failed. Please try again.');
      }
    } finally {
      setWorking(false);
    }
  }, [eventId]);

  const handleDelete = useCallback(async () => {
    if (!eventId) return;
    setDeleting(true);
    try {
      await api.delete(`/events/${eventId}`);
      navigate('/dashboard');
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }, [eventId, navigate]);

  if (loading) return <p className="gf-muted">Loading event...</p>;
  if (error && !event) return <p className="gf-feedback gf-feedback--error">{error}</p>;
  if (!event) return <p className="gf-muted">Event not found.</p>;

  const statusChip =
    event.status === 'finalized'
      ? { label: 'Confirmed', cls: 'gf-status-chip--finalized' }
      : event.status === 'generating'
        ? { label: 'Generating', cls: 'gf-status-chip--generating' }
        : event.status === 'options_ready'
          ? { label: 'Pick activity', cls: 'gf-status-chip--ready' }
          : expired
            ? { label: 'Ready', cls: 'gf-status-chip--ready' }
            : { label: 'Collecting', cls: 'gf-status-chip--collecting' };

  // Finalized
  if (event.status === 'finalized') {
    const selected = options.find((o) => o.is_selected);
    return (
      <div className="gf-stack gf-stack--xl">
        <button type="button" className="gf-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="gf-section-title" style={{ margin: 0 }}>
              {event.title}
            </h2>
            <span className={`gf-status-chip ${statusChip.cls}`}>{statusChip.label}</span>
          </div>
          {event.location_city && (
            <p className="gf-muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>
              &#128205; {event.location_city}
            </p>
          )}
        </div>
        {selected ? (
          <div className="gf-card gf-option-card gf-option-card--featured">
            <h3 className="gf-card-title">{selected.title}</h3>
            <p className="gf-muted">
              {prettyDate(selected.suggested_date)}
              {selected.suggested_time ? ` at ${selected.suggested_time}` : ''}
            </p>
            <p>{selected.description}</p>
          </div>
        ) : (
          <div className="gf-card">
            <p className="gf-muted">This event has been finalized.</p>
          </div>
        )}
        <div className="gf-actions gf-text-center" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="gf-button gf-button--primary"
            onClick={() => navigate(`/events/${event.id}/confirmation`)}
          >
            View confirmation
          </button>
          <button
            type="button"
            className="gf-button gf-button--ghost"
            onClick={() => navigate(`/dashboard?tab=timeline&event=${event.id}`)}
          >
            View in Timeline
          </button>
        </div>
      </div>
    );
  }

  // Generating
  if (event.status === 'generating') {
    return (
      <div className="gf-stack gf-stack--xl">
        <button type="button" className="gf-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="gf-section-title" style={{ margin: 0 }}>
              {event.title}
            </h2>
            <span className={`gf-status-chip ${statusChip.cls}`}>{statusChip.label}</span>
          </div>
        </div>
        <OptionGenerationState
          detail={
            isCreator
              ? 'You can safely leave this page. The shortlist will be ready for you to review shortly.'
              : 'The organizer will get the shortlist shortly. You can leave this page and check back later.'
          }
        />
      </div>
    );
  }

  // Options Ready
  if (event.status === 'options_ready') {
    return (
      <div className="gf-stack gf-stack--xl">
        <button type="button" className="gf-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="gf-section-title" style={{ margin: 0 }}>
              {event.title}
            </h2>
            <span className={`gf-status-chip ${statusChip.cls}`}>{statusChip.label}</span>
          </div>
          {event.location_city && (
            <p className="gf-muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>
              &#128205; {event.location_city}
            </p>
          )}
        </div>
        <div className="gf-card gf-text-center" style={{ padding: '40px 20px' }}>
          <h3 className="gf-card-title">Options are ready</h3>
          <p className="gf-muted" style={{ marginBottom: '24px' }}>
            The AI has created activity suggestions for your group.
          </p>
          {isCreator ? (
            <button
              type="button"
              className="gf-button gf-button--primary"
              onClick={() => navigate(`/events/${event.id}/options`)}
            >
              Pick activity
            </button>
          ) : (
            <p className="gf-muted" style={{ fontWeight: 500, color: 'var(--accent)' }}>
              Waiting for the organizer to pick the final activity...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Collecting responses (main state)
  return (
    <div className="gf-stack gf-stack--xl">
      <button type="button" className="gf-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        Back
      </button>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="gf-section-title" style={{ margin: 0 }}>
            {event.title}
          </h2>
          <span className={`gf-status-chip ${statusChip.cls}`}>{statusChip.label}</span>
        </div>
        {event.description && <p className="gf-muted">{event.description}</p>}
        {event.location_city && (
          <p className="gf-muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>
            &#128205; {event.location_city}
          </p>
        )}
      </div>

      <div className="gf-stack gf-stack--sm" style={{ alignItems: 'center' }}>
        <span className={`gf-countdown${expired ? ' gf-countdown--expired' : ''}`}>
          {expired ? 'Ready' : formatRemaining(remaining)}
        </span>
        <span className="gf-countdown__label">
          {expired ? 'Response window closed' : 'remaining'}
        </span>
      </div>

      {!isCreator && (
        <div className="gf-card gf-text-center" style={{ padding: '32px 20px' }}>
          <h3 className="gf-card-title">Waiting for the group...</h3>
          <p className="gf-muted">
            The organizer is still collecting responses. Options will be generated once the time is
            up.
          </p>
        </div>
      )}

      {isCreator && (
        <div className="gf-card">
          <div className="gf-stack">
            <h3 className="gf-card-title">Respondents ({respondents.length})</h3>
            {respondents.length === 0 ? (
              <p className="gf-muted">No respondents yet.</p>
            ) : (
              <div className="gf-respondent-list">
                {respondents.map((r) => (
                  <div className="gf-respondent" key={r.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="gf-respondent__name">{r.email}</span>
                      <div className="gf-respondent__dates">
                        {r.available_dates.map((d) => (
                          <span className="gf-chip gf-chip--active" key={d.date}>
                            {prettyDate(d.date)} {d.start_time}–{d.end_time}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isCreator && (
        <ShareEvent
          eventId={event.id}
          eventTitle={event.title}
          eventCity={event.location_city}
          inline
        />
      )}

      {isCreator && (
        <button
          type="button"
          className="gf-button gf-button--primary"
          disabled={working}
          onClick={handleGenerate}
        >
          {working
            ? 'Generating...'
            : expired
              ? 'Generate now'
              : `End window & generate${respondents.length > 0 ? ` (${respondents.length} responded)` : ''}`}
        </button>
      )}

      {isCreator && (
        <button
          type="button"
          className="gf-button gf-button--danger"
          disabled={deleting}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 size={15} /> Delete event
        </button>
      )}

      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      <ConfirmationDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
        title="Delete Event"
        description="Are you sure you want to permanently delete this event? This action cannot be undone."
        confirmText="Delete"
        isDestructive
        isLoading={deleting}
      />
    </div>
  );
}
