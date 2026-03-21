import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCurrentUserId } from '../api/client';

export default function EventCreationForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!getCurrentUserId()) {
    navigate('/login?returnTo=/events/new', { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const event = await api.post<{ id: string }>('/events', { title, description });
      navigate(`/events/${event.id}`);
    } catch {
      setError('Could not create the group.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">Create group</h2>
      <div className="gf-card">
        <form className="gf-form" onSubmit={handleSubmit}>
          <label className="gf-field">
            <span className="gf-field__label">Title</span>
            <span className="gf-field__hint">A short, clear title works best.</span>
            <input className="gf-input" placeholder="Sunday dinner in Berlin" value={title} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="gf-field">
            <span className="gf-field__label">Description</span>
            <span className="gf-field__hint">Optional context for the AI and the group.</span>
            <textarea className="gf-input gf-textarea" placeholder="Keep it flexible, social, and not too expensive." rows={4} value={description} onChange={e => setDescription(e.target.value)} />
          </label>
          {error && <p className="gf-feedback gf-feedback--error">{error}</p>}
          <button className="gf-button gf-button--primary" type="submit" disabled={saving}>
            {saving ? 'Working...' : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  );
}
