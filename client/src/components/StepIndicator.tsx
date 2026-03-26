interface Step {
  label: string;
  isComplete?: boolean;
  isActive?: boolean;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav className="gf-step-indicator" aria-label="Progress">
      <ol className="gf-step-list">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isActive = index === currentStep;

          return (
            <li key={step.label} className="gf-step-item">
              <div
                className={`gf-step-dot ${isComplete ? 'gf-step-dot--complete' : ''} ${
                  isActive ? 'gf-step-dot--active' : ''
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                {isComplete ? '✓' : index + 1}
              </div>
              <span
                className={`gf-step-label ${isComplete || isActive ? 'gf-step-label--active' : ''}`}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && <div className="gf-step-line" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
