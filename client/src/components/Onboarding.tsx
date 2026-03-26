import { Link } from 'react-router-dom';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const steps = [
    { num: 1, text: 'Create an event and invite your friends' },
    { num: 2, text: "Everyone shares when they're free" },
    { num: 3, text: 'Our AI picks the perfect activity for your group' },
  ];

  return (
    <div className="gf-onboarding-overlay">
      <div className="gf-onboarding-modal">
        <div className="gf-onboarding-icon">&#127919;</div>
        <h2 className="gf-onboarding-title">Welcome to Go Fish!</h2>
        <p className="gf-onboarding-desc">
          Plan group activities effortlessly. We&apos;ll handle finding the perfect time and
          activity for everyone.
        </p>

        <div className="gf-onboarding-steps">
          {steps.map((step) => (
            <div key={step.num} className="gf-onboarding-step">
              <span className="gf-onboarding-step-num">{step.num}</span>
              <span className="gf-onboarding-step-text">{step.text}</span>
            </div>
          ))}
        </div>

        <div className="gf-onboarding-actions">
          <Link
            to="/events/new"
            className="gf-button gf-button--primary gf-button--full"
            onClick={onComplete}
          >
            Create Your First Event
          </Link>
          <button
            type="button"
            className="gf-button gf-button--ghost gf-button--full"
            onClick={onComplete}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
