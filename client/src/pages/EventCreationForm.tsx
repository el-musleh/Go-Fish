import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { api, getCurrentUserId } from '../api/client';

const TIME_OPTIONS = ['08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '19:00', '20:00'];

export default function EventCreationForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!getCurrentUserId()) {
    navigate('/login?returnTo=/events/new', { replace: true });
    return null;
  }

  async function handleSubmit(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const event = await api.post<{ id: string }>('/events', {
        title,
        description,
        location_city: location || undefined,
        location_country: 'DE',
        location_lat: null,
        location_lng: null,
        date: date || undefined,
        time: time || undefined,
        participants: participants !== '' ? participants : undefined,
      });
      navigate(`/events/${event.id}`);
    } catch {
      setError('Could not create the group.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">Create event</h2>
      <div className="gf-card">
        <form className="gf-form" onSubmit={handleSubmit}>

          <label className="gf-field">
            <span className="gf-field__label">Event name</span>
            <span className="gf-field__hint">A short, clear title works best.</span>
            <input
              className="gf-input"
              placeholder="Sunday dinner in Berlin"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </label>

          <div className="gf-form-row">
            <label className="gf-field">
              <span className="gf-field__label">Date</span>
              <input
                className="gf-input"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </label>
            <label className="gf-field">
              <span className="gf-field__label">Time</span>
              <select
                className="gf-input"
                value={time}
                onChange={e => setTime(e.target.value)}
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="gf-field">
            <span className="gf-field__label">Location</span>
            <div className="gf-input-icon-wrapper">
              <MapPin size={15} className="gf-input-icon" />
              <input
                className="gf-input"
                placeholder="Hall of Soccer GmbH, Berlin"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </label>

          <div className="gf-form-row">
            <label className="gf-field">
              <span className="gf-field__label">Participants</span>
              <input
                className="gf-input"
                type="number"
                min={1}
                placeholder="e.g. 10"
                value={participants}
                onChange={e => setParticipants(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>
            <div className="gf-field">
              <span className="gf-field__label">Cost budgeting</span>
              <div
                className="gf-input"
                style={{ display: 'flex', alignItems: 'center', opacity: 0.5, cursor: 'default' }}
              >
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>—  (coming soon)</span>
              </div>
            </div>
          </div>

          <label className="gf-field">
            <span className="gf-field__label">Description</span>
            <span className="gf-field__hint">Optional context for the AI and the group.</span>
            <textarea
              className="gf-input gf-textarea"
              placeholder="Keep it flexible, social, and not too expensive."
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>

          {error && <p className="gf-feedback gf-feedback--error">{error}</p>}
          <button className="gf-button gf-button--primary" type="submit" disabled={saving}>
            {saving ? 'Working...' : 'Create event'}
          </button>
        </form>
      </div>
    </div>
  );
}
