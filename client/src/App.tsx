import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { getCurrentUserId, setCurrentUserId, api } from './api/client';
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
import MemoriesPage from './pages/MemoriesPage';
import { applyTheme, persistTheme, resolveInitialTheme, type Theme } from './lib/theme';

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
      className="gf-theme-toggle"
      onClick={() => onThemeChange(nextTheme)}
      title={nextTheme === 'day' ? 'Day mode' : 'Night mode'}
      type="button"
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2} />
    </button>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const userId = getCurrentUserId();
  const [authOpen, setAuthOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: { user?: { email?: string } } | null) => {
      if (event === 'SIGNED_IN' && session?.user && !getCurrentUserId()) {
        try {
          const { userId: id, isNew } = await api.post<{ userId: string; isNew: boolean }>(
            '/auth/email',
            { email: session.user.email }
          );
          setCurrentUserId(id);
          setAuthOpen(false);
          navigate(isNew ? '/benchmark' : '/dashboard', { replace: true });
        } catch { /* ignore */ }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  function handleSignOut() {
    localStorage.removeItem('gofish_user_id');
    navigate('/login');
    window.location.reload();
  }

  return (
    <div className="gf-app">
      <header className="gf-topbar">
        <Link className="gf-brand" to={userId ? '/dashboard' : '/'}>
          <img src="/logo.png" alt="Go Fish" className="gf-brand__icon" />
          <span>Go Fish</span>
        </Link>
        <nav className="gf-nav">
          {userId && <Link to="/dashboard">Home</Link>}
          {userId && <Link to="/dashboard?tab=timeline">Timeline</Link>}
          <Link to="/events/new">New</Link>
          {userId && <Link to="/memories">Memories</Link>}
        </nav>
        <div className="gf-topbar__actions">
          <ThemeSwitch activeTheme={theme} onThemeChange={setTheme} />
          {userId ? (
            <>
              <Link to="/benchmark">
                <button className="gf-button gf-button--ghost" type="button">Preferences</button>
              </Link>
              <button className="gf-button gf-button--secondary" onClick={handleSignOut} type="button">
                Sign out
              </button>
            </>
          ) : (
            <button
              className="gf-button gf-button--secondary"
              onClick={() => setAuthOpen(true)}
              type="button"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <main className="gf-main">{children}</main>
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
                <Route path="/memories" element={<MemoriesPage />} />
                <Route path="*" element={<Dashboard />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
