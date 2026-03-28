import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useController, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  api,
  type UserProfile,
  type StorageInfo,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../api/client';
import { toast } from '../components/Toaster';
import LoadingSpinner from '../components/LoadingSpinner';
import ValidatedInput from '../components/ValidatedInput';
import Onboarding from '../components/Onboarding';
import { ModelSelector } from '../components/ModelSelector';
import { ProviderSelector } from '../components/ProviderSelector';
import { VersionInfo } from '../components/ReleaseChecker';
import { LicenseList } from '../components/LicenseList';
import {
  Loader2,
  User,
  Sliders,
  Database,
  ShieldCheck,
  Mail,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Moon,
  Sun,
  Palette,
  Bell,
  Globe,
  Clock,
  EyeOff,
  Type,
  Monitor,
  Settings2,
  LogOut,
  Keyboard,
  Sparkles,
  Info,
  Bug,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { type Theme } from '../lib/theme';
import { type UserPreferences, defaultPreferences } from '../api/client';

/* ── Toggle Switch Component ───────────────────────────── */

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="gf-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="gf-toggle__input"
      />
      <span className="gf-toggle__switch" />
      <span className="gf-toggle__label-group">
        <span className="gf-toggle__label">{label}</span>
        {description && <span className="gf-toggle__description">{description}</span>}
      </span>
    </label>
  );
}

/* ── Taste Benchmark Logic ──────────────────────────────── */

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

const benchmarkSchema = z.object(
  questions.reduce(
    (acc, q) => {
      acc[q.id] = z.array(z.string()).min(1, 'Please select at least one option.');
      return acc;
    },
    {} as Record<string, z.ZodType<string[], string[]>>
  )
);

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
    if (newOptionValue.trim()) toggleOption(newOptionValue.trim());
    setAddingOption(false);
    setNewOptionValue('');
  };

  const allOptions = Array.from(
    new Set([...question.options, ...((field.value as string[]) || [])])
  );

  return (
    <div className={clsx('gf-benchmark-question', error && 'gf-benchmark-question--error')}>
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
              className={clsx(
                'gf-chip',
                (field.value as string[])?.includes(opt) && 'gf-chip--active'
              )}
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
              } else if (e.key === 'Escape') setAddingOption(false);
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

/* ── Settings Sections ──────────────────────────────────── */

function ProfileSection({
  profile,
  onUpdate,
}: {
  profile: UserProfile;
  onUpdate: (data: { name: string }) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name: profile.name || '' },
  });

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Personal Information</h2>
        <p className="gf-muted">How you appear to others in Go Fish.</p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <form onSubmit={handleSubmit(onUpdate)} className="gf-stack">
            <div className="gf-field-row">
              <ValidatedInput
                label="Display Name"
                registration={register('name')}
                error={errors.name}
                placeholder="Your name"
              />
              <div className="gf-field">
                <label className="gf-field__label">Email Address</label>
                <div
                  className="gf-input"
                  style={{
                    opacity: 0.7,
                    background: 'var(--bg-surface)',
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Mail size={16} /> {profile.email}
                </div>
              </div>
            </div>
            <div className="gf-actions">
              <button
                type="submit"
                className="gf-button gf-button--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="gf-stack">
        <h2 className="gf-card-title">Account Security</h2>
        <p className="gf-muted">Manage your authentication and login details.</p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <div className="gf-stack gf-stack--sm">
            <div className="gf-detail-row">
              <span className="gf-detail-row__label">Authentication Provider</span>
              <span
                className="gf-detail-row__value"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ShieldCheck size={16} className="gf-success" />{' '}
                {profile.auth_provider === 'google' ? 'Google OAuth' : 'Email Login'}
              </span>
            </div>
            <div className="gf-detail-row">
              <span className="gf-detail-row__label">Member Since</span>
              <span className="gf-detail-row__value">
                {new Date(profile.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PreferencesSection({ onSave }: { onSave: (data: BenchmarkFormData) => Promise<void> }) {
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
        if (data.answers) reset(data.answers);
      })
      .catch(() => {});
  }, [reset]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const progress = Object.values(watch()).filter((v) => Array.isArray(v) && v.length > 0).length;
  const pct = (progress / questions.length) * 100;

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Activity Preferences</h2>
        <p className="gf-muted">
          Tell us what you're into so we can find the perfect activity for your group.
        </p>

        <div className="gf-stack" style={{ marginTop: '12px' }}>
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
          <form onSubmit={handleSubmit(onSave)} className="gf-stack gf-stack--xl" noValidate>
            <div className="gf-grid gf-grid--two">
              {questions.map((q) => (
                <QuestionField key={q.id} question={q} control={control} error={errors[q.id]} />
              ))}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="gf-button gf-button--primary gf-button--full"
            >
              {isSubmitting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                'Update Activity Preferences'
              )}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function DataSection({ info }: { info: StorageInfo | null }) {
  if (!info) return <LoadingSpinner size="md" />;

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Data Statistics</h2>
        <p className="gf-muted">A summary of your contribution to the Go Fish community.</p>

        <div className="gf-grid gf-grid--three" style={{ marginTop: '12px' }}>
          <div className="gf-card gf-text-center">
            <Calendar size={32} className="gf-muted" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{info.eventsCreated}</div>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              Events Created
            </p>
          </div>
          <div className="gf-card gf-text-center">
            <CheckCircle2 size={32} className="gf-muted" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{info.responsesSubmitted}</div>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              Responses Given
            </p>
          </div>
          <div className="gf-card gf-text-center">
            <Sliders size={32} className="gf-muted" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
              {info.hasTasteBenchmark ? 'Yes' : 'No'}
            </div>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              Taste Benchmark
            </p>
          </div>
        </div>
      </section>

      <section className="gf-stack">
        <h2 className="gf-card-title">Privacy & Portability</h2>
        <p className="gf-muted">
          Your data is yours. We ensure it's handled with the highest level of care.
        </p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <p className="gf-muted" style={{ lineHeight: 1.6 }}>
            We store your preferences and availability solely to coordinate events with your crew.
            Your taste benchmark is used to improve our AI suggestions for you.
          </p>
          <div className="gf-actions" style={{ marginTop: '24px' }}>
            <button
              className="gf-button gf-button--ghost"
              onClick={() =>
                toast.success('Data export requested. You will receive an email shortly.')
              }
            >
              Export My Data
            </button>
            <button
              className="gf-button gf-button--secondary"
              style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              onClick={() =>
                toast.error('Account deletion requires a support ticket at this time.')
              }
            >
              Request Deletion
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfrastructureSection({
  profile,
  onUpdate,
}: {
  profile: UserProfile;
  onUpdate: (data: {
    ai_api_key: string | null;
    ai_model: string | null;
    ai_provider: string | null;
  }) => Promise<void>;
}) {
  const [selectedProvider, setSelectedProvider] = useState(profile.ai_provider || 'openrouter');
  const [selectedModel, setSelectedModel] = useState(profile.ai_model || '');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm({
    defaultValues: { ai_api_key: profile.ai_api_key || '' },
  });

  const currentApiKey = watch('ai_api_key');

  // Validate API key format
  const validateApiKey = (key: string): string | undefined => {
    if (!key.trim()) return undefined; // Empty is OK (use default)

    // OpenRouter keys start with sk-or-v1-
    if (key.startsWith('sk-or-v1-')) return undefined;

    // DeepSeek keys start with sk-
    if (key.startsWith('sk-')) return undefined;

    // Google/Gemini keys start with AIza
    if (key.startsWith('AIza')) return undefined;

    // Anthropic keys start with sk-ant-
    if (key.startsWith('sk-ant-')) return undefined;

    return 'Invalid API key format. Key should start with sk-, sk-or-v1-, AIza, or sk-ant-';
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    const validationError = validateApiKey(key);
    if (validationError) {
      setError('ai_api_key', { message: validationError });
    } else {
      clearErrors('ai_api_key');
    }
  };

  const handleFormSubmit = async (data: { ai_api_key: string }) => {
    await onUpdate({
      ai_api_key: data.ai_api_key?.trim() || null,
      ai_model: selectedModel || null,
      ai_provider: selectedProvider || null,
    });
  };

  const handleReset = async () => {
    await onUpdate({
      ai_api_key: null,
      ai_model: null,
      ai_provider: null,
    });
    setSelectedProvider('openrouter');
    setSelectedModel('');
  };

  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    const keyToTest = currentApiKey?.trim() || profile.ai_api_key;
    if (!keyToTest) {
      toast.error('Enter an API key first.');
      return;
    }
    if (!selectedModel) {
      toast.error('Select a model first.');
      return;
    }
    setIsTesting(true);
    try {
      const response = await api.post<{ success: boolean; message: string }>('/ai/test-real', {
        provider: selectedProvider,
        model: selectedModel,
        apiKey: keyToTest,
      });
      if (response.success) {
        toast.success(response.message || 'Connection successful!');
      } else {
        toast.error(response.message || 'Connection failed. Please check your settings.');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Connection failed. Please check your API key and try again.';
      toast.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  const hasApiKey = !!(currentApiKey?.trim() || profile.ai_api_key);

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">AI Configuration</h2>
        <p className="gf-muted">
          Connect your own AI provider to generate activity suggestions. DeepSeek and OpenAI keys
          are used directly; all other providers route through OpenRouter.
        </p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="gf-stack">
            {/* API Key Status - Show at top when no API key */}
            {!hasApiKey && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px 16px',
                  background: 'rgba(var(--accent-rgb), 0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(var(--accent-rgb), 0.2)',
                }}
              >
                <Info
                  size={20}
                  style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span
                    style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}
                  >
                    No API Key Configured
                  </span>
                  <span
                    style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}
                  >
                    An API key is required for AI generation. Add your provider key below — DeepSeek
                    and OpenAI keys work directly, others require an OpenRouter key.
                  </span>
                </div>
              </div>
            )}

            <div className="gf-field">
              <label className="gf-field__label">AI Provider</label>
              <ProviderSelector
                selectedProvider={selectedProvider}
                onSelect={setSelectedProvider}
              />
            </div>

            <ModelSelector
              currentModel={selectedModel}
              onSelect={(model) => setSelectedModel(model)}
              provider={selectedProvider}
            />

            <ValidatedInput
              label="API Key"
              registration={register('ai_api_key')}
              error={errors.ai_api_key}
              placeholder="sk-... (DeepSeek / OpenAI) or sk-or-v1-... (OpenRouter)"
              type="password"
              onChange={handleApiKeyChange}
              hint="Your key is stored securely and used only for your own AI requests."
            />

            <div className="gf-actions">
              <button
                type="submit"
                className="gf-button gf-button--primary"
                disabled={isSubmitting || isTesting}
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Save AI Settings'}
              </button>
              {hasApiKey && (
                <>
                  <button
                    type="button"
                    className="gf-button gf-button--secondary"
                    onClick={handleTestConnection}
                    disabled={isSubmitting || isTesting}
                  >
                    {isTesting ? <Loader2 size={16} className="animate-spin" /> : 'Test Connection'}
                  </button>
                  <button
                    type="button"
                    className="gf-button gf-button--ghost"
                    onClick={handleReset}
                    disabled={isSubmitting || isTesting}
                  >
                    Reset
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className="gf-stack">
        <h2 className="gf-card-title">Database & Infrastructure</h2>
        <p className="gf-muted">Current system status and infrastructure details.</p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <div className="gf-stack gf-stack--sm">
            <div className="gf-detail-row">
              <span className="gf-detail-row__label">Database Engine</span>
              <span
                className="gf-detail-row__value"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Database size={16} className="gf-success" /> PostgreSQL
              </span>
            </div>
            <div className="gf-detail-row">
              <span className="gf-detail-row__label">Infrastructure</span>
              <span className="gf-detail-row__value">Managed Cloud</span>
            </div>
            <div className="gf-detail-row">
              <span className="gf-detail-row__label">Region</span>
              <span className="gf-detail-row__value">Global (Edge Optimized)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AppearanceSection({
  theme,
  onThemeChange,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}) {
  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Visual Appearance</h2>
        <p className="gf-muted">Customize how Go Fish looks on your device.</p>

        <div className="gf-grid gf-grid--three" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className={clsx('gf-card gf-text-center', theme === 'system' && 'gf-card--active')}
            style={{
              borderColor: theme === 'system' ? 'var(--accent)' : undefined,
              boxShadow: theme === 'system' ? '0 0 0 3px rgba(var(--accent-rgb), 0.15)' : undefined,
              cursor: 'pointer',
            }}
            onClick={() => onThemeChange('system')}
          >
            <Settings2
              size={32}
              className={theme === 'system' ? 'gf-accent' : 'gf-muted'}
              style={{ margin: '0 auto 12px' }}
            />
            <div style={{ fontWeight: 700 }}>System</div>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              Match device settings
            </p>
          </button>

          <button
            type="button"
            className={clsx('gf-card gf-text-center', theme === 'day' && 'gf-card--active')}
            style={{
              borderColor: theme === 'day' ? 'var(--accent)' : undefined,
              boxShadow: theme === 'day' ? '0 0 0 3px rgba(var(--accent-rgb), 0.15)' : undefined,
              cursor: 'pointer',
            }}
            onClick={() => onThemeChange('day')}
          >
            <Sun
              size={32}
              className={theme === 'day' ? 'gf-accent' : 'gf-muted'}
              style={{ margin: '0 auto 12px' }}
            />
            <div style={{ fontWeight: 700 }}>Day Mode</div>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              Light and crisp
            </p>
          </button>

          <button
            type="button"
            className={clsx('gf-card gf-text-center', theme === 'night' && 'gf-card--active')}
            style={{
              borderColor: theme === 'night' ? 'var(--accent)' : undefined,
              boxShadow: theme === 'night' ? '0 0 0 3px rgba(var(--accent-rgb), 0.15)' : undefined,
              cursor: 'pointer',
            }}
            onClick={() => onThemeChange('night')}
          >
            <Moon
              size={32}
              className={theme === 'night' ? 'gf-accent' : 'gf-muted'}
              style={{ margin: '0 auto 12px' }}
            />
            <div style={{ fontWeight: 700 }}>Night Mode</div>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              Dark and cozy
            </p>
          </button>
        </div>
      </section>
    </div>
  );
}

/* ── Email & Notifications Section ───────────────────────── */

function EmailNotificationsSection() {
  const [emailPrefs, setEmailPrefs] = useState<NotificationPreferences>({
    email_on_event_confirmed: true,
    email_on_new_rsvp: false,
    email_on_options_ready: false,
  });
  const [savingEmail, setSavingEmail] = useState(false);

  const fetchEmailPreferences = useCallback(async () => {
    try {
      const prefs = await getNotificationPreferences();
      setEmailPrefs(prefs);
    } catch (error) {
      console.error('Failed to fetch email preferences:', error);
    }
  }, []);

  useEffect(() => {
    fetchEmailPreferences();
  }, [fetchEmailPreferences]);

  const handleEmailPrefChange = async (key: keyof NotificationPreferences) => {
    const newPrefs = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(newPrefs);
    setSavingEmail(true);
    try {
      await updateNotificationPreferences({ [key]: newPrefs[key] });
      toast.success('Email preferences updated');
    } catch (error) {
      console.error('Failed to update email preferences:', error);
      setEmailPrefs(emailPrefs); // Revert on error
      toast.error('Failed to update preferences');
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Email & Notifications</h2>
        <p className="gf-muted">Control when you receive email updates from Go Fish.</p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <div className="gf-stack gf-stack--md">
            <Toggle
              checked={emailPrefs.email_on_event_confirmed}
              onChange={() => !savingEmail && handleEmailPrefChange('email_on_event_confirmed')}
              label="Event is confirmed"
              description="Get notified when an activity is selected (recommended)"
            />
            <Toggle
              checked={emailPrefs.email_on_new_rsvp}
              onChange={() => !savingEmail && handleEmailPrefChange('email_on_new_rsvp')}
              label="New participant RSVPs"
              description="Get notified when someone responds to your event"
            />
            <Toggle
              checked={emailPrefs.email_on_options_ready}
              onChange={() => !savingEmail && handleEmailPrefChange('email_on_options_ready')}
              label="Activity options are ready"
              description="Get notified when AI suggestions are generated"
            />
          </div>
          {savingEmail && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="gf-muted" style={{ fontSize: '0.85rem' }}>
                Saving...
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Accessibility Section ───────────────────────────────── */

function AccessibilitySection({
  preferences,
  onSave,
}: {
  preferences: UserPreferences['accessibility'];
  onSave: (data: UserPreferences['accessibility']) => Promise<void>;
}) {
  const [local, setLocal] = useState(preferences);
  const [saving, setSaving] = useState(false);

  const handleOptionChange = (key: keyof typeof local, value: string | boolean) => {
    setLocal((prev: typeof local) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  const fontSizes = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Accessibility Options</h2>
        <p className="gf-muted">Customize the display for better readability and comfort.</p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <div className="gf-stack gf-stack--lg">
            <div className="gf-field">
              <label
                className="gf-field__label"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Type size={16} /> Font Size
              </label>
              <div className="gf-segmented-control">
                {fontSizes.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    className={clsx(
                      'gf-segmented-control__item',
                      local.font_size === size.value && 'gf-segmented-control__item--active'
                    )}
                    onClick={() => handleOptionChange('font_size', size.value)}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            <Toggle
              checked={local.reduced_motion}
              onChange={(checked) => handleOptionChange('reduced_motion', checked)}
              label="Reduced Motion"
              description="Minimize animations throughout the app"
            />
            <Toggle
              checked={local.compact_mode}
              onChange={(checked) => handleOptionChange('compact_mode', checked)}
              label="Compact Mode"
              description="Reduce spacing for more content visibility"
            />
          </div>
          <div className="gf-actions" style={{ marginTop: '24px' }}>
            <button className="gf-button gf-button--primary" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                'Save Accessibility Settings'
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Regional Section ───────────────────────────────────── */

function RegionalSection({
  preferences,
  onSave,
}: {
  preferences: UserPreferences['regional'];
  onSave: (data: UserPreferences['regional']) => Promise<void>;
}) {
  const [local, setLocal] = useState(preferences);
  const [saving, setSaving] = useState(false);

  const handleOptionChange = (key: keyof typeof local, value: string) => {
    setLocal((prev: typeof local) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  const dateFormats = [
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  ];

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  ];

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Regional Settings</h2>
        <p className="gf-muted">Set your timezone and date format preferences.</p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <div className="gf-stack gf-stack--lg">
            <div className="gf-field">
              <label
                className="gf-field__label"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Globe size={16} /> Time Zone
              </label>
              <select
                className="gf-input"
                value={local.timezone}
                onChange={(e) => handleOptionChange('timezone', e.target.value)}
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="gf-field">
              <label
                className="gf-field__label"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Clock size={16} /> Date Format
              </label>
              <div className="gf-segmented-control">
                {dateFormats.map((format) => (
                  <button
                    key={format.value}
                    type="button"
                    className={clsx(
                      'gf-segmented-control__item',
                      local.date_format === format.value && 'gf-segmented-control__item--active'
                    )}
                    onClick={() => handleOptionChange('date_format', format.value)}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="gf-actions" style={{ marginTop: '24px' }}>
            <button className="gf-button gf-button--primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : 'Save Regional Settings'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Privacy Section ─────────────────────────────────────── */

function PrivacySection({
  preferences,
  onSave,
}: {
  preferences: UserPreferences['privacy'];
  onSave: (data: UserPreferences['privacy']) => Promise<void>;
}) {
  const [local, setLocal] = useState(preferences);
  const [saving, setSaving] = useState(false);

  const handleToggle = (key: keyof typeof local) => {
    setLocal((prev: typeof local) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Privacy Controls</h2>
        <p className="gf-muted">Manage your profile visibility and data sharing.</p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <div className="gf-stack gf-stack--md">
            <Toggle
              checked={local.profile_visible}
              onChange={() => handleToggle('profile_visible')}
              label="Profile Visibility"
              description="Allow others to see your profile"
            />
            <Toggle
              checked={local.show_activity}
              onChange={() => handleToggle('show_activity')}
              label="Show Activity"
              description="Let others see your events and responses"
            />
          </div>
          <div className="gf-actions" style={{ marginTop: '24px' }}>
            <button className="gf-button gf-button--primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : 'Save Privacy Settings'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ShortcutsSection({ onShowOnboarding }: { onShowOnboarding: () => void }) {
  const shortcuts = [
    { key: 'C', description: 'Create new event' },
    { key: 'T', description: 'Go to dashboard' },
    { key: 'S', description: 'Focus search bar' },
    { key: '?', description: 'Show keyboard shortcuts' },
    { key: 'Esc', description: 'Close modal/dialog' },
    { key: 'Arrow Up/Down', description: 'Navigate timeline list' },
  ];

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">Keyboard Shortcuts</h2>
        <p className="gf-muted">Quickly navigate and perform actions using keyboard shortcuts.</p>
        <div className="gf-card" style={{ marginTop: '12px' }}>
          <div className="gf-stack gf-stack--md">
            {shortcuts.map((s) => (
              <div
                key={s.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span style={{ color: 'var(--muted)' }}>{s.description}</span>
                <kbd
                  style={{
                    padding: '4px 10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="gf-stack">
        <h2 className="gf-card-title">Quick Start Guide</h2>
        <p className="gf-muted">Not sure how to get started? View our quick tour.</p>
        <button
          type="button"
          className="gf-button gf-button--secondary"
          onClick={onShowOnboarding}
          style={{ alignSelf: 'flex-start', marginTop: '8px' }}
        >
          <Sparkles size={16} /> View Quick Tour
        </button>
      </section>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */

interface SettingsProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onSignOut: () => void;
  onSignIn: () => void;
}

export default function Settings({ theme, onThemeChange, onSignOut }: SettingsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setErrorDetails(null);
      console.log('[Debug] Starting fetchAll...');
      const [p, s] = await Promise.all([
        api.get<UserProfile>('/auth/me').catch((err) => {
          console.error('[Debug] /auth/me failed:', err);
          throw new Error(`/auth/me: ${err.status || 'Error'}`);
        }),
        api.get<StorageInfo>('/auth/storage-info').catch((err) => {
          console.error('[Debug] /auth/storage-info failed:', err);
          throw new Error(`/auth/storage-info: ${err.status || 'Error'}`);
        }),
      ]);
      console.log('[Debug] fetchAll success:', { p, s });
      setProfile(p);
      setStorageInfo(s);
    } catch (err) {
      console.error('Failed to load settings:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setErrorDetails(message);
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load preferences from localStorage
    const savedPrefs = localStorage.getItem('gofish_preferences');
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch {
        // Use defaults if parsing fails
      }
    }
    fetchAll();
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleUpdateProfile = async (data: { name: string }) => {
    const promise = api.patch<UserProfile>('/auth/me', data);
    toast.promise(promise, {
      loading: 'Updating profile...',
      success: (p) => {
        setProfile(p);
        return 'Profile updated!';
      },
      error: 'Failed to update profile.',
    });
  };

  const handleUpdateInfrastructure = async (data: {
    ai_api_key: string | null;
    ai_model: string | null;
    ai_provider: string | null;
  }) => {
    const cleanData = {
      ai_api_key: data.ai_api_key?.trim() || null,
      ai_model: data.ai_model || null,
      ai_provider: data.ai_provider || null,
    };
    const promise = api.patch<UserProfile>('/auth/me', cleanData);
    toast.promise(promise, {
      loading: 'Updating infrastructure settings...',
      success: (p) => {
        setProfile(p);
        return 'Infrastructure updated!';
      },
      error: 'Failed to update infrastructure.',
    });
  };

  const handleSavePreferences = async (data: BenchmarkFormData) => {
    const promise = api.post('/taste-benchmark', { answers: data });
    toast.promise(promise, {
      loading: 'Saving preferences...',
      success: () => {
        fetchAll();
        return 'Preferences updated!';
      },
      error: 'Failed to save preferences.',
    });
  };

  const handleSaveAccessibility = async (data: UserPreferences['accessibility']) => {
    const newPrefs = { ...preferences, accessibility: data };
    setPreferences(newPrefs);
    localStorage.setItem('gofish_preferences', JSON.stringify(newPrefs));
    toast.success('Accessibility settings saved!');
  };

  const handleSaveRegional = async (data: UserPreferences['regional']) => {
    const newPrefs = { ...preferences, regional: data };
    setPreferences(newPrefs);
    localStorage.setItem('gofish_preferences', JSON.stringify(newPrefs));
    toast.success('Regional settings saved!');
  };

  const handleSavePrivacy = async (data: UserPreferences['privacy']) => {
    const newPrefs = { ...preferences, privacy: data };
    setPreferences(newPrefs);
    localStorage.setItem('gofish_preferences', JSON.stringify(newPrefs));
    toast.success('Privacy settings saved!');
  };

  if (loading)
    return (
      <div className="gf-page-center">
        <LoadingSpinner size="lg" label="Loading settings..." />
      </div>
    );

  if (!profile)
    return (
      <div className="gf-page-center">
        <div className="gf-stack gf-text-center" style={{ alignItems: 'center' }}>
          <p className="gf-feedback gf-feedback--error">Failed to load user profile.</p>
          {errorDetails && (
            <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              {errorDetails}
            </p>
          )}
          <button
            className="gf-button gf-button--secondary"
            onClick={fetchAll}
            style={{ marginTop: '16px' }}
          >
            Retry
          </button>
        </div>
      </div>
    );

  return (
    <div className="gf-stack gf-stack--xl">
      <header>
        <h1 className="gf-section-title">Settings</h1>
        <p className="gf-muted">Manage your profile, activity preferences, and data footprint.</p>
      </header>

      <div className="gf-settings-layout">
        <aside className="gf-settings-sidebar">
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'profile' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('profile')}
          >
            <User size={20} />
            <span style={{ flex: 1 }}>Profile</span>
            {activeTab === 'profile' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'appearance' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('appearance')}
          >
            <Palette size={20} />
            <span style={{ flex: 1 }}>Appearance</span>
            {activeTab === 'appearance' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'preferences' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('preferences')}
          >
            <Sliders size={20} />
            <span style={{ flex: 1 }}>Preferences</span>
            {activeTab === 'preferences' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'infrastructure' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('infrastructure')}
          >
            <Cpu size={20} />
            <span style={{ flex: 1 }}>Infrastructure</span>
            {activeTab === 'infrastructure' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'notifications' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('notifications')}
          >
            <Bell size={20} />
            <span style={{ flex: 1 }}>Notifications</span>
            {activeTab === 'notifications' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'accessibility' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('accessibility')}
          >
            <Monitor size={20} />
            <span style={{ flex: 1 }}>Accessibility</span>
            {activeTab === 'accessibility' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'shortcuts' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('shortcuts')}
          >
            <Keyboard size={20} />
            <span style={{ flex: 1 }}>Shortcuts</span>
            {activeTab === 'shortcuts' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'regional' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('regional')}
          >
            <Globe size={20} />
            <span style={{ flex: 1 }}>Regional</span>
            {activeTab === 'regional' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'privacy' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('privacy')}
          >
            <EyeOff size={20} />
            <span style={{ flex: 1 }}>Privacy</span>
            {activeTab === 'privacy' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'data' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('data')}
          >
            <Database size={20} />
            <span style={{ flex: 1 }}>Data & Storage</span>
            {activeTab === 'data' && <ChevronRight size={16} />}
          </button>
          <button
            className={clsx(
              'gf-settings-nav-item',
              activeTab === 'about' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('about')}
          >
            <Info size={20} />
            <span style={{ flex: 1 }}>About</span>
            {activeTab === 'about' && <ChevronRight size={16} />}
          </button>
          <a
            href="https://github.com/el-musleh/Go-Fish/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="gf-settings-nav-item"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Bug size={20} />
            <span style={{ flex: 1 }}>Report Bug</span>
            <ExternalLink size={14} />
          </a>
          <button className="gf-settings-nav-item gf-settings-nav-item--danger" onClick={onSignOut}>
            <LogOut size={20} />
            <span style={{ flex: 1 }}>Sign Out</span>
          </button>
        </aside>

        <main className="gf-settings-content">
          {activeTab === 'profile' && (
            <ProfileSection profile={profile} onUpdate={handleUpdateProfile} />
          )}
          {activeTab === 'appearance' && (
            <AppearanceSection theme={theme} onThemeChange={onThemeChange} />
          )}
          {activeTab === 'preferences' && <PreferencesSection onSave={handleSavePreferences} />}
          {activeTab === 'infrastructure' && (
            <InfrastructureSection profile={profile} onUpdate={handleUpdateInfrastructure} />
          )}
          {activeTab === 'notifications' && <EmailNotificationsSection />}
          {activeTab === 'accessibility' && (
            <AccessibilitySection
              preferences={preferences.accessibility}
              onSave={handleSaveAccessibility}
            />
          )}
          {activeTab === 'shortcuts' && (
            <ShortcutsSection onShowOnboarding={() => setShowOnboarding(true)} />
          )}
          {activeTab === 'regional' && (
            <RegionalSection preferences={preferences.regional} onSave={handleSaveRegional} />
          )}
          {activeTab === 'privacy' && (
            <PrivacySection preferences={preferences.privacy} onSave={handleSavePrivacy} />
          )}
          {activeTab === 'data' && <DataSection info={storageInfo} />}
          {activeTab === 'about' && (
            <div className="gf-stack">
              <header>
                <h1 className="gf-section-title">About Go Fish</h1>
                <p className="gf-muted">
                  Learn more about Go Fish and the open source software we use.
                </p>
              </header>

              {/* Release Notes Section */}
              <section className="gf-stack">
                <h2 className="gf-card-title">Release Notes</h2>
                <p className="gf-muted">
                  Stay up to date with the latest features and improvements.
                </p>
                <div className="gf-card" style={{ marginTop: '12px' }}>
                  <VersionInfo />
                </div>
              </section>

              {/* Open Source Licenses Section */}
              <section className="gf-stack">
                <h2 className="gf-card-title">Open Source Licenses</h2>
                <p className="gf-muted">Go Fish uses these open source packages.</p>
                <div className="gf-card" style={{ marginTop: '12px' }}>
                  <LicenseList />
                </div>
              </section>

              {/* Project License Section */}
              <section className="gf-stack">
                <h2 className="gf-card-title">License</h2>
                <p className="gf-muted">Go Fish is open source under the MIT license.</p>
                <div className="gf-card" style={{ marginTop: '12px' }}>
                  <div className="gf-stack gf-stack--sm">
                    <div className="gf-detail-row">
                      <span className="gf-detail-row__label">Project License</span>
                      <span className="gf-detail-row__value">MIT</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      Copyright © 2025 Go Fish. See LICENSE file for details.
                    </p>
                  </div>
                </div>
              </section>

              {/* Report Bug / Suggestion Section */}
              <section className="gf-stack">
                <h2 className="gf-card-title">Report Bug or Suggest Feature</h2>
                <p className="gf-muted">
                  Help us improve Go Fish by reporting bugs or suggesting new features.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <a
                    href="https://github.com/el-musleh/Go-Fish/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gf-button gf-button--primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Bug size={18} />
                    Report a Bug
                    <ExternalLink size={14} />
                  </a>
                  <a
                    href="https://github.com/el-musleh/Go-Fish/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gf-button gf-button--secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    Suggest a Feature
                    <ExternalLink size={14} />
                  </a>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}
