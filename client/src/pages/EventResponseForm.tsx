import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError, getCurrentUserId } from '../api/client';

interface EventData { id: string; title: string; description: string; status: string; response_window_end: string; }
interface TimeWindow { start: number; end: number; }

function getNext14Days() {
  const days: { label: string; value: string; day: string; month: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = d.toISOString().split('T')[0];
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const day = d.getDate().toString();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const label = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : weekday;
    days.push({ label, value, day, month });
  }
  return days;
}

// Slot 0 = 06:00, Slot 1 = 06:30, ..., Slot 36 = 00:00
function slotToTime(slot: number): string {
  const totalMinutes = slot * 30 + 360;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const DEFAULT_START = 6;  // 09:00
const DEFAULT_END = 22;   // 17:00

export default function EventResponseForm() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDates, setSelectedDates] = useState<Map<string, TimeWindow>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [windowClosed, setWindowClosed] = useState(false);
  const dates = getNext14Days();

  useEffect(() => {
    if (!getCurrentUserId()) { navigate(`/login?returnTo=/events/${eventId}/respond`, { replace: true }); return; }
    if (!eventId) return;
    api.get<EventData>(`/events/${eventId}`)
      .then(data => { setEvent(data); if (new Date(data.response_window_end) <= new Date()) setWindowClosed(true); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) navigate(`/login?returnTo=/events/${eventId}/respond`, { replace: true });
        else setError('Failed to load event.');
      })
      .finally(() => setLoading(false));
  }, [eventId, navigate]);

  function toggle(value: string) {
    setSelectedDates(prev => {
      const next = new Map(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.set(value, { start: DEFAULT_START, end: DEFAULT_END });
      }
      return next;
    });
  }

  function updateWindow(dateValue: string, field: 'start' | 'end', slot: number) {
    setSelectedDates(prev => {
      const next = new Map(prev);
      const current = next.get(dateValue);
      if (!current) return prev;
      if (field === 'start') {
        next.set(dateValue, { ...current, start: Math.min(slot, current.end - 1) });
      } else {
        next.set(dateValue, { ...current, end: Math.max(slot, current.start + 1) });
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedDates.size === 0) { setError('Pick at least one date.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        available_dates: Array.from(selectedDates.entries()).map(([date, w]) => ({
          date,
          start_time: slotToTime(w.start),
          end_time: slotToTime(w.end),
        })),
      };
      await api.post(`/events/${eventId}/responses`, payload);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          const body = err.body as { error?: string };
          if (body?.error === 'benchmark_required') { navigate(`/benchmark?returnTo=/events/${eventId}/respond`); return; }
          setWindowClosed(true);
        } else if (err.status === 409) setError('You already responded.');
        else setError('Failed to submit.');
      } else setError('Failed to submit.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <p className="gf-muted">Loading…</p>;

  if (windowClosed) return (
    <div className="gf-card" style={{ textAlign: 'center' }}>
      <h3 className="gf-card-title">Response window closed</h3>
      <p className="gf-muted">The window for this event has closed.</p>
    </div>
  );

  if (submitted) return (
    <div className="gf-card" style={{ textAlign: 'center' }}>
      <h3 className="gf-card-title">You're in!</h3>
      <p className="gf-muted">Your dates have been recorded. You'll get an email when the activity is decided.</p>
    </div>
  );

  const sortedSelected = Array.from(selectedDates.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="gf-stack gf-stack--xl">
      {event && <h2 className="gf-section-title">{event.title}</h2>}
      <h3 className="gf-card-title">When are you free?</h3>
      <div className="gf-date-grid">
        {dates.map(d => {
          const active = selectedDates.has(d.value);
          return (
            <button key={d.value} type="button" onClick={() => toggle(d.value)}
              className={`gf-date-card${active ? ' gf-date-card--active' : ''}`}>
              <span className="gf-date-card__label">{d.label}</span>
              <span className="gf-date-card__day">{d.day}</span>
              <span className="gf-date-card__month">{d.month}</span>
            </button>
          );
        })}
      </div>

      {sortedSelected.length > 0 && (
        <div className="gf-time-windows">
          <h3 className="gf-card-title">Set your time window</h3>
          {sortedSelected.map(([dateValue, window]) => {
            const dateInfo = dates.find(d => d.value === dateValue);
            return (
              <div key={dateValue} className="gf-time-window">
                <span className="gf-time-window__label">
                  {dateInfo?.label} {dateInfo?.day} {dateInfo?.month}
                </span>
                <div className="gf-time-window__slider">
                  <label className="gf-time-window__slider-label">
                    From
                    <input type="range" min={0} max={35} value={window.start}
                      onChange={e => updateWindow(dateValue, 'start', +e.target.value)} />
                  </label>
                  <label className="gf-time-window__slider-label">
                    To
                    <input type="range" min={1} max={36} value={window.end}
                      onChange={e => updateWindow(dateValue, 'end', +e.target.value)} />
                  </label>
                </div>
                <span className="gf-time-window__range">
                  {slotToTime(window.start)} – {slotToTime(window.end)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}
      <button className="gf-button gf-button--primary" disabled={submitting || selectedDates.size === 0} onClick={handleSubmit}>
        {submitting ? 'Working...' : `Submit availability${selectedDates.size > 0 ? ` (${selectedDates.size})` : ''}`}
      </button>
    </div>
  );
}
