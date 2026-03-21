import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getCurrentUserId } from '../api/client';
import InvitationLinkPanel from './InvitationLinkPanel';

interface EventData { id: string; title: string; description: string; status: string; response_window_end: string; inviter_id: string; }
interface Respondent { id: string; email: string; available_dates: { date: string; start_time: string; end_time: string }[]; responded_at: string; }
interface ActivityOption { id: string; title: string; description: string; suggested_date: string; suggested_time: string | null; rank: number; is_selected: boolean; }

const RANK_CLASS: Record<number, string> = { 1: 'gf-option-card--rank-1', 2: 'gf-option-card--rank-2', 3: 'gf-option-card--rank-3' };

function formatRemaining(ms: number) {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
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

  // Fetch options when status changes to options_ready
  useEffect(() => {
    if (!eventId || !event || (event.status !== 'options_ready' && event.status !== 'finalized')) return;
    api.get<{ options: ActivityOption[] }>(`/events/${eventId}/options`).then(d => setOptions([...d.options].sort((a, b) => a.rank - b.rank))).catch(() => {});
  }, [eventId, event?.status]);

  const { remaining, expired } = useCountdown(event?.response_window_end || '');

  async function handleGenerate() {
    if (!eventId) return;
    setWorking(true);
    setError('');
    try {
      await api.post(`/events/${eventId}/generate`);
      const updated = await api.get<EventData>(`/events/${eventId}`);
      setEvent(updated);
    } catch {
      setError('Generation failed. Make sure at least one person has responded.');
    } finally {
      setWorking(false);
    }
  }

  async function handleSelect(optionId: string) {
    if (!eventId) return;
    setWorking(true);
    try {
      await api.post(`/events/${eventId}/select`, { activityOptionId: optionId });
      const updated = await api.get<EventData>(`/events/${eventId}`);
      setEvent(updated);
    } catch {
      setError('Could not finalize the event.');
    } finally {
      setWorking(false);
    }
  }

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
        <h2 className="gf-section-title">{event.title}</h2>
        {selected ? (
          <div className="gf-card gf-option-card gf-option-card--featured">
            <h3 className="gf-card-title">{selected.title}</h3>
            <p className="gf-muted">{prettyDate(selected.suggested_date)}{selected.suggested_time ? ` at ${selected.suggested_time}` : ''}</p>
            <p>{selected.description}</p>
          </div>
        ) : (
          <div className="gf-card"><p className="gf-muted">This event has been finalized.</p></div>
        )}
        <div className="gf-actions" style={{ justifyContent: 'center' }}>
          <Link to={`/events/${event.id}/confirmation`}>
            <button className="gf-button gf-button--primary">View confirmation</button>
          </Link>
          <Link to="/dashboard">
            <button className="gf-button gf-button--ghost">Dashboard</button>
          </Link>
        </div>
      </div>
    );
  }

  // Options ready — show ranked cards
  if (event.status === 'options_ready' && options.length > 0 && isCreator) {
    return (
      <div className="gf-stack gf-stack--xl">
        <div className="gf-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="gf-section-title">{event.title}</h2>
          <button className="gf-button gf-button--ghost" onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        {error && <p className="gf-feedback gf-feedback--error">{error}</p>}
        <div className="gf-grid gf-grid--three">
          {options.map(opt => (
            <div className={`gf-card gf-option-card ${RANK_CLASS[opt.rank] || ''}`} key={opt.id}>
              {opt.rank === 1 && <span className="gf-top-pick">Top Pick</span>}
              <h3 className="gf-card-title">{opt.title}</h3>
              <p className="gf-muted">{prettyDate(opt.suggested_date)}{opt.suggested_time ? ` at ${opt.suggested_time}` : ''}</p>
              <p className="gf-muted" style={{ fontSize: '0.9rem' }}>{opt.description}</p>
              <button className="gf-button gf-button--primary" disabled={working} onClick={() => handleSelect(opt.id)}>
                {working ? 'Working...' : 'Choose'}
              </button>
            </div>
          ))}
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
        </div>
      </div>
    );
  }

  // Collecting responses (main state)
  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">{event.title}</h2>

      {isCreator && (
        <div className="gf-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="gf-button gf-button--secondary" onClick={copyLink}>
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
                    <div style={{ flex: 1 }}>
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
          <button className="gf-button gf-button--primary" disabled={working} onClick={handleGenerate}>
            {working ? 'Working...' : `Generate options${respondents.length > 0 ? ` (${respondents.length} responded)` : ''}`}
          </button>
        </div>
      )}

      {isCreator && event.status === 'collecting' && <InvitationLinkPanel eventId={event.id} />}
    </div>
  );
}
