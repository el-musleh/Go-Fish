import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';

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
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUpdate, setIsUpdate] = useState(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [addingOptionFor, setAddingOptionFor] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState('');

  // Load existing preferences if any
  useEffect(() => {
    api.get<{ answers: Record<string, string[]> }>('/taste-benchmark')
      .then((data) => {
        if (data.answers && typeof data.answers === 'object') {
          setAnswers(data.answers);
          setIsUpdate(true);
        }
      })
      .catch(() => { /* 404 = no benchmark yet, that's fine */ })
      .finally(() => setLoading(false));
  }, []);

  const progress = questions.filter((q) => answers[q.id]?.length).length;
  const pct = questions.length > 0 ? (progress / questions.length) * 100 : 0;

  function toggleOption(qId: string, option: string) {
    setAnswers((prev) => {
      const cur = prev[qId] || [];
      return { ...prev, [qId]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option] };
    });
    setErrors((prev) => prev.filter((id) => id !== qId));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmittedOnce(true);
    setServerError('');
    const missing = questions.filter((q) => !answers[q.id]?.length).map((q) => q.id);
    if (missing.length) {
      setErrors(missing);
      const first = missing[0];
      questionRefs.current[first]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/taste-benchmark', { answers });
      const returnTo = searchParams.get('returnTo');
      if (returnTo) {
        navigate(returnTo);
      } else {
        navigate(isUpdate ? '/dashboard?prefsUpdated=1' : '/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'missingQuestions' in (err.body as Record<string, unknown>)) {
        setErrors((err.body as { missingQuestions: string[] }).missingQuestions);
      } else { setServerError('Failed to submit. Please try again.'); }
    } finally { setSubmitting(false); }
  }

  if (loading) return <p className="gf-muted">Loading…</p>;

  return (
    <div className="gf-stack gf-stack--xl gf-narrow">
      <div>
        <h1 className="gf-section-title">{isUpdate ? 'Update Preferences' : 'Taste Benchmark'}</h1>
        <p className="gf-muted">
          {isUpdate
            ? 'Update your preferences to help us find better activities for your group.'
            : 'Tell us what you\'re into so we can find the perfect activity for your group.'}
        </p>
      </div>

      <div className="gf-benchmark-progress">
        <div className="gf-benchmark-progress__fill" style={{ width: `${pct}%` }} />
      </div>

      {serverError && <p className="gf-feedback gf-feedback--error">{serverError}</p>}

      <form onSubmit={handleSubmit} className="gf-stack gf-stack--xl">
        {questions.map((q, idx) => {
          const hasErr = submittedOnce && errors.includes(q.id);
          return (
            <div
              key={q.id}
              ref={(el) => { questionRefs.current[q.id] = el; }}
              className={`gf-benchmark-question${hasErr ? ' gf-benchmark-question--error' : ''}`}
            >
              <div className="gf-benchmark-question__header">
                <span className="gf-benchmark-question__number">{idx + 1}.</span>
                <span>{q.text}</span>
              </div>
              {hasErr && <p className="gf-feedback gf-feedback--error">Pick at least one</p>}
              <div className="gf-chip-grid">
                {Array.from(new Set([...q.options, ...(answers[q.id] || [])])).map((opt) => {
                  const selected = answers[q.id]?.includes(opt);
                  return (
                    <button key={opt} type="button" className="gf-chip-button" onClick={() => toggleOption(q.id, opt)} aria-pressed={selected}>
                      <span className={`gf-chip${selected ? ' gf-chip--active' : ''}`}>{opt}</span>
                    </button>
                  );
                })}
                {addingOptionFor === q.id ? (
                  <input
                    type="text"
                    className="gf-input"
                    style={{ padding: '6px 12px', fontSize: '0.9rem', borderRadius: '999px', width: '140px', height: 'auto', border: '1px dashed var(--line-strong)' }}
                    placeholder="Type & Enter..."
                    autoFocus
                    value={newOptionValue}
                    onChange={e => setNewOptionValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newOptionValue.trim() && !answers[q.id]?.includes(newOptionValue.trim())) {
                          toggleOption(q.id, newOptionValue.trim());
                        }
                        setAddingOptionFor(null);
                      } else if (e.key === 'Escape') {
                        setAddingOptionFor(null);
                      }
                    }}
                    onBlur={() => {
                      if (newOptionValue.trim() && !answers[q.id]?.includes(newOptionValue.trim())) {
                        toggleOption(q.id, newOptionValue.trim());
                      }
                      setAddingOptionFor(null);
                    }}
                  />
                ) : (
                  <button type="button" className="gf-chip-button" onClick={() => { setAddingOptionFor(q.id); setNewOptionValue(''); }}>
                    <span className="gf-chip" style={{ borderStyle: 'dashed', background: 'transparent' }}>+ Add other</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <button type="submit" disabled={submitting} className="gf-button gf-button--primary gf-button--full">
          {submitting ? 'Saving…' : (isUpdate ? 'Update Preferences' : 'Submit Preferences')}
        </button>
      </form>
    </div>
  );
}
