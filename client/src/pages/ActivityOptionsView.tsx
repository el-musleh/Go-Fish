import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { colors, shared } from '../theme';

interface ActivityOption { id: string; title: string; description: string; suggested_date: string; rank: number; is_selected: boolean; }

const medals = ['🥇', '🥈', '🥉'];

export default function ActivityOptionsView() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [options, setOptions] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);

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
    try {
      await api.post(`/events/${eventId}/select`, { activityOptionId: optionId });
      navigate(`/events/${eventId}/confirmation`);
    } catch { setError('Failed to select. Try again.'); }
    finally { setSelecting(null); }
  }

  if (loading) return <div style={{ ...shared.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p style={{ color: colors.textSecondary }}>Loading…</p></div>;

  return (
    <div style={shared.page}>
      <div style={{ ...shared.container, maxWidth: 640 }}>
        <div style={shared.logo}>🐟 Go Fish</div>
        <h1 style={shared.title}>Pick Your Activity</h1>
        <p style={shared.subtitle}>Gemini analyzed everyone's preferences. Here are the top picks.</p>

        {error && <div style={shared.errorBox} role="alert">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {options.map((opt) => (
            <div key={opt.id} style={{
              ...shared.card,
              border: opt.rank === 1 ? `2px solid ${colors.orange}` : `1px solid ${colors.border}`,
              position: 'relative' as const,
            }}>
              {opt.rank === 1 && (
                <div style={{
                  position: 'absolute' as const, top: -12, left: 16,
                  backgroundColor: colors.orange, color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                  padding: '2px 10px', borderRadius: 10, textTransform: 'uppercase' as const,
                }}>Top Pick</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '1.5rem' }}>{medals[opt.rank - 1] || `#${opt.rank}`}</span>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>{opt.title}</h2>
              </div>
              <p style={{ color: colors.textSecondary, margin: '0 0 8px', lineHeight: 1.5 }}>{opt.description}</p>
              <p style={{ fontSize: '0.8rem', color: colors.textMuted, margin: '0 0 14px' }}>
                📅 {new Date(opt.suggested_date).toLocaleDateString()}
              </p>
              <button onClick={() => handleSelect(opt.id)} disabled={selecting !== null}
                style={{
                  ...(opt.rank === 1 ? shared.btn : shared.btnOutline),
                  width: '100%',
                  ...(selecting !== null ? shared.btnDisabled : {}),
                }}>
                {selecting === opt.id ? 'Selecting…' : 'Choose This'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
