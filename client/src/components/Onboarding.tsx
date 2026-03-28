import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [open, setOpen] = useState(true);

  const steps = [
    { num: 1, text: 'Create an event and invite your friends' },
    { num: 2, text: "Everyone shares when they're free" },
    { num: 3, text: 'Our AI picks the perfect activity for your group' },
  ];

  const handleClose = () => {
    setOpen(false);
    onComplete();
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="gf-dialog-overlay" />
        <Dialog.Content className="gf-dialog" style={{ maxWidth: '500px' }}>
          <Dialog.Close asChild>
            <button
              type="button"
              className="gf-dialog__close"
              aria-label="Close"
              style={{ position: 'absolute', top: '16px', right: '16px' }}
            >
              <X size={18} />
            </button>
          </Dialog.Close>

          <div className="gf-onboarding-icon">&#127919;</div>
          <Dialog.Title className="gf-onboarding-title">Welcome to Go Fish!</Dialog.Title>
          <Dialog.Description className="gf-onboarding-desc">
            Plan group activities effortlessly. We&apos;ll handle finding the perfect time and
            activity for everyone.
          </Dialog.Description>

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
              onClick={handleClose}
            >
              Create Your First Event
            </Link>
            <button
              type="button"
              className="gf-button gf-button--ghost gf-button--full"
              onClick={handleClose}
            >
              Maybe Later
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
