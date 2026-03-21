import { useState, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { colors, shared } from '../theme';

export default function EventCreationForm() {
  const navigate = useNavigate();
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validate(): string[] {
    const missing: string[] = [];
    if (!titleRef.current?.value.trim()) missing.push('title');
    if (!descRef.current?.value.trim()) missing.push('description');
    return missing;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');
    setFieldErrors([]);
    const missing = validate();
    if (missing.length > 0) { setFieldErrors(missing); return; }

    setSubmitting(true);
    try {
      const event = await api.post<{ id: string }>('/events', {
        title: titleRef.current!.value.trim(),
        description: descRef.current!.value.trim(),
      });
      navigate(`/events/${event.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'fields' in (err.body as Record<string, unknown>)) {
        setFieldErrors((err.body as { fields: string[] }).fields);
      } else {
        setServerError('Failed to create event. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function clearFieldError(field: string) {
    setFieldErrors((prev) => prev.filter((f) => f !== field));
  }

  const hasErr = (f: string) => fieldErrors.includes(f);

  return (
    <div style={shared.page}>
      <div style={shared.container}>
        <div style={shared.logo}>🐟 Go Fish</div>
        <div style={shared.card}>
          <h1 style={shared.title}>Create an Event</h1>
          <p style={shared.subtitle}>Set up a group activity and invite your friends.</p>

          {serverError && <div style={shared.errorBox} role="alert">{serverError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="event-title" style={shared.label}>Event Title</label>
              <input id="event-title" ref={titleRef} type="text" placeholder="e.g. Weekend Hangout"
                onChange={() => clearFieldError('title')}
                style={{ ...shared.input, ...(hasErr('title') ? shared.inputError : {}) }}
                aria-invalid={hasErr('title')}
                aria-describedby={hasErr('title') ? 'title-error' : undefined}
              />
              {hasErr('title') && <p id="title-error" role="alert" style={shared.fieldError}>Title is required</p>}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="event-description" style={shared.label}>Description</label>
              <textarea id="event-description" ref={descRef} rows={4}
                placeholder="What's the plan? Give your friends some context..."
                onChange={() => clearFieldError('description')}
                style={{ ...shared.input, resize: 'vertical' as const, ...(hasErr('description') ? shared.inputError : {}) }}
                aria-invalid={hasErr('description')}
                aria-describedby={hasErr('description') ? 'desc-error' : undefined}
              />
              {hasErr('description') && <p id="desc-error" role="alert" style={shared.fieldError}>Description is required</p>}
            </div>

            <button type="submit" disabled={submitting}
              style={{ ...shared.btn, width: '100%', ...(submitting ? shared.btnDisabled : {}) }}>
              {submitting ? 'Creating…' : 'Create Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
