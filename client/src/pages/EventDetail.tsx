import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getCurrentUserId } from '../api/client';
import { colors, shared } from '../theme';
import InvitationLinkPanel from './InvitationLinkPanel';

interface EventData { id: string; title: string; description: string; status: string; response_window_end: string; inviter_id: string; }
interface Respondent { id: string; email: string; available_dates: string[]; responded_at: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  collecting: { label: 'Collecting Responses', color: '#D97706', bg: '#FFFBEB' },
  generating: { label: 'Generating Options…', color: '#2563EB', bg: '#EFF6FF' },
  options_ready: { label: 'Options Ready', color: '#059669', bg: '#ECFDF5' },
  finalized: { label: 'Finalized', color: '#7C3AED', bg: '#F5F3FF' },
};

function useCountdown(target: string) {
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!target) { setRemaining(''); setExpired(false); return; }
    setExpired(false);
    function tick() {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setRemaining('0:00'); setExpired(true); return; }
      setExpired(false);
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return { remaining, expired };
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const isCreator = event?.inviter_id === getCurrentUserId();

  const fetchEvent = useCallback(() => {
    if (!eventId) return;
    api.get<EventData>(`/events/${eventId}`).then(setEvent).catch(() => setError('Failed to load event.')).finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  useEffect(() => {
    if (!eventId || !isCreator) return;
    api.get<{ respondents: Respondent[] }>(`/events/${eventId}/respondents`)
      .then((d) => setRespondents(d.respondents)).catch(() => {});
    // Poll every 10s for new respondents
    const id = setInterval(() => {
      api.get<{ respondents: Respondent[] }>(`/events/${eventId}/respondents`)
        .then((d) => setRespondents(d.respondents)).catch(() => {});
      // Also refresh event status
      api.get<EventData>(`/events/${eventId}`).then(setEvent).catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [eventId, isCreator]);

  const { remaining, expired } = useCountdown(event?.response_window_end || '');

  async function handleGenerate() {
    if (!eventId) return;
    setGenerating(true);
    setError('');
    try {
      await api.post(`/events/${eventId}/generate`);
      // Refresh event to get new status
      const updated = await api.get<EventData>(`/events/${eventId}`);
      setEvent(updated);
    } catch {
      setError('Generation failed. Make sure at least one person has responded.');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div style={{ ...shared.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p style={{ color: colors.textSecondary }}>Loading…</p></div>;
  if (error && !event) return <div style={shared.page}><div style={shared.container}><div style={shared.errorBox} role="alert">{error}</div></div></div>;
  if (!event) return <div style={shared.page}><div style={shared.container}><p>Event not found.</p></div></div>;

  const s = statusConfig[event.status] || { label: event.status, color: colors.textSecondary, bg: '#f3f4f6' };

  return (
    <div style={shared.page}>
      <div style={shared.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={shared.logo}>🐟 Go Fish</div>
          <Link to="/dashboard" style={{ fontSize: '0.85rem', color: colors.orange }}>← Dashboard</Link>
        </div>

        <div style={shared.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h1 style={{ ...shared.title, flex: 1, margin: 0 }}>{event.title}</h1>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: s.color, backgroundColor: s.bg }}>{s.label}</span>
          </div>
          <p style={{ color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 16px' }}>{event.description}</p>

          {/* Countdown + Generate button for collecting status */}
          {event.status === 'collecting' && isCreator && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                padding: 16, borderRadius: 12, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                flexWrap: 'wrap' as const,
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#92400E', fontWeight: 600 }}>
                    {expired ? 'Time is up — ready to generate' : 'Auto-generates in'}
                  </p>
                  {!expired && remaining && (
                    <p style={{ margin: '2px 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#D97706', fontVariantNumeric: 'tabular-nums' }}>
                      {remaining}
                    </p>
                  )}
                </div>
                <button onClick={handleGenerate} disabled={generating}
                  style={{ ...shared.btn, whiteSpace: 'nowrap' as const, ...(generating ? shared.btnDisabled : {}) }}>
                  {generating ? 'Generating…' : `🎯 Generate Now${respondents.length > 0 ? ` (${respondents.length})` : ''}`}
                </button>
              </div>
            </div>
          )}

          {error && <div style={{ ...shared.errorBox, marginBottom: 16 }}>{error}</div>}
        </div>

        {/* Invitation link panel */}
        {event.status === 'collecting' && isCreator && <InvitationLinkPanel eventId={event.id} />}

        {/* Respondents list for creator */}
        {isCreator && respondents.length > 0 && (
          <div style={{ ...shared.card, marginTop: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 12px' }}>👥 Respondents ({respondents.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {respondents.map((r) => (
                <div key={r.id} style={{
                  padding: '10px 14px', borderRadius: 10, backgroundColor: '#F9FAFB',
                  border: `1px solid ${colors.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{r.email}</span>
                    <span style={{ fontSize: '0.7rem', color: colors.textMuted }}>
                      {new Date(r.responded_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {r.available_dates.map((d) => (
                      <span key={d} style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12,
                        backgroundColor: colors.orangeLight, color: colors.orangeHover, fontWeight: 500,
                      }}>
                        {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Options ready — go pick */}
        {event.status === 'options_ready' && isCreator && (
          <div style={{ ...shared.card, marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
            <p style={{ margin: '0 0 12px', fontWeight: 500 }}>Gemini generated 3 activity options for your group!</p>
            <Link to={`/events/${event.id}/options`}
              style={{ ...shared.btn, display: 'inline-block', textDecoration: 'none', color: '#fff' }}>
              Choose an Activity →
            </Link>
          </div>
        )}

        {event.status === 'finalized' && (
          <div style={{ ...shared.card, marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
            <p style={{ margin: '0 0 12px', fontWeight: 500 }}>This event has been finalized!</p>
            <Link to={`/events/${event.id}/confirmation`}
              style={{ ...shared.btn, display: 'inline-block', textDecoration: 'none', color: '#fff' }}>
              View Details
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
