import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import TasteBenchmarkForm from './pages/TasteBenchmarkForm';
import EventCreationForm from './pages/EventCreationForm';
import EventDetail from './pages/EventDetail';
import InvitationResolver from './pages/InvitationResolver';
import EventResponseForm from './pages/EventResponseForm';
import ActivityOptionsView from './pages/ActivityOptionsView';
import EventConfirmation from './pages/EventConfirmation';

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
