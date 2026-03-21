import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { getCurrentUserId } from './api/client';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import TasteBenchmarkForm from './pages/TasteBenchmarkForm';
import EventCreationForm from './pages/EventCreationForm';
import EventDetail from './pages/EventDetail';
import InvitationResolver from './pages/InvitationResolver';
import EventResponseForm from './pages/EventResponseForm';
import ActivityOptionsView from './pages/ActivityOptionsView';
import EventConfirmation from './pages/EventConfirmation';
import PrototypePage from './pages/prototype/PrototypePage';
import MemoriesPage from './pages/MemoriesPage';

function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const userId = getCurrentUserId();

  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('gofish_theme') as 'dark' | 'light') ?? 'dark',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gofish_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  function handleSignOut() {
    localStorage.removeItem('gofish_user_id');
    navigate('/login');
    window.location.reload();
  }

  return (
    <div className="gf-app">
      <header className="gf-topbar">
        <Link className="gf-brand" to="/dashboard">
          <img src="/logo.png" alt="Go Fish" className="gf-brand__icon" />
          <span>Go Fish</span>
        </Link>
        <nav className="gf-nav">
          {userId && <Link to="/events/new">New</Link>}
          {userId && <Link to="/memories">Memories</Link>}
        </nav>
        <div className="gf-topbar__actions">
          <button
            className="gf-button gf-button--ghost"
            onClick={toggleTheme}
            type="button"
            aria-label="Toggle theme"
            style={{ minHeight: '38px', padding: '8px 12px' }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
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
            <Link to="/login">
              <button className="gf-button gf-button--secondary">Sign in</button>
            </Link>
          )}
        </div>
      </header>
      <main className="gf-main">{children}</main>
      <footer className="gf-footer">v1.6.0</footer>
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
