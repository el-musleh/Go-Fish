import { Analytics } from '@vercel/analytics/react';
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
import { LogIn, LogOut, Moon, Plus, Settings as SettingsIcon, Sun, LayoutGrid } from 'lucide-react';
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

function AppShell({ 
  children,
  userId,
  theme,
  setTheme,
  authOpen,
  setAuthOpen,
  authReturnTo,
  authBootstrapping,
  isSignOutConfirmOpen,
  setSignOutConfirmOpen
}: { 
  children: React.ReactNode,
  userId: string | null,
  theme: Theme,
  setTheme: (t: Theme) => void,
  authOpen: boolean,
  setAuthOpen: (o: boolean) => void,
  authReturnTo: string,
  authBootstrapping: boolean,
  isSignOutConfirmOpen: boolean,
  setSignOutConfirmOpen: (o: boolean) => void
}) {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isSettings = location.pathname === '/settings' || location.pathname === '/benchmark';

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
    </div>
  );
}

export default function App() {
  const [userId, setUserId] = useState(() => getCurrentUserId());
  const [authOpen, setAuthOpen] = useState(false);
  const [authReturnTo, setAuthReturnTo] = useState('/dashboard');
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [isSignOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());
  const currentPathRef = useRef('/dashboard');
  const syncInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

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
            // Need a way to navigate here - will use a helper component or handle in effect
          }
        } catch {
          // ignore
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
  }, []);

  async function handleConfirmSignOut() {
    setSignOutConfirmOpen(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      clearCurrentUser();
      setAuthBootstrapping(false);
      window.location.href = '/';
    }
  }

  return (
    <BrowserRouter>
      <Analytics />
      <Routes>
        {import.meta.env.DEV && <Route path="/prototype" element={<PrototypePage />} />}
        <Route
          path="*"
          element={
            <AppShell 
              userId={userId}
              theme={theme}
              setTheme={setTheme}
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
                  path="/settings" 
                  element={
                    <Settings 
                      theme={theme} 
                      onThemeChange={setTheme} 
                      onSignOut={() => setSignOutConfirmOpen(true)}
                      onSignIn={() => setAuthOpen(true)}
                    />
                  } 
                />
                <Route 
                  path="/benchmark" 
                  element={
                    <Settings 
                      theme={theme} 
                      onThemeChange={setTheme} 
                      onSignOut={() => setSignOutConfirmOpen(true)}
                      onSignIn={() => setAuthOpen(true)}
                    />
                  } 
                />
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
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
