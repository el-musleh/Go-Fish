import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { colors, shared } from '../theme';

interface ActivityOption { id: string; title: string; description: string; suggested_date: string; rank: number; is_selected: boolean; }

export default function EventConfirmation() {
  const { eventId } = useParams<{ eventId: string }>();
  const [selected, setSelected] = useState<ActivityOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    api.get<{ options: ActivityOption[] }>(`/events/${eventId}/options`)
      .then((data) => setSelected(data.options.find((o) => o.is_selected) ?? null))
      .catch(() => setError('Failed to load confirmation.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <div style={{ ...shared.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p style={{ color: colors.textSecondary }}>Loading…</p></div>;
  if (error) return <div style={shared.page}><div style={shared.container}><div style={shared.errorBox} role="alert">{error}</div></div></div>;

  if (!selected) return (
    <div style={shared.page}><div style={shared.container}><div style={shared.logo}>🐟 Go Fish</div>
      <div style={{ ...shared.card, textAlign: 'center' }}>
        <p>No activity selected yet.</p>
      </div>
    </div></div>
  );

  return (
    <div style={shared.page}>
      <div style={shared.container}>
        <div style={shared.logo}>🐟 Go Fish</div>
        <div style={{ ...shared.card, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
          <h1 style={{ ...shared.title, fontSize: '1.5rem' }}>Event Confirmed</h1>
          <p style={{ ...shared.subtitle, marginBottom: 20 }}>Everyone's been notified. Here's the plan:</p>

          <div style={{
            padding: 20, borderRadius: 12,
            backgroundColor: colors.orangeLight,
            border: `1px solid ${colors.orangeBorder}`,
            textAlign: 'left' as const,
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 600 }}>{selected.title}</h2>
            <p style={{ color: colors.textSecondary, margin: '0 0 8px', lineHeight: 1.5 }}>{selected.description}</p>
            <p style={{ fontSize: '0.85rem', color: colors.textMuted, margin: 0 }}>
              📅 {new Date(selected.suggested_date).toLocaleDateString()}
            </p>
          </div>

          <p style={{ marginTop: 20, color: colors.success, fontWeight: 500, fontSize: '0.9rem' }}>
            ✉️ Emails sent to all participants
          </p>
        </div>
      </div>
    </div>
  );
}
