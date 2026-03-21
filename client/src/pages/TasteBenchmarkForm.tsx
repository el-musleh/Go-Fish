import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { colors, shared } from '../theme';

interface Question { id: string; text: string; options: string[]; }

const questions: Question[] = [
  { id: 'q1', text: 'What outdoor activities do you enjoy?', options: ['Hiking', 'Cycling', 'Swimming', 'Running'] },
  { id: 'q2', text: 'What indoor activities do you prefer?', options: ['Board games', 'Cooking', 'Movie nights', 'Video games'] },
  { id: 'q3', text: 'What types of food do you like?', options: ['Italian', 'Japanese', 'Mexican', 'Indian', 'Thai'] },
  { id: 'q4', text: 'What sports interest you?', options: ['Basketball', 'Soccer', 'Tennis', 'Volleyball'] },
  { id: 'q5', text: 'What creative activities appeal to you?', options: ['Painting', 'Music', 'Photography', 'Writing'] },
  { id: 'q6', text: 'What social settings do you prefer?', options: ['Small groups', 'Large parties', 'One-on-one', 'Online hangouts'] },
  { id: 'q7', text: 'What type of entertainment do you enjoy?', options: ['Live music', 'Theater', 'Comedy shows', 'Museums'] },
  { id: 'q8', text: 'What adventure activities interest you?', options: ['Rock climbing', 'Kayaking', 'Camping', 'Zip-lining'] },
  { id: 'q9', text: 'What relaxation activities do you prefer?', options: ['Yoga', 'Spa day', 'Reading', 'Nature walks'] },
  { id: 'q10', text: 'What learning activities appeal to you?', options: ['Workshops', 'Trivia nights', 'Escape rooms', 'Wine tasting', 'Cooking classes'] },
];

export default function TasteBenchmarkForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  function toggleOption(qId: string, option: string) {
    setAnswers((prev) => {
      const cur = prev[qId] || [];
      return { ...prev, [qId]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option] };
    });
    setErrors((prev) => prev.filter((id) => id !== qId));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');
    const missing = questions.filter((q) => !answers[q.id]?.length).map((q) => q.id);
    if (missing.length) { setErrors(missing); return; }

    setSubmitting(true);
    try {
      await api.post('/taste-benchmark', { answers });
      navigate(searchParams.get('returnTo') || '/events/new');
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'missingQuestions' in (err.body as Record<string, unknown>)) {
        setErrors((err.body as { missingQuestions: string[] }).missingQuestions);
      } else { setServerError('Failed to submit. Please try again.'); }
    } finally { setSubmitting(false); }
  }

  const progress = questions.filter((q) => answers[q.id]?.length).length;

  return (
    <div style={shared.page}>
      <div style={{ ...shared.container, maxWidth: 640 }}>
        <div style={shared.logo}>🐟 Go Fish</div>
        <div style={shared.card}>
          <h1 style={shared.title}>Taste Benchmark</h1>
          <p style={shared.subtitle}>Tell us what you're into so we can find the perfect activity for your group.</p>

          <div style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 24 }}>
            <div style={{ height: '100%', borderRadius: 2, backgroundColor: colors.orange, width: `${(progress / questions.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>

          {serverError && <div style={shared.errorBox} role="alert">{serverError}</div>}

          <form onSubmit={handleSubmit}>
            {questions.map((q, idx) => {
              const hasErr = errors.includes(q.id);
              return (
                <div key={q.id} style={{
                  padding: 16, marginBottom: 16, borderRadius: 12,
                  border: `1px solid ${hasErr ? colors.error : colors.border}`,
                  backgroundColor: hasErr ? colors.errorBg : '#FAFAFA',
                }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0 0 10px' }}>
                    <span style={{ color: colors.orange }}>{idx + 1}.</span> {q.text}
                  </p>
                  {hasErr && <p role="alert" style={shared.fieldError}>Pick at least one</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {q.options.map((opt) => {
                      const selected = answers[q.id]?.includes(opt);
                      return (
                        <button key={opt} type="button" onClick={() => toggleOption(q.id, opt)}
                          style={{
                            padding: '6px 14px', fontSize: '0.85rem', borderRadius: 20, cursor: 'pointer',
                            border: `1.5px solid ${selected ? colors.orange : colors.border}`,
                            backgroundColor: selected ? colors.orangeLight : '#fff',
                            color: selected ? colors.orangeHover : colors.text,
                            fontWeight: selected ? 600 : 400,
                            transition: 'all 0.15s',
                          }}
                          aria-pressed={selected}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <button type="submit" disabled={submitting}
              style={{ ...shared.btn, width: '100%', marginTop: 8, ...(submitting ? shared.btnDisabled : {}) }}>
              {submitting ? 'Submitting…' : 'Submit Preferences'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
