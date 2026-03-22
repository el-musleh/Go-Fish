import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, getCurrentUserId } from '../api/client';
import InvitationLinkPanel from './InvitationLinkPanel';

interface EventData { id: string; title: string; description: string; status: string; response_window_end: string; inviter_id: string; location_city?: string; }
interface Respondent { id: string; email: string; available_dates: { date: string; start_time: string; end_time: string }[]; responded_at: string; }
interface ActivityOption { id: string; title: string; description: string; suggested_date: string; suggested_time: string | null; rank: number; is_selected: boolean; }

function formatRemaining(ms: number) {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function useCountdown(target: string) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(new Date(target).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return { remaining, expired: remaining <= 0 && !!target };
}

function prettyDate(d: string) {
  // Handle both "2025-02-15" and "2025-02-15T00:00:00.000Z" formats
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EventDetail() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [options, setOptions] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCreator = event?.inviter_id === getCurrentUserId();

  const fetchEvent = useCallback(() => {
    if (!eventId) return;
    api.get<EventData>(`/events/${eventId}`).then(setEvent).catch(() => setError('Could not load the event.')).finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  // Poll every 5s
  useEffect(() => {
    if (!eventId || !isCreator) return;
    if (event?.status === 'finalized') return;
    const id = setInterval(() => {
      api.get<EventData>(`/events/${eventId}`).then(setEvent).catch(() => {});
      api.get<{ respondents: Respondent[] }>(`/events/${eventId}/respondents`).then(d => setRespondents(d.respondents)).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [eventId, isCreator, event?.status]);

  useEffect(() => {
    if (!eventId || !isCreator) return;
    api.get<{ respondents: Respondent[] }>(`/events/${eventId}/respondents`).then(d => setRespondents(d.respondents)).catch(() => {});
  }, [eventId, isCreator]);

  useEffect(() => {
    if (!eventId || !event || event.status !== 'finalized') return;
    api.get<{ options: ActivityOption[] }>(`/events/${eventId}/options`).then(d => setOptions([...d.options].sort((a, b) => a.rank - b.rank))).catch(() => {});
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
      // If the backend scheduler automatically triggered generation at the exact same time, gracefully handle the 409 Conflict
      if (err instanceof ApiError && err.status === 409) {
        api.get<EventData>(`/events/${eventId}`).then(setEvent).catch(() => {});
      } else {
        setError('Generation failed. Please try again.');
      }
    } finally {
      setWorking(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isCreator && event?.status === 'collecting' && expired && !working) {
      handleGenerate();
    }
  }, [expired, isCreator, event?.status, working, handleGenerate]);

  async function copyLink() {
    if (!eventId) return;
    try {
      const data = await api.post<{ token: string }>(`/events/${eventId}/link`);
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${data.token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  }

  if (loading) return <p className="gf-muted">Loading event...</p>;
  if (error && !event) return <p className="gf-feedback gf-feedback--error">{error}</p>;
  if (!event) return <p className="gf-muted">Event not found.</p>;

  // Finalized
  if (event.status === 'finalized') {
    const selected = options.find(o => o.is_selected);
    return (
      <div className="gf-stack gf-stack--xl">
        <div>
          <h2 className="gf-section-title">{event.title}</h2>
          {event.location_city && <p className="gf-muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>&#128205; {event.location_city}</p>}
        </div>
        {selected ? (
          <div className="gf-card gf-option-card gf-option-card--featured">
            <h3 className="gf-card-title">{selected.title}</h3>
            <p className="gf-muted">{prettyDate(selected.suggested_date)}{selected.suggested_time ? ` at ${selected.suggested_time}` : ''}</p>
            <p>{selected.description}</p>
          </div>
        ) : (
          <div className="gf-card"><p className="gf-muted">This event has been finalized.</p></div>
        )}
        <div className="gf-actions gf-text-center" style={{ justifyContent: 'center' }}>
          <button type="button" className="gf-button gf-button--primary" onClick={() => navigate(`/events/${event.id}/confirmation`)}>
            View confirmation
          </button>
          <button type="button" className="gf-button gf-button--ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Generating
  if (event.status === 'generating') {
    return (
      <div className="gf-stack gf-stack--xl">
        <h2 className="gf-section-title">{event.title}</h2>
        <div className="gf-card">
          <h3 className="gf-card-title">Generating options...</h3>
          <p className="gf-muted">The AI is creating activity suggestions. This usually takes a moment.</p>
          <p className="gf-muted" style={{ marginTop: 6 }}>You can safely leave this page. The options will be ready for you to pick later.</p>
        </div>
      </div>
    );
  }

  // Options Ready
  if (event.status === 'options_ready') {
    return (
      <div className="gf-stack gf-stack--xl">
        <div>
          <h2 className="gf-section-title">{event.title}</h2>
          {event.location_city && <p className="gf-muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>&#128205; {event.location_city}</p>}
        </div>
        <div className="gf-card gf-text-center" style={{ padding: '40px 20px' }}>
          <h3 className="gf-card-title">Options are ready</h3>
          <p className="gf-muted" style={{ marginBottom: '24px' }}>The AI has created activity suggestions for your group.</p>
          <button type="button" className="gf-button gf-button--primary" onClick={() => navigate(`/events/${event.id}/options`)}>
            Pick activity
          </button>
        </div>
      </div>
    );
  }

  // Collecting responses (main state)
  return (
    <div className="gf-stack gf-stack--xl">
      <div>
        <h2 className="gf-section-title">{event.title}</h2>
        {event.location_city && <p className="gf-muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>&#128205; {event.location_city}</p>}
      </div>

      {isCreator && (
        <div className="gf-row-between">
          <button type="button" className="gf-button gf-button--secondary" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy invite link'}
          </button>
          <div className="gf-stack gf-stack--sm" style={{ alignItems: 'center' }}>
            <span className={`gf-countdown${expired ? ' gf-countdown--expired' : ''}`}>
              {expired ? 'Expired' : formatRemaining(remaining)}
            </span>
            <span className="gf-countdown__label">{expired ? 'Response window closed' : 'remaining'}</span>
          </div>
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
                {respondents.map(r => (
                  <div className="gf-respondent" key={r.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="gf-respondent__name">{r.email}</span>
                      <div className="gf-respondent__dates">
                        {r.available_dates.map(d => (
                          <span className="gf-chip gf-chip--active" key={d.date}>{prettyDate(d.date)} {d.start_time}–{d.end_time}</span>
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

      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      {isCreator && (
        <div className="gf-actions">
          <button type="button" className="gf-button gf-button--primary" disabled={working || expired} onClick={handleGenerate}>
            {working || expired ? 'Generating...' : `End window & generate${respondents.length > 0 ? ` (${respondents.length} responded)` : ''}`}
          </button>
        </div>
      )}

      {isCreator && event.status === 'collecting' && <InvitationLinkPanel eventId={event.id} />}
    </div>
  );
}
