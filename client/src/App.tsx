import { useState, useEffect, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  Calendar,
  Home,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react';
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
import { applyTheme, persistTheme, resolveInitialTheme, type Theme } from './lib/theme';
import AuthDialog from './components/AuthDialog';
import {
  getPostAuthDestination,
  getSessionEmailForSync,
  shouldBlockDuringAuthBootstrap,
} from './lib/authSession';

function ThemeSwitch({
  activeTheme,
  onThemeChange,
}: {
  activeTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}) {
  const nextTheme = activeTheme === 'day' ? 'night' : 'day';
  const Icon = nextTheme === 'day' ? Sun : Moon;

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      className="gf-nav-link gf-nav-link--icon"
      onClick={() => onThemeChange(nextTheme)}
      title={nextTheme === 'day' ? 'Day mode' : 'Night mode'}
      type="button"
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
    </button>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState(() => getCurrentUserId());
  const [authOpen, setAuthOpen] = useState(false);
  const [authReturnTo, setAuthReturnTo] = useState('/dashboard');
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [isSignOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const isTimeline = location.pathname === '/dashboard' && location.search.includes('tab=timeline');
  const isHome = location.pathname === '/dashboard' && !isTimeline;
  const isSettings = location.pathname === '/settings' || location.pathname === '/benchmark';
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());
  const currentPathRef = useRef('/dashboard');
  const syncInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    currentPathRef.current =
      `${location.pathname}${location.search}${location.hash}` || '/dashboard';
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => subscribeToAuthChange(() => setUserId(getCurrentUserId())), []);

  // Handle ?auth=1 query param to open auth dialog with optional returnTo
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === '1') {
      const returnTo = params.get('returnTo') || '/dashboard';
      setAuthReturnTo(returnTo);
      setAuthOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  useEffect(() => {
    let active = true;

    async function syncSessionEmail(email: string) {
      if (!active || syncInFlightRef.current) {
        return syncInFlightRef.current ?? undefined;
      }

      setAuthBootstrapping(true);
      syncInFlightRef.current = (async () => {
        try {
          const { userId: id, isNew } = await api.post<{ userId: string; isNew: boolean }>(
            '/auth/email',
            { email }
          );
          if (!active) {
            return;
          }

          setCurrentUserId(id);
          setCurrentUserEmail(email);
          setAuthOpen(false);

          const destination = getPostAuthDestination(currentPathRef.current, isNew);
          if (destination) {
            navigate(destination, { replace: true });
          }
        } catch {
          // ignore auth bootstrap failures and leave the user on the current screen
        } finally {
          if (active) {
            setAuthBootstrapping(false);
          }
          syncInFlightRef.current = null;
        }
      })();

      return syncInFlightRef.current;
    }

    const handleAuthEvent = (event: string, session: { user?: { email?: string } } | null) => {
      if (event === 'SIGNED_OUT') {
        clearCurrentUser();
        setAuthBootstrapping(false);
        return;
      }

      const email = getSessionEmailForSync(event, session, getCurrentUserId());
      if (!email) {
        if (event === 'INITIAL_SESSION') {
          setAuthBootstrapping(false);
        }
        return;
      }

      void syncSessionEmail(email);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthEvent);

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      const email = data.session?.user?.email?.trim();
      if (email && !getCurrentUserId()) {
        void syncSessionEmail(email);
        return;
      }

      setAuthBootstrapping(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (authBootstrapping) return;

    const publicPaths = ['/', '/privacy', '/terms'];
    const isPublicPath =
      publicPaths.includes(location.pathname) ||
      location.pathname.startsWith('/invite/') ||
      (location.pathname.startsWith('/events/') &&
        !location.pathname.endsWith('/new') &&
        !location.pathname.endsWith('/respond') &&
        !location.pathname.endsWith('/options') &&
        !location.pathname.endsWith('/confirmation'));

    if (!userId && !isPublicPath) {
      navigate(`/?auth=1&returnTo=${encodeURIComponent(location.pathname + location.search)}`, {
        replace: true,
      });
    }
  }, [userId, authBootstrapping, location.pathname, location.search, navigate]);

  async function handleConfirmSignOut() {
    setSignOutConfirmOpen(false);

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      clearCurrentUser();
      setAuthBootstrapping(false);
      navigate('/', { replace: true });
    }
  }

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
              className={`gf-nav-link gf-nav-link--icon${isHome ? ' gf-nav-link--active' : ''}`}
              title="Home"
              aria-label="Home"
            >
              <Home size={20} />
            </Link>
          )}
          {userId && (
            <NavLink
              to="/events/new"
              className={({ isActive }) =>
                `gf-nav-link gf-nav-link--icon${isActive ? ' gf-nav-link--active' : ''}`
              }
              title="New event"
              aria-label="New event"
            >
              <Plus size={20} />
            </NavLink>
          )}
          {userId && (
            <Link
              to="/dashboard?tab=timeline"
              className={`gf-nav-link gf-nav-link--icon${isTimeline ? ' gf-nav-link--active' : ''}`}
              title="Timeline"
              aria-label="Timeline"
            >
              <Calendar size={20} />
            </Link>
          )}
        </nav>
        <div className="gf-topbar__actions">
          {userId && (
            <Link
              to="/settings"
              className={`gf-nav-link gf-nav-link--icon${isSettings ? ' gf-nav-link--active' : ''}`}
              title="Settings"
              aria-label="Settings"
            >
              <SettingsIcon size={20} />
            </Link>
          )}
          <ThemeSwitch activeTheme={theme} onThemeChange={setTheme} />
          {userId ? (
            <button
              className="gf-nav-link gf-nav-link--icon"
              onClick={() => setSignOutConfirmOpen(true)}
              type="button"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={20} />
            </button>
          ) : (
            <button
              className="gf-nav-link gf-nav-link--icon"
              onClick={() => setAuthOpen(true)}
              type="button"
              title="Sign in"
              aria-label="Sign in"
            >
              <LogIn size={20} />
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
        onConfirm={handleConfirmSignOut}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        confirmText="Sign Out"
        isDestructive
      />
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {import.meta.env.DEV && <Route path="/prototype" element={<PrototypePage />} />}
        <Route
          path="*"
          element={
            <AppShell>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/benchmark" element={<Settings />} />
                <Route path="/events/new" element={<EventCreationForm />} />
                <Route path="/events/:eventId" element={<EventDetail />} />
                <Route path="/invite/:linkToken" element={<InvitationResolver />} />
                <Route path="/events/:eventId/respond" element={<EventResponseForm />} />
                <Route path="/events/:eventId/options" element={<ActivityOptionsView />} />
                <Route path="/events/:eventId/confirmation" element={<EventConfirmation />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
