import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useController, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, type UserProfile, type StorageInfo } from '../api/client';
import { toast } from '../components/Toaster';
import LoadingSpinner from '../components/LoadingSpinner';
import ValidatedInput from '../components/ValidatedInput';
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
  LogOut,
  Palette,
} from 'lucide-react';
import { clsx } from 'clsx';
import { type Theme } from '../lib/theme';

/* ... (keep questions and benchmark logic unchanged) ... */

function ProfileSection({
  profile,
  onUpdate,
  onSignOut,
}: {
  profile: UserProfile;
  onUpdate: (data: { name: string }) => Promise<void>;
  onSignOut: () => void;
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
            <div className="gf-actions" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="gf-button gf-button--secondary gf-inline-icon"
                onClick={onSignOut}
                style={{ color: 'var(--danger)', borderColor: 'rgba(var(--danger-rgb), 0.2)' }}
              >
                <LogOut size={18} /> Sign Out
              </button>
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

        <div className="gf-grid gf-grid--two" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className={clsx('gf-card gf-text-center', theme === 'day' && 'gf-card--active')}
            style={{ 
              borderColor: theme === 'day' ? 'var(--accent)' : undefined,
              boxShadow: theme === 'day' ? '0 0 0 3px rgba(var(--accent-rgb), 0.15)' : undefined,
              cursor: 'pointer'
            }}
            onClick={() => onThemeChange('day')}
          >
            <Sun size={32} className={theme === 'day' ? 'gf-accent' : 'gf-muted'} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 700 }}>Day Mode</div>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>Light and crisp</p>
          </button>
          
          <button
            type="button"
            className={clsx('gf-card gf-text-center', theme === 'night' && 'gf-card--active')}
            style={{ 
              borderColor: theme === 'night' ? 'var(--accent)' : undefined,
              boxShadow: theme === 'night' ? '0 0 0 3px rgba(var(--accent-rgb), 0.15)' : undefined,
              cursor: 'pointer'
            }}
            onClick={() => onThemeChange('night')}
          >
            <Moon size={32} className={theme === 'night' ? 'gf-accent' : 'gf-muted'} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 700 }}>Night Mode</div>
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>Dark and cozy</p>
          </button>
        </div>
      </section>
    </div>
  );
}

/* ... (keep PreferencesSection, DataSection, InfrastructureSection unchanged) ... */

export default function Settings({
  theme,
  onThemeChange,
  onSignOut,
  onSignIn,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onSignOut: () => void;
  onSignIn: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  /* ... (keep fetchAll, useEffect, handleTabChange, handleUpdateProfile, handleUpdateInfrastructure, handleSavePreferences unchanged) ... */

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
          <p className="gf-muted" style={{ marginBottom: '16px' }}>You may need to sign in again.</p>
          <button className="gf-button gf-button--primary" onClick={onSignIn}>
            Sign In
          </button>
        </div>
      </div>
    );

  return (
    <div className="gf-stack gf-stack--xl">
      <header>
        <h1 className="gf-section-title">Settings</h1>
        <p className="gf-muted">Manage your profile, appearance, and activity preferences.</p>
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
              activeTab === 'data' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('data')}
          >
            <Database size={20} />
            <span style={{ flex: 1 }}>Data & Storage</span>
            {activeTab === 'data' && <ChevronRight size={16} />}
          </button>
        </aside>

        <main className="gf-settings-content">
          {activeTab === 'profile' && (
            <ProfileSection 
              profile={profile} 
              onUpdate={handleUpdateProfile} 
              onSignOut={onSignOut} 
            />
          )}
          {activeTab === 'appearance' && (
            <AppearanceSection theme={theme} onThemeChange={onThemeChange} />
          )}
          {activeTab === 'preferences' && <PreferencesSection onSave={handleSavePreferences} />}
          {activeTab === 'infrastructure' && (
            <InfrastructureSection profile={profile} onUpdate={handleUpdateInfrastructure} />
          )}
          {activeTab === 'data' && <DataSection info={storageInfo} />}
        </main>
      </div>
    </div>
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
  onUpdate: (data: { ai_api_key: string | null }) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { ai_api_key: profile.ai_api_key || '' },
  });

  return (
    <div className="gf-stack gf-stack--xl">
      <section className="gf-stack">
        <h2 className="gf-card-title">AI Configuration</h2>
        <p className="gf-muted">
          By default, Go Fish uses our managed AI provider (OpenRouter). 
          Provide your own key to use your own usage quotas.
        </p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <form onSubmit={handleSubmit(onUpdate)} className="gf-stack">
            <div className="gf-field">
              <label className="gf-field__label">AI Provider</label>
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
                <Cpu size={16} /> OpenRouter (LangChain)
              </div>
            </div>

            <ValidatedInput
              label="Manual API Key (Optional)"
              registration={register('ai_api_key')}
              error={errors.ai_api_key}
              placeholder="sk-or-v1-..."
              type="password"
            />
            
            <p className="gf-muted" style={{ fontSize: '0.85rem' }}>
              Your key is stored securely and used only for your event generations. 
              Leave empty to use the service default.
            </p>

            <div className="gf-actions">
              <button
                type="submit"
                className="gf-button gf-button--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Update AI Settings'}
              </button>
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

/* ── Main Page ──────────────────────────────────────────── */

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setErrorDetails(null);
      console.log('[Debug] Starting fetchAll...');
      const [p, s] = await Promise.all([
        api.get<UserProfile>('/auth/me').catch(err => {
          console.error('[Debug] /auth/me failed:', err);
          throw new Error(`/auth/me: ${err.status || 'Error'}`);
        }),
        api.get<StorageInfo>('/auth/storage-info').catch(err => {
          console.error('[Debug] /auth/storage-info failed:', err);
          throw new Error(`/auth/storage-info: ${err.status || 'Error'}`);
        }),
      ]);
      console.log('[Debug] fetchAll success:', { p, s });
      setProfile(p);
      setStorageInfo(s);
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setErrorDetails(err.message || 'Unknown error');
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  const handleUpdateInfrastructure = async (data: { ai_api_key: string | null }) => {
    const cleanData = { ai_api_key: data.ai_api_key?.trim() || null };
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
          {errorDetails && <p className="gf-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>{errorDetails}</p>}
          <button className="gf-button gf-button--secondary" onClick={fetchAll} style={{ marginTop: '16px' }}>
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
              activeTab === 'data' && 'gf-settings-nav-item--active'
            )}
            onClick={() => handleTabChange('data')}
          >
            <Database size={20} />
            <span style={{ flex: 1 }}>Data & Storage</span>
            {activeTab === 'data' && <ChevronRight size={16} />}
          </button>
        </aside>

        <main className="gf-settings-content">
          {activeTab === 'profile' && (
            <ProfileSection profile={profile} onUpdate={handleUpdateProfile} />
          )}
          {activeTab === 'preferences' && <PreferencesSection onSave={handleSavePreferences} />}
          {activeTab === 'infrastructure' && (
            <InfrastructureSection profile={profile} onUpdate={handleUpdateInfrastructure} />
          )}
          {activeTab === 'data' && <DataSection info={storageInfo} />}
        </main>
      </div>
    </div>
  );
}
