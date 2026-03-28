import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import OptionGenerationState from '../components/OptionGenerationState';

interface ActivityOption {
  id: string;
  title: string;
  description: string;
  suggested_date: string;
  suggested_time: string | null;
  rank: number;
  is_selected: boolean;
  source_url: string | null;
  venue_name: string | null;
  price_range: string | null;
  weather_note: string | null;
  image_url: string | null;
}

interface EventData {
  id: string;
  status: string;
}

const GENERATION_STEPS = [
  {
    label: 'Fetching real-world events and venues…',
    detail: 'Scanning local listings and weather for your dates.',
  },
  {
    label: 'Analyzing group preferences…',
    detail: "Comparing everyone's taste benchmarks and availability.",
  },
  {
    label: 'Running AI planning agent…',
    detail: 'The agent is exploring options and calling research tools.',
  },
  {
    label: 'Finalizing your shortlist…',
    detail: 'Ranking the top combinations and structuring the picks.',
  },
];

const RANK_CLASS: Record<number, string> = {
  1: 'gf-option-card--rank-1',
  2: 'gf-option-card--rank-2',
  3: 'gf-option-card--rank-3',
};

function prettyDate(d: string) {
  const dateStr = d.includes('T') ? d.split('T')[0] : d;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function ActivityOptionsView() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [options, setOptions] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<string>('');
  const [stepIndex, setStepIndex] = useState(0);
  const isSelectingRef = useRef(false);

  const loadOptions = useCallback(async () => {
    if (!eventId || isSelectingRef.current) return true;

    const [eventResult, optionsResult] = await Promise.allSettled([
      api.get<EventData>(`/events/${eventId}`),
      api.get<{ options: ActivityOption[] }>(`/events/${eventId}/options`),
    ]);

    if (eventResult.status === 'fulfilled') {
      setEventStatus(eventResult.value.status);
      if (eventResult.value.status === 'finalized') {
        navigate(`/events/${eventId}/confirmation`, { replace: true });
        return true;
      }
    }

    if (optionsResult.status === 'rejected') {
      throw optionsResult.reason;
    }

    const sortedOptions = [...optionsResult.value.options].sort((a, b) => a.rank - b.rank);
    setOptions(sortedOptions);
    setError('');

    return sortedOptions.length > 0;
  }, [eventId, navigate]);

  useEffect(() => {
    if (!eventId) return;

    let active = true;
    let pollId: number | null = null;

    const sync = async () => {
      try {
        const hasOptions = await loadOptions();
        if (!active) return true;
        return hasOptions;
      } catch {
        if (!active) return true;
        setError('Failed to load options.');
        return false;
      } finally {
        if (active) setLoading(false);
      }
    };

    void sync().then((done) => {
      if (!active || done) return;
      pollId = window.setInterval(() => {
        void sync().then((hasOptions) => {
          if (hasOptions && pollId !== null) {
            window.clearInterval(pollId);
            pollId = null;
          }
        });
      }, 3000);
    });

    return () => {
      active = false;
      if (pollId !== null) {
        window.clearInterval(pollId);
      }
    };
  }, [eventId, loadOptions]);

  async function handleSelect(optionId: string) {
    setError('');
    setSelecting(optionId);
    isSelectingRef.current = true;
    try {
      await api.post(`/events/${eventId}/select`, { activityOptionId: optionId });
      navigate(`/events/${eventId}/confirmation`);
    } catch {
      setError('Failed to select. Try again.');
    } finally {
      setSelecting(null);
      isSelectingRef.current = false;
    }
  }

  // Cycle through generation steps every 4 s while the agent is running
  useEffect(() => {
    if (eventStatus !== 'generating') return;
    const id = setInterval(() => setStepIndex((i) => (i + 1) % GENERATION_STEPS.length), 4000);
    return () => clearInterval(id);
  }, [eventStatus]);

  if (loading) return <p className="gf-muted">Loading…</p>;

  return (
    <div className="gf-stack gf-stack--xl">
      <button type="button" className="gf-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        Back
      </button>
      <div>
        <h1 className="gf-section-title">Pick Your Activity</h1>
        <p className="gf-muted">AI analyzed everyone's preferences. Here are the top picks.</p>
      </div>

      {error && <p className="gf-feedback gf-feedback--error">{error}</p>}

      {options.length > 0 ? (
        <div className="gf-grid gf-grid--three">
          {options.map((opt) => (
            <div key={opt.id} className={`gf-card gf-option-card ${RANK_CLASS[opt.rank] ?? ''}`}>
              {opt.image_url && (
                <img
                  src={opt.image_url}
                  alt={opt.title}
                  style={{
                    width: '100%',
                    height: 160,
                    objectFit: 'cover',
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                />
              )}
              {opt.rank === 1 && <span className="gf-top-pick">Top Pick</span>}
              <h3 className="gf-card-title">{opt.title}</h3>
              {opt.venue_name && (
                <p className="gf-muted" style={{ marginTop: -6, fontSize: '0.9rem' }}>
                  {opt.venue_name}
                </p>
              )}
              <p className="gf-muted">{opt.description}</p>
              <p className="gf-muted">
                {prettyDate(opt.suggested_date)}
                {opt.suggested_time ? ` at ${opt.suggested_time}` : ''}
              </p>
              {opt.price_range && (
                <span
                  style={{
                    display: 'inline-block',
                    alignSelf: 'flex-start',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border: '1px solid var(--line-strong)',
                    fontSize: '0.8rem',
                    color: 'var(--accent)',
                    background: 'rgba(255,157,73,0.08)',
                  }}
                >
                  {opt.price_range}
                </span>
              )}
              {opt.weather_note && (
                <p
                  className="gf-muted"
                  style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>&#x26C5;</span>
                  {opt.weather_note}
                </p>
              )}
              {opt.source_url && (
                <a
                  href={opt.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--accent)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  More info
                </a>
              )}
              <button
                type="button"
                onClick={() => handleSelect(opt.id)}
                disabled={selecting !== null}
                className="gf-button gf-button--primary"
              >
                {selecting === opt.id ? 'Selecting…' : 'Choose This'}
              </button>
            </div>
          ))}
        </div>
      ) : eventStatus === 'generating' ? (
        <OptionGenerationState
          title={GENERATION_STEPS[stepIndex].label}
          description={GENERATION_STEPS[stepIndex].detail}
          detail="This page refreshes automatically — picks will appear as soon as the agent finishes."
        />
      ) : (
        <OptionGenerationState
          title="Curating your shortlist"
          description="The final combinations are being assembled around your group's shared preferences."
          detail="This page refreshes automatically and will reveal the picks as soon as they are ready."
        />
      )}
    </div>
  );
}
