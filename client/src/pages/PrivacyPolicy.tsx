import { Link } from 'react-router-dom';
import { getCurrentUserId } from '../api/client';

export default function PrivacyPolicy() {
  const userId = getCurrentUserId();
  return (
    <div className="gf-stack gf-stack--xl" style={{ padding: '20px 0 60px' }}>
      <Link
        to={userId ? '/dashboard' : '/'}
        className="gf-button gf-button--ghost gf-button--sm"
        style={{ alignSelf: 'flex-start' }}
      >
        ← Back
      </Link>
      <div>
        <h1 className="gf-section-title">Privacy Policy</h1>
        <p className="gf-muted">Last updated: March 22, 2026</p>
      </div>
      <div
        className="gf-card"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', lineHeight: '1.6' }}
      >
        <p>
          Welcome to Go Fish. Your privacy is critically important to us. This Privacy Policy
          outlines how we collect, use, and protect your personal information when you use our web
          application.
        </p>

        <h3 className="gf-card-title">1. Information We Collect</h3>
        <ul
          style={{
            paddingLeft: '20px',
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <li>
            <strong>Account Data:</strong> When you sign in via Google OAuth or email, we collect
            your email address and basic profile information via our authentication provider,
            Supabase.
          </li>
          <li>
            <strong>Event & Preference Data:</strong> We collect your Taste Benchmark answers,
            availability schedules, and any event details (titles, descriptions, locations) you
            create or respond to.
          </li>
        </ul>

        <h3 className="gf-card-title">2. How We Use Your Information</h3>
        <p>
          We use your data to provide and improve the Go Fish service. Specifically, we use your
          availability and preferences to coordinate group events, generate AI-powered activity
          suggestions, and send transactional emails (such as invitations and event confirmations).
        </p>

        <h3 className="gf-card-title">3. Data Sharing and Third-Party Subprocessors</h3>
        <p>
          We do not sell your personal data. To provide our core features, we securely share
          specific data with trusted third-party services:
        </p>
        <ul
          style={{
            paddingLeft: '20px',
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <li>
            <strong>Google Gemini API:</strong> We send anonymized event contexts and combined
            participant preferences to generate tailored activity recommendations.
          </li>
          <li>
            <strong>Google Places API:</strong> We use event locations to fetch real-world venue
            data and coordinates.
          </li>
          <li>
            <strong>Other Participants:</strong> If you join an event, your basic profile and
            availability may be visible to the event organizer and other participants.
          </li>
        </ul>

        <h3 className="gf-card-title">4. Cookies and Local Storage</h3>
        <p>
          We use essential cookies and local storage to maintain your active session securely,
          remember your visual preferences (like Light/Dark mode), and store local interface states
          (such as hidden events on your dashboard).
        </p>

        <h3 className="gf-card-title">5. Data Retention and Deletion</h3>
        <p>
          We retain your personal data only for as long as necessary to provide our services. You
          may request the deletion of your account and associated data at any time by contacting our
          support team.
        </p>
      </div>
    </div>
  );
}
