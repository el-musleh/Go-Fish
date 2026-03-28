import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, LayoutGrid } from 'lucide-react';
import {
  api,
  clearCurrentUser,
  getCurrentUserId,
  setCurrentUserEmail,
  setCurrentUserId,
  subscribeToAuthChange,
} from './api/client';
import { supabase } from './lib/supabase';
import { Toaster } from './components/Toaster';
import LoadingSpinner from './components/LoadingSpinner';
import ConfirmationDialog from './components/ConfirmationDialog';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import NotificationsPage from './pages/NotificationsPage';
import Settings from './pages/Settings';
import EventCreationForm from './pages/EventCreationForm';
import EventDetail from './pages/EventDetail';
import InvitationResolver from './pages/InvitationResolver';
import EventResponseForm from './pages/EventResponseForm';
import ActivityOptionsView from './pages/ActivityOptionsView';
import EventConfirmation from './pages/EventConfirmation';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFound from './pages/NotFound';
import PrototypePage from './pages/prototype/PrototypePage';
import {
  applyTheme,
  persistTheme,
  resolveInitialTheme,
  resolveEffectiveTheme,
  type Theme,
} from './lib/theme';
import AuthDialog from './components/AuthDialog';
import Notifications from './components/Notifications';
import Onboarding from './components/Onboarding';
import { KeyboardShortcutsHelp } from './hooks/useKeyboardShortcuts';
import {
  getPostAuthDestination,
  getSessionEmailForSync,
  shouldBlockDuringAuthBootstrap,
} from './lib/authSession';

// ── Protected Route Wrapper ────────────────────────────────────────────────────

function RequireAuth({
  children,
  bootstrapping,
}: {
  children: React.ReactNode;
  bootstrapping: boolean;
}) {
  const navigate = useNavigate();
  const userId = getCurrentUserId();

  useEffect(() => {
    if (!bootstrapping && !userId) {
      navigate('/', { replace: true });
    }
  }, [userId, navigate, bootstrapping]);

  if (bootstrapping) {
    return (
      <div className="gf-page-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!userId) return null;
  return <>{children}</>;
}

function AppShell({
  children,
  userId,
  authOpen,
  setAuthOpen,
  authReturnTo,
  authBootstrapping,
  isSignOutConfirmOpen,
  setSignOutConfirmOpen,
}: {
  children: React.ReactNode;
  userId: string | null;
  authOpen: boolean;
  setAuthOpen: (o: boolean) => void;
  authReturnTo: string;
  authBootstrapping: boolean;
  isSignOutConfirmOpen: boolean;
  setSignOutConfirmOpen: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isSettings = location.pathname === '/settings' || location.pathname === '/benchmark';
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleFocusSearch = () => {
    const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && userId) {
        e.preventDefault();
        navigate('/events/new');
      }
      if (e.key === 't' && !e.metaKey && !e.ctrlKey && userId) {
        e.preventDefault();
        navigate('/dashboard');
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleFocusSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div
      className="gf-app"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <header className="gf-topbar">
        <Link className="gf-brand" to={userId ? '/dashboard' : '/'}>
          <img src="/logo.png" alt="Go Fish" className="gf-brand__icon" />
          <span>Go Fish</span>
        </Link>
        <nav className="gf-nav">
          {userId && (
            <Link
              to="/dashboard"
              className={`gf-nav-link gf-nav-link--icon${isDashboard ? ' gf-nav-link--active' : ''}`}
              title="Dashboard"
              aria-label="Dashboard"
            >
              <LayoutGrid size={20} />
            </Link>
          )}
        </nav>
        <div className="gf-topbar__actions">
          {userId && <Notifications />}
          {userId ? (
            <Link
              to="/settings"
              className={`gf-nav-link gf-nav-link--icon${isSettings ? ' gf-nav-link--active' : ''}`}
              title="Settings"
              aria-label="Settings"
            >
              <SettingsIcon size={20} />
            </Link>
          ) : (
            <button
              className="gf-button gf-button--primary"
              onClick={() => setAuthOpen(true)}
              style={{ marginLeft: '8px' }}
            >
              Sign In
            </button>
          )}
        </div>
      </header>
      <main className="gf-main" style={{ flex: 1 }}>
        {shouldBlockDuringAuthBootstrap(location.pathname, authBootstrapping) ? (
          <div className="gf-page-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          children
        )}
      </main>
      <footer className="gf-footer">
        <div className="gf-footer__inner">
          <img src="/logo.png" alt="Go Fish" className="gf-footer__logo" />
          <span className="gf-footer__copy">
            © {new Date().getFullYear()} Go Fish. All rights reserved.
          </span>
          <span className="gf-footer__meta">Social event coordinator · v1.6.0</span>
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: '12px',
            fontSize: '0.85rem',
            color: 'var(--muted)',
          }}
        >
          Read our{' '}
          <Link
            to="/privacy"
            style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}
          >
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link
            to="/terms"
            style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}
          >
            Terms of Service
          </Link>
        </div>
      </footer>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} returnTo={authReturnTo} />
      <ConfirmationDialog
        open={isSignOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        onConfirm={() => {
          setSignOutConfirmOpen(false);
          supabase.auth.signOut({ scope: 'local' }).finally(() => {
            clearCurrentUser();
            window.location.href = '/';
          });
        }}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        confirmText="Sign Out"
        isDestructive
      />
      {showShortcuts && <KeyboardShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

function AuthManager({
  setUserId,
  setAuthOpen,
  setAuthBootstrapping,
  setAuthReturnTo,
}: {
  setUserId: (id: string | null) => void;
  setAuthOpen: (o: boolean) => void;
  setAuthBootstrapping: (b: boolean) => void;
  setAuthReturnTo: (r: string) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const currentPathRef = useRef(location.pathname + location.search);

  useEffect(() => {
    currentPathRef.current = location.pathname + location.search;
  }, [location.pathname, location.search]);

  // Handle ?auth=1 query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === '1') {
      const returnTo = params.get('returnTo') || '/dashboard';
      setAuthReturnTo(returnTo);
      setAuthOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate, setAuthOpen, setAuthReturnTo]);

  useEffect(() => {
    let active = true;

    async function syncSessionEmail(email: string) {
      if (!active || syncInFlightRef.current) return;

      setAuthBootstrapping(true);
      syncInFlightRef.current = (async () => {
        try {
          const { userId: id, isNew } = await api.post<{ userId: string; isNew: boolean }>(
            '/auth/email',
            { email }
          );
          if (!active) return;

          setCurrentUserId(id);
          setCurrentUserEmail(email);
          setUserId(id);
          setAuthOpen(false);

          const destination = getPostAuthDestination(currentPathRef.current, isNew);
          if (destination) {
            navigate(destination, { replace: true });
          }
        } catch {
          // ignore
        } finally {
          if (active) setAuthBootstrapping(false);
          syncInFlightRef.current = null;
        }
      })();
    }

    const handleAuthEvent = (event: string, session: { user?: { email?: string } } | null) => {
      if (event === 'SIGNED_OUT') {
        clearCurrentUser();
        setUserId(null);
        setAuthBootstrapping(false);
        return;
      }

      const email = getSessionEmailForSync(event, session, getCurrentUserId());
      if (email) syncSessionEmail(email);
      else if (event === 'INITIAL_SESSION') setAuthBootstrapping(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthEvent);

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const email = data.session?.user?.email?.trim();
      if (email && !getCurrentUserId()) syncSessionEmail(email);
      else setAuthBootstrapping(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, setAuthBootstrapping, setAuthOpen, setUserId]);

  return null;
}

export default function App() {
  const [userId, setUserId] = useState(() => getCurrentUserId());
  const [authOpen, setAuthOpen] = useState(false);
  const [authReturnTo, setAuthReturnTo] = useState('/dashboard');
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [isSignOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (!getCurrentUserId()) return false;
    return localStorage.getItem('gofish_onboarding_seen') !== 'true';
  });

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      applyTheme(resolveEffectiveTheme('system'));
    };

    mediaQuery.addEventListener('change', handler);
    applyTheme(resolveEffectiveTheme('system'));

    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => subscribeToAuthChange(() => setUserId(getCurrentUserId())), []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('gofish_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  return (
    <BrowserRouter>
      {showOnboarding && userId && <Onboarding onComplete={handleOnboardingComplete} />}
      <Analytics />
      <SpeedInsights />
      <AuthManager
        setUserId={setUserId}
        setAuthOpen={setAuthOpen}
        setAuthBootstrapping={setAuthBootstrapping}
        setAuthReturnTo={setAuthReturnTo}
      />
      <Routes>
        {import.meta.env.DEV && <Route path="/prototype" element={<PrototypePage />} />}
        <Route
          path="*"
          element={
            <AppShell
              userId={userId}
              authOpen={authOpen}
              setAuthOpen={setAuthOpen}
              authReturnTo={authReturnTo}
              authBootstrapping={authBootstrapping}
              isSignOutConfirmOpen={isSignOutConfirmOpen}
              setSignOutConfirmOpen={setSignOutConfirmOpen}
            >
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route
                  path="/notifications"
                  element={
                    <RequireAuth bootstrapping={authBootstrapping}>
                      <NotificationsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireAuth bootstrapping={authBootstrapping}>
                      <Settings
                        theme={theme}
                        onThemeChange={setTheme}
                        onSignOut={() => setSignOutConfirmOpen(true)}
                        onSignIn={() => setAuthOpen(true)}
                      />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/benchmark"
                  element={
                    <RequireAuth bootstrapping={authBootstrapping}>
                      <Settings
                        theme={theme}
                        onThemeChange={setTheme}
                        onSignOut={() => setSignOutConfirmOpen(true)}
                        onSignIn={() => setAuthOpen(true)}
                      />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/events/new"
                  element={
                    <RequireAuth bootstrapping={authBootstrapping}>
                      <EventCreationForm />
                    </RequireAuth>
                  }
                />
                <Route path="/events/:eventId" element={<EventDetail />} />
                <Route path="/invite/:linkToken" element={<InvitationResolver />} />
                <Route path="/events/:eventId/respond" element={<EventResponseForm />} />
                <Route path="/events/:eventId/options" element={<ActivityOptionsView />} />
                <Route path="/events/:eventId/confirmation" element={<EventConfirmation />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
