import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🤖',
    title: 'AI-powered picks',
    body: "Gemini weighs everyone's tastes and surfaces activity ideas the whole group will actually enjoy.",
  },
  {
    icon: '📅',
    title: 'Smart scheduling',
    body: "Overlay everyone's availability in one click — no back-and-forth needed.",
  },
  {
    icon: '🔗',
    title: 'One-link invites',
    body: 'Share a single link; guests set preferences without creating an account.',
  },
  {
    icon: '🏆',
    title: 'Ranked suggestions',
    body: 'Activities are scored and ranked so the best option rises to the top automatically.',
  },
];

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

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    badge: null,
    perks: [
      'Unlimited events & invites',
      'Full AI-powered suggestions',
      'Bring your own AI API key',
      'All core features included',
    ],
    cta: 'Get started',
    href: '/?auth=1',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 'Soon',
    period: null,
    badge: 'Coming soon',
    perks: [
      'Everything in Free',
      "Use Go Fish's built-in AI — no API key needed",
      'Zero configuration, just sign up and go',
      'Priority support & early access',
    ],
    cta: 'Notify me',
    href: null,
    highlighted: true,
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
      <nav className="gf-landing__nav">
        <a href="#features" className="gf-landing__nav-link">
          Features
        </a>
        <a href="#how" className="gf-landing__nav-link">
          How It Works
        </a>
        <a href="#pricing" className="gf-landing__nav-link">
          Pricing
        </a>
        <a href="#benefits" className="gf-landing__nav-link">
          Benefits
        </a>
      </nav>

      <section className="gf-landing__hero">
        <p className="gf-landing__eyebrow">Group activity finder</p>
        <h1 className="gf-landing__headline">
          Help your crew decide
          <br />
          what to do&nbsp;together
        </h1>
        <p className="gf-landing__sub">
          Go Fish collects everyone's availability and preferences, then uses AI to suggest
          activities your whole group will love — no endless group chats required.
        </p>
        <div className="gf-landing__cta-row">
          <Link to="/?auth=1" className="gf-button gf-button--primary gf-landing__cta">
            Get started
          </Link>
          <a className="gf-landing__scroll-hint" href="#how">
            See how it works ↓
          </a>
        </div>
      </section>

      <section className="gf-landing__section" id="features">
        <h2 className="gf-section-title gf-landing__section-title">Features</h2>
        <div className="gf-landing__features">
          {features.map((f) => (
            <div key={f.title} className="gf-card gf-landing__feature">
              <span className="gf-landing__feature-icon">{f.icon}</span>
              <h3 className="gf-card-title">{f.title}</h3>
              <p className="gf-muted gf-landing__step-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="gf-landing__section" id="how">
        <h2 className="gf-section-title gf-landing__section-title">How It Works</h2>
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

      <section className="gf-landing__section" id="pricing">
        <h2 className="gf-section-title gf-landing__section-title">Pricing</h2>
        <div className="gf-landing__plans">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`gf-card gf-landing__plan${p.highlighted ? ' gf-landing__plan--featured' : ''}`}
            >
              <div className="gf-landing__plan-header">
                <p className="gf-landing__plan-name">{p.name}</p>
                {p.badge && <span className="gf-landing__plan-badge">{p.badge}</span>}
              </div>
              <p className="gf-landing__plan-price">
                {p.price}
                {p.period && <span className="gf-landing__plan-period"> / {p.period}</span>}
              </p>
              <ul className="gf-landing__plan-perks">
                {p.perks.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
              {p.href ? (
                <Link to={p.href} className="gf-button gf-button--primary gf-landing__cta">
                  {p.cta}
                </Link>
              ) : (
                <button className="gf-button gf-button--ghost gf-landing__cta" disabled>
                  {p.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="gf-landing__section" id="benefits">
        <h2 className="gf-section-title gf-landing__section-title">Benefits</h2>
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
        <Link to="/?auth=1" className="gf-button gf-button--primary gf-landing__cta">
          Create your first event
        </Link>
      </section>
    </div>
  );
}
