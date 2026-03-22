import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Create an event',
    body: 'Name your outing and add a short description. Set a response window so everyone knows when to reply.',
  },
  {
    number: '02',
    title: 'Invite your crew',
    body: "Share a single link. Each person picks their available dates and, if they haven't already, fills in their activity preferences.",
  },
  {
    number: '03',
    title: 'Get AI suggestions',
    body: "Go Fish weighs everyone's schedules and tastes, then surfaces ranked activity ideas your whole group will actually enjoy.",
  },
];

const reasons = [
  { icon: '🗓️', text: 'No more "when are you free?" threads' },
  { icon: '🎯', text: 'Suggestions tuned to the whole group, not just the loudest voice' },
  { icon: '✨', text: 'Powered by Gemini via OpenRouter for genuinely thoughtful picks' },
];

export default function LandingPage() {
  return (
    <div className="gf-landing">
      <section className="gf-landing__hero">
        <p className="gf-landing__eyebrow">Group activity finder</p>
        <h1 className="gf-landing__headline">
          Help your crew decide<br />what to do&nbsp;together
        </h1>
        <p className="gf-landing__sub">
          Go Fish collects everyone's availability and preferences, then uses AI
          to suggest activities your whole group will love — no endless group
          chats required.
        </p>
        <div className="gf-landing__cta-row">
          <Link to="/login" className="gf-button gf-button--primary gf-landing__cta">
            Get started
          </Link>
          <a className="gf-landing__scroll-hint" href="#how">
            See how it works ↓
          </a>
        </div>
      </section>

      <section className="gf-landing__section" id="how">
        <h2 className="gf-section-title gf-landing__section-title">How it works</h2>
        <div className="gf-landing__steps">
          {steps.map((s) => (
            <div key={s.number} className="gf-card gf-landing__step">
              <span className="gf-landing__step-number">{s.number}</span>
              <h3 className="gf-card-title">{s.title}</h3>
              <p className="gf-muted gf-landing__step-body">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="gf-landing__section">
        <h2 className="gf-section-title gf-landing__section-title">Why Go Fish?</h2>
        <div className="gf-card gf-landing__reasons">
          {reasons.map((r) => (
            <div key={r.text} className="gf-landing__reason">
              <span className="gf-landing__reason-icon">{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="gf-landing__final">
        <p className="gf-landing__final-copy">
          Ready to plan something your crew will actually agree on?
        </p>
        <Link to="/login" className="gf-button gf-button--primary gf-landing__cta">
          Create your first event
        </Link>
      </section>
    </div>
  );
}
