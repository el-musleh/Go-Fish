import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

interface ActivityOption { id: string; title: string; description: string; suggested_date: string; suggested_time: string | null; rank: number; is_selected: boolean; }

const RANK_CLASS: Record<number, string> = { 1: 'gf-option-card--rank-1', 2: 'gf-option-card--rank-2', 3: 'gf-option-card--rank-3' };

function prettyDate(d: string) {
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ActivityOptionsView() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [options, setOptions] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    if (!eventId) return;
    api.get<{ options: ActivityOption[] }>(`/events/${eventId}/options`)
      .then((data) => setOptions([...data.options].sort((a, b) => a.rank - b.rank)))
      .catch(() => setError('Failed to load options.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  async function handleSelect(optionId: string) {
    setError('');
    setSelecting(optionId);
    isSelectingRef.current = true;
    try {
      await api.post(`/events/${eventId}/select`, { activityOptionId: optionId });
      navigate(`/events/${eventId}/confirmation`);
    } catch { setError('Failed to select. Try again.'); }
    finally { setSelecting(null); isSelectingRef.current = false; }
  }

  if (loading) return <p className="gf-muted">Loading…</p>;

  return (
    <div className="gf-stack gf-stack--xl">
      <div>
        <h1 className="gf-section-title">Pick Your Activity</h1>
        <p className="gf-muted">AI analyzed everyone's preferences. Here are the top picks.</p>
      </div>

      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      {options.length > 0 ? (
        <div className="gf-grid gf-grid--three">
          {options.map((opt) => (
            <div key={opt.id} className={`gf-card gf-option-card ${RANK_CLASS[opt.rank] ?? ''}`}>
              {opt.rank === 1 && <span className="gf-top-pick">Top Pick</span>}
              <h3 className="gf-card-title">{opt.title}</h3>
              <p className="gf-muted">{opt.description}</p>
              <p className="gf-muted">
                {prettyDate(opt.suggested_date)}{opt.suggested_time ? ` at ${opt.suggested_time}` : ''}
              </p>
              <button type="button" onClick={() => handleSelect(opt.id)} disabled={selecting !== null} className="gf-button gf-button--primary">
                {selecting === opt.id ? 'Selecting…' : 'Choose This'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="gf-card">
          <p className="gf-muted">Waiting for options to be generated…</p>
        </div>
      )}
    </div>
  );
}
