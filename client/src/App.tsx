import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { getCurrentUserId, setCurrentUserId, api } from './api/client';
import { supabase } from './lib/supabase';
import AuthDialog from './components/AuthDialog';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import TasteBenchmarkForm from './pages/TasteBenchmarkForm';
import EventCreationForm from './pages/EventCreationForm';
import EventDetail from './pages/EventDetail';
import InvitationResolver from './pages/InvitationResolver';
import EventResponseForm from './pages/EventResponseForm';
import ActivityOptionsView from './pages/ActivityOptionsView';
import EventConfirmation from './pages/EventConfirmation';

function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const userId = getCurrentUserId();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        <Link className="gf-brand" to="/dashboard">
          <span>🐟</span>
          <span>Go Fish</span>
        </Link>
        <nav className="gf-nav">
          <Link to="/events/new">New</Link>
        </nav>
        <div className="gf-topbar__actions">
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
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
