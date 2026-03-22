import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCurrentUserId } from '../api/client';

export default function EventCreationForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [timeoutHours, setTimeoutHours] = useState(24);
  const [timeoutMinutes, setTimeoutMinutes] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!getCurrentUserId()) {
    navigate('/login?returnTo=/events/new', { replace: true });
    return null;
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const event = await api.post<{ id: string }>('/events', {
        title,
        description,
        location_city: locationCity,
        location_country: 'DE',
        location_lat: null,
        location_lng: null,
        timeout_hours: timeoutHours + (timeoutMinutes / 60),
      });
      navigate(`/events/${event.id}`);
    } catch {
      setError('Could not create the event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">Create new event or activity</h2>
      <div className="gf-card">
        <form className="gf-form" onSubmit={handleSubmit}>
          <label className="gf-field">
            <span className="gf-field__label">Title</span>
            <span className="gf-field__hint">A short, clear title works best.</span>
            <input className="gf-input" placeholder="Sunday dinner in Berlin" value={title} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="gf-field">
            <span className="gf-field__label">Stadt / City</span>
            <span className="gf-field__hint">Where should the activity take place?</span>
            <input className="gf-input" placeholder="Berlin" value={locationCity} onChange={e => setLocationCity(e.target.value)} required />
          </label>
          <label className="gf-field">
            <span className="gf-field__label">Description</span>
            <span className="gf-field__hint">Optional context for the AI and the group.</span>
            <textarea className="gf-input gf-textarea" placeholder="Keep it flexible, social, and not too expensive." rows={4} value={description} onChange={e => setDescription(e.target.value)} />
          </label>
      <div className="gf-field">
        <span className="gf-field__label">Response timeout</span>
            <span className="gf-field__hint">How long should people have to respond? Default is 24 hours.</span>
        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              className="gf-input"
              type="number"
              min={0}
              max={168}
              value={timeoutHours}
              onChange={e => setTimeoutHours(Number(e.target.value))}
              style={{ width: '80px' }}
            />
            <span className="gf-muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}>hours</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              className="gf-input"
              type="number"
              min={0}
              max={59}
              value={timeoutMinutes}
              onChange={e => setTimeoutMinutes(Number(e.target.value))}
              style={{ width: '80px' }}
            />
            <span className="gf-muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}>minutes</span>
          </label>
        </div>
      </div>
          {error && <p className="gf-feedback gf-feedback--error">{error}</p>}
          <button className="gf-button gf-button--primary" type="submit" disabled={saving}>
            {saving ? 'Working...' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
}
