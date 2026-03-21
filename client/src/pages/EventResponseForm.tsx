import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError, getCurrentUserId } from '../api/client';
import { colors, shared } from '../theme';

interface EventData { id: string; title: string; description: string; status: string; response_window_end: string; }

function getNext14Days(): { label: string; value: string; day: string; month: string; weekday: string }[] {
  const days: { label: string; value: string; day: string; month: string; weekday: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = d.toISOString().split('T')[0];
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const day = d.getDate().toString();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekday;
    days.push({ label, value, day, month, weekday });
  }
  return days;
}

export default function EventResponseForm() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [windowClosed, setWindowClosed] = useState(false);

  const dates = getNext14Days();

  useEffect(() => {
    if (!getCurrentUserId()) { navigate(`/login?returnTo=/events/${eventId}/respond`, { replace: true }); return; }
    if (!eventId) return;
    api.get<EventData>(`/events/${eventId}`)
      .then((data) => { setEvent(data); if (new Date(data.response_window_end) <= new Date()) setWindowClosed(true); })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) navigate(`/login?returnTo=/events/${eventId}/respond`, { replace: true });
        else setError('Failed to load event.');
      })
      .finally(() => setLoading(false));
  }, [eventId, navigate]);

  function toggleDate(value: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (selectedDates.size === 0) { setError('Tap at least one date that works for you.'); return; }

    setSubmitting(true);
    try {
      await api.post(`/events/${eventId}/responses`, { available_dates: Array.from(selectedDates) });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          const body = err.body as { error?: string };
          if (body?.error === 'benchmark_required') { navigate(`/benchmark?returnTo=/events/${eventId}/respond`); return; }
          setWindowClosed(true);
        } else if (err.status === 409) setError('You already responded to this event.');
        else setError('Failed to submit. Try again.');
      } else setError('Failed to submit. Try again.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <div style={{ ...shared.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p style={{ color: colors.textSecondary }}>Loading…</p></div>;

  if (windowClosed) return (
    <div style={shared.page}><div style={shared.container}><div style={shared.logo}>🐟 Go Fish</div>
      <div style={{ ...shared.card, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏰</div>
        <h1 style={{ ...shared.title, fontSize: '1.3rem' }}>Response Period Ended</h1>
        <p style={shared.subtitle}>The window for this event has closed.</p>
      </div>
    </div></div>
  );

  if (submitted) return (
    <div style={shared.page}><div style={shared.container}><div style={shared.logo}>🐟 Go Fish</div>
      <div style={{ ...shared.card, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>✅</div>
        <h1 style={{ ...shared.title, fontSize: '1.3rem' }}>You're in!</h1>
        <p style={shared.subtitle}>Your dates have been recorded. You'll get an email when the activity is decided.</p>
      </div>
    </div></div>
  );

  return (
    <div style={shared.page}>
      <div style={shared.container}>
        <div style={shared.logo}>🐟 Go Fish</div>
        <div style={shared.card}>
          {event && (
            <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${colors.border}` }}>
              <p style={{ fontSize: '0.8rem', color: colors.textMuted, margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 }}>You're invited to</p>
              <h1 style={{ ...shared.title, fontSize: '1.4rem' }}>{event.title}</h1>
              <p style={{ color: colors.textSecondary, margin: '8px 0 0', lineHeight: 1.5 }}>{event.description}</p>
            </div>
          )}

          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 4px' }}>When are you free?</h2>
          <p style={{ fontSize: '0.85rem', color: colors.textSecondary, margin: '0 0 16px' }}>Tap all the dates that work for you.</p>

          {error && <div style={shared.errorBox} role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: 8, marginBottom: 24,
            }}>
              {dates.map((d) => {
                const selected = selectedDates.has(d.value);
                return (
                  <button key={d.value} type="button" onClick={() => toggleDate(d.value)}
                    aria-pressed={selected}
                    style={{
                      display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
                      padding: '10px 4px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${selected ? colors.orange : colors.border}`,
                      backgroundColor: selected ? colors.orangeLight : '#fff',
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: '0.65rem', color: selected ? colors.orange : colors.textMuted, fontWeight: 600, textTransform: 'uppercase' as const }}>{d.label}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: selected ? colors.orange : colors.text, lineHeight: 1.3 }}>{d.day}</span>
                    <span style={{ fontSize: '0.65rem', color: selected ? colors.orangeHover : colors.textMuted }}>{d.month}</span>
                  </button>
                );
              })}
            </div>

            <button type="submit" disabled={submitting || selectedDates.size === 0}
              style={{ ...shared.btn, width: '100%', ...(submitting || selectedDates.size === 0 ? shared.btnDisabled : {}) }}>
              {submitting ? 'Submitting…' : `Submit ${selectedDates.size > 0 ? `(${selectedDates.size} date${selectedDates.size > 1 ? 's' : ''})` : ''}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
