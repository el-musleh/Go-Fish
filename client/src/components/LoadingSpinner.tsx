import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export default function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      className={clsx('gf-loading-spinner', `gf-loading-spinner--${size}`, className)}
    >
      <Loader2 aria-hidden="true" className="gf-loading-spinner__icon" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
