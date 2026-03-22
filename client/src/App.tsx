import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Moon, Sun, Home, Calendar, Plus, Settings, LogOut, LogIn } from 'lucide-react';
import { getCurrentUserId, setCurrentUserId, setCurrentUserEmail, api } from './api/client';
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
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import PrototypePage from './pages/prototype/PrototypePage';
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
      className="gf-nav-link"
      onClick={() => onThemeChange(nextTheme)}
      title={nextTheme === 'day' ? 'Day mode' : 'Night mode'}
      type="button"
      style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={2} />
    </button>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = getCurrentUserId();
  const [authOpen, setAuthOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  const getNavLinkClass = (path: string, exactQuery?: string) => {
    const isActive = exactQuery 
      ? location.pathname === path && location.search.includes(exactQuery)
      : location.pathname === path && (path !== '/dashboard' || !location.search.includes('tab=timeline'));
    return `gf-nav-link${isActive ? ' gf-nav-link--active' : ''}`;
  };

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
          if (session.user.email) setCurrentUserEmail(session.user.email);
          setAuthOpen(false);
          navigate(isNew ? '/benchmark' : '/dashboard', { replace: true });
        } catch { /* ignore */ }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  function handleSignOut() {
    localStorage.removeItem('gofish_user_id');
    localStorage.removeItem('gofish_user_email');
    navigate('/login');
    window.location.reload();
  }

  return (
    <div className="gf-app" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="gf-topbar">
        <Link className="gf-brand" to={userId ? '/dashboard' : '/'}>
          <img src="/logo.png" alt="Go Fish" className="gf-brand__icon" />
          <span>Go Fish</span>
        </Link>
        <nav className="gf-nav">
          {userId && (
            <Link to="/dashboard" className={getNavLinkClass('/dashboard')} title="Home" aria-label="Home">
              <Home size={20} />
            </Link>
          )}
          {userId && (
            <Link to="/dashboard?tab=timeline" className={getNavLinkClass('/dashboard', 'tab=timeline')} title="Timeline" aria-label="Timeline">
              <Calendar size={20} />
            </Link>
          )}
          {userId && (
            <NavLink to="/events/new" className={({ isActive }) => `gf-nav-link${isActive ? ' gf-nav-link--active' : ''}`} title="New" aria-label="New">
              <Plus size={20} />
            </NavLink>
          )}
        </nav>
        <div className="gf-topbar__actions">
          {userId && (
            <Link to="/benchmark" className={getNavLinkClass('/benchmark')} title="Preferences" aria-label="Preferences">
              <Settings size={20} />
            </Link>
          )}
          <ThemeSwitch activeTheme={theme} onThemeChange={setTheme} />
          {userId ? (
            <button
              className="gf-nav-link"
              onClick={handleSignOut}
              type="button"
              title="Sign out"
              aria-label="Sign out"
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              <LogOut size={20} />
            </button>
          ) : (
            <button
              className="gf-nav-link"
              onClick={() => setAuthOpen(true)}
              type="button"
              title="Sign in"
              aria-label="Sign in"
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              <LogIn size={20} />
            </button>
          )}
        </div>
      </header>
      <main className="gf-main" style={{ flex: 1 }}>{children}</main>
      <footer className="gf-footer">
        <div className="gf-footer__inner">
          <img src="/logo.png" alt="Go Fish" className="gf-footer__logo" />
          <span className="gf-footer__copy">© {new Date().getFullYear()} Go Fish. All rights reserved.</span>
          <span className="gf-footer__meta">Social event coordinator · v1.6.0</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Read our <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Privacy Policy</Link> and <Link to="/terms" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Terms of Service</Link>
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
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="*" element={<LandingPage />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
