import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getCurrentUserId } from '../api/client';
import { colors, shared } from '../theme';

interface EventItem {
  id: string;
  title: string;
  description: string;
  status: string;
  response_window_end: string;
  respondent_count?: number;
  selected_activity?: { title: string; suggested_date: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  collecting: { label: 'Collecting', color: '#D97706', bg: '#FFFBEB' },
  generating: { label: 'Generating…', color: '#2563EB', bg: '#EFF6FF' },
  options_ready: { label: 'Pick Activity', color: '#059669', bg: '#ECFDF5' },
  finalized: { label: 'Confirmed', color: '#7C3AED', bg: '#F5F3FF' },
};

function EventCard({ event, role }: { event: EventItem; role: 'creator' | 'participant' }) {
  const s = statusConfig[event.status] || { label: event.status, color: colors.textSecondary, bg: '#f3f4f6' };
  const linkTo = event.status === 'options_ready' && role === 'creator'
    ? `/events/${event.id}/options`
    : event.status === 'finalized'
      ? `/events/${event.id}/confirmation`
      : `/events/${event.id}`;

  return (
    <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        ...shared.card, padding: '20px 24px', cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{event.title}</h3>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: s.color, backgroundColor: s.bg, whiteSpace: 'nowrap' as const }}>
            {s.label}
          </span>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: colors.textSecondary, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        }}>{event.description}</p>
        {event.status === 'finalized' && event.selected_activity && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, backgroundColor: colors.orangeLight,
            border: `1px solid ${colors.orangeBorder}`, marginBottom: 8,
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: colors.orangeHover }}>
              🎯 {event.selected_activity.title}
            </span>
            <span style={{ fontSize: '0.75rem', color: colors.textMuted, marginLeft: 8 }}>
              📅 {new Date(event.selected_activity.suggested_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: colors.textMuted }}>
          {role === 'creator' && event.respondent_count !== undefined && (
            <span>👥 {event.respondent_count} responded</span>
          )}
          {event.status !== 'finalized' && (
            <span>🕐 {new Date(event.response_window_end).toLocaleString()}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [created, setCreated] = useState<EventItem[]>([]);
  const [joined, setJoined] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getCurrentUserId()) { navigate('/login?returnTo=/dashboard', { replace: true }); return; }
    api.get<{ created: EventItem[]; joined: EventItem[] }>('/events')
      .then((data) => { setCreated(data.created); setJoined(data.joined); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Poll every 15s for status updates
    const id = setInterval(() => {
      api.get<{ created: EventItem[]; joined: EventItem[] }>('/events')
        .then((data) => { setCreated(data.created); setJoined(data.joined); })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [navigate]);

  if (loading) return (
    <div style={{ ...shared.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: colors.textSecondary }}>Loading…</p>
    </div>
  );

  return (
    <div style={shared.page}>
      <div style={{ ...shared.container, maxWidth: 680 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div style={shared.logo}>🐟 Go Fish</div>
          <Link to="/events/new" style={{ ...shared.btn, textDecoration: 'none', fontSize: '0.9rem', padding: '8px 20px' }}>
            + New Event
          </Link>
        </div>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 12px', color: colors.text }}>
            My Events
          </h2>
          {created.length === 0 ? (
            <div style={{ ...shared.card, textAlign: 'center', padding: 32, color: colors.textMuted }}>
              <p style={{ margin: 0 }}>No events yet. Create one to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {created.map((e) => <EventCard key={e.id} event={e} role="creator" />)}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 12px', color: colors.text }}>
            Joined Events
          </h2>
          {joined.length === 0 ? (
            <div style={{ ...shared.card, textAlign: 'center', padding: 32, color: colors.textMuted }}>
              <p style={{ margin: 0 }}>You haven't joined any events yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {joined.map((e) => <EventCard key={e.id} event={e} role="participant" />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
