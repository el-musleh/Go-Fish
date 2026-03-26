import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useController, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../api/client';
import { toast } from '../components/Toaster';
import LoadingSpinner from '../components/LoadingSpinner';
import { Loader2 } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  options: string[];
}

const questions: Question[] = [
  {
    id: 'q1',
    text: 'What outdoor activities do you enjoy?',
    options: ['Hiking', 'Cycling', 'Swimming', 'Running'],
  },
  {
    id: 'q2',
    text: 'What indoor activities do you prefer?',
    options: ['Board games', 'Cooking', 'Movie nights', 'Video games'],
  },
  {
    id: 'q3',
    text: 'What types of food do you like?',
    options: ['Italian', 'Japanese', 'Mexican', 'Indian', 'Thai'],
  },
  {
    id: 'q4',
    text: 'What sports interest you?',
    options: ['Basketball', 'Soccer', 'Tennis', 'Volleyball'],
  },
  {
    id: 'q5',
    text: 'What creative activities appeal to you?',
    options: ['Painting', 'Music', 'Photography', 'Writing'],
  },
  {
    id: 'q6',
    text: 'What social settings do you prefer?',
    options: ['Small groups', 'Large parties', 'One-on-one', 'Online hangouts'],
  },
  {
    id: 'q7',
    text: 'What type of entertainment do you enjoy?',
    options: ['Live music', 'Theater', 'Comedy shows', 'Museums'],
  },
  {
    id: 'q8',
    text: 'What adventure activities interest you?',
    options: ['Rock climbing', 'Kayaking', 'Camping', 'Zip-lining'],
  },
  {
    id: 'q9',
    text: 'What relaxation activities do you prefer?',
    options: ['Yoga', 'Spa day', 'Reading', 'Nature walks'],
  },
  {
    id: 'q10',
    text: 'What learning activities appeal to you?',
    options: ['Workshops', 'Trivia nights', 'Escape rooms', 'Wine tasting', 'Cooking classes'],
  },
];

// Create a dynamic schema based on the questions, requiring at least one answer for each.
const schemaObject = questions.reduce(
  (acc, q) => {
    acc[q.id] = z.array(z.string()).min(1, 'Please select at least one option.');
    return acc;
  },
  {} as Record<string, z.ZodType<string[], string[]>>
);

const benchmarkSchema = z.object(schemaObject);
type BenchmarkFormData = z.infer<typeof benchmarkSchema>;

function QuestionField({
  question,
  control,
  error,
}: {
  question: Question;
  control: Control<BenchmarkFormData>;
  error?: { message?: string };
}) {
  const { field } = useController({ name: question.id, control, defaultValue: [] });
  const [addingOption, setAddingOption] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState('');

  const toggleOption = (option: string) => {
    const currentValues = (field.value as string[]) || [];
    const newValues = currentValues.includes(option)
      ? currentValues.filter((o: string) => o !== option)
      : [...currentValues, option];
    field.onChange(newValues);
  };

  const handleAddOption = () => {
    if (newOptionValue.trim()) {
      toggleOption(newOptionValue.trim());
    }
    setAddingOption(false);
    setNewOptionValue('');
  };

  const allOptions = Array.from(
    new Set([...question.options, ...((field.value as string[]) || [])])
  );

  return (
    <div className={`gf-benchmark-question${error ? ' gf-benchmark-question--error' : ''}`}>
      <div className="gf-benchmark-question__header">
        <span className="gf-benchmark-question__number">{questions.indexOf(question) + 1}.</span>
        <span>{question.text}</span>
      </div>
      {error && <p className="gf-feedback gf-feedback--error">{error.message}</p>}
      <div className="gf-chip-grid">
        {allOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            className="gf-chip-button"
            onClick={() => toggleOption(opt)}
            aria-pressed={(field.value as string[])?.includes(opt)}
          >
            <span
              className={`gf-chip${(field.value as string[])?.includes(opt) ? ' gf-chip--active' : ''}`}
            >
              {opt}
            </span>
          </button>
        ))}
        {addingOption ? (
          <input
            type="text"
            className="gf-input"
            style={{
              padding: '6px 12px',
              fontSize: '0.9rem',
              borderRadius: '999px',
              width: '140px',
              height: 'auto',
              border: '1px dashed var(--line-strong)',
            }}
            placeholder="Type & Enter..."
            autoFocus
            value={newOptionValue}
            onChange={(e) => setNewOptionValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddOption();
              } else if (e.key === 'Escape') {
                setAddingOption(false);
              }
            }}
            onBlur={handleAddOption}
          />
        ) : (
          <button type="button" className="gf-chip-button" onClick={() => setAddingOption(true)}>
            <span className="gf-chip" style={{ borderStyle: 'dashed', background: 'transparent' }}>
              + Add other
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function TasteBenchmarkForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isUpdate, setIsUpdate] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BenchmarkFormData>({
    resolver: zodResolver(benchmarkSchema),
    defaultValues: questions.reduce((acc, q) => ({ ...acc, [q.id]: [] }), {}),
  });

  useEffect(() => {
    api
      .get<{ answers: Record<string, string[]> }>('/taste-benchmark')
      .then((data) => {
        if (data.answers && typeof data.answers === 'object') {
          reset(data.answers); // Set form values with react-hook-form
          setIsUpdate(true);
        }
      })
      .catch(() => {
        /* 404 = no benchmark yet, that's fine */
      })
      .finally(() => setLoading(false));
  }, [reset]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedAnswers = watch();
  const progress = Object.values(watchedAnswers).filter(
    (v) => Array.isArray(v) && v.length > 0
  ).length;
  const pct = (progress / questions.length) * 100;

  const onSubmit = (data: BenchmarkFormData) => {
    const promise = api.post('/taste-benchmark', { answers: data });

    toast.promise(promise, {
      loading: 'Saving your preferences...',
      success: () => {
        const returnTo = searchParams.get('returnTo');
        navigate(returnTo || '/dashboard?prefsUpdated=1');
        return 'Preferences saved successfully!';
      },
      error: 'Failed to save preferences. Please try again.',
    });
  };

  if (loading)
    return (
      <div className="gf-page-center">
        <LoadingSpinner size="lg" label="Loading preferences..." />
      </div>
    );

  return (
    <div className="gf-stack gf-stack--xl">
      <div className="gf-benchmark-progress-container">
        <div className="gf-benchmark-progress-header">
          <span>Question {progress} of {questions.length}</span>
          <span className="gf-benchmark-progress-pct">{Math.round(pct)}%</span>
        </div>
        <div
          className="gf-benchmark-progress"
          role="progressbar"
          aria-label="Questions answered"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={questions.length}
        >
          <div className="gf-benchmark-progress__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div>
        <h1 className="gf-section-title">{isUpdate ? 'Update Preferences' : 'Taste Benchmark'}</h1>
        <p className="gf-muted">
          {isUpdate
            ? 'Update your preferences to help us find better activities for your group.'
            : "Tell us what you're into so we can find the perfect activity for your group."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="gf-stack gf-stack--xl" noValidate>
        {questions.map((q) => (
          <QuestionField key={q.id} question={q} control={control} error={errors[q.id]} />
        ))}

        <button
          type="submit"
          disabled={isSubmitting}
          className="gf-button gf-button--primary gf-button--full"
          aria-label={isSubmitting ? 'Saving, please wait' : undefined}
        >
          {isSubmitting ? (
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          ) : isUpdate ? (
            'Update Preferences'
          ) : (
            'Submit Preferences'
          )}
        </button>
      </form>
    </div>
  );
}
