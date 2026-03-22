import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Home, LogIn, LogOut, Moon, Plus, Settings, Sun } from 'lucide-react';
import {
  api,
  clearCurrentUser,
  getCurrentUserId,
  setCurrentUserEmail,
  setCurrentUserId,
  subscribeToAuthChange,
} from './api/client';
import { supabase } from './lib/supabase';
import AuthDialog from './components/AuthDialog';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import TasteBenchmarkForm from './pages/TasteBenchmarkForm';
import EventCreationForm from './pages/EventCreationForm';
import EventDetail from './pages/EventDetail';
import InvitationResolver from './pages/InvitationResolver';
import EventResponseForm from './pages/EventResponseForm';
import ActivityOptionsView from './pages/ActivityOptionsView';
import EventConfirmation from './pages/EventConfirmation';
import PrototypePage from './pages/prototype/PrototypePage';
import { applyTheme, persistTheme, resolveInitialTheme, type Theme } from './lib/theme';
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
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const isTimeline = location.pathname === '/dashboard' && location.search.includes('tab=timeline');
  const isHome = location.pathname === '/dashboard' && !isTimeline;
  const isPreferences = location.pathname === '/benchmark';
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());
  const currentPathRef = useRef('/dashboard');
  const syncInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    currentPathRef.current = `${location.pathname}${location.search}${location.hash}` || '/dashboard';
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => subscribeToAuthChange(() => setUserId(getCurrentUserId())), []);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthEvent);

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

  async function handleSignOut() {
    setAuthOpen(false);

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      clearCurrentUser();
      setAuthBootstrapping(false);
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="gf-app">
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
              className={({ isActive }) => `gf-nav-link gf-nav-link--icon${isActive ? ' gf-nav-link--active' : ''}`}
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
              to="/benchmark"
              className={`gf-nav-link gf-nav-link--icon${isPreferences ? ' gf-nav-link--active' : ''}`}
              title="Preferences"
              aria-label="Preferences"
            >
              <Settings size={20} />
            </Link>
          )}
          <ThemeSwitch activeTheme={theme} onThemeChange={setTheme} />
          {userId ? (
            <button
              className="gf-nav-link gf-nav-link--icon"
              onClick={handleSignOut}
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
      <main className="gf-main">
        {shouldBlockDuringAuthBootstrap(location.pathname, authBootstrapping)
          ? <p className="gf-muted">Loading…</p>
          : children}
      </main>
      <footer className="gf-footer">
        <div className="gf-footer__inner">
          <img src="/logo.png" alt="Go Fish" className="gf-footer__logo" />
          <span className="gf-footer__copy">© {new Date().getFullYear()} Go Fish. All rights reserved.</span>
          <span className="gf-footer__meta">Social event coordinator · v1.6.0</span>
        </div>
      </footer>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/prototype" element={<PrototypePage />} />
        <Route
          path="*"
          element={
            <AppShell>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/benchmark" element={<TasteBenchmarkForm />} />
                <Route path="/events/new" element={<EventCreationForm />} />
                <Route path="/events/:eventId" element={<EventDetail />} />
                <Route path="/invite/:linkToken" element={<InvitationResolver />} />
                <Route path="/events/:eventId/respond" element={<EventResponseForm />} />
                <Route path="/events/:eventId/options" element={<ActivityOptionsView />} />
                <Route path="/events/:eventId/confirmation" element={<EventConfirmation />} />
                <Route path="*" element={<LandingPage />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
