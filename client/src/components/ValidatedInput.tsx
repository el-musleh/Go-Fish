import { useId } from 'react';
import { type FieldError, type UseFormRegisterReturn } from 'react-hook-form';
import { clsx } from 'clsx';

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  registration: Partial<UseFormRegisterReturn>;
  error?: FieldError;
  hint?: string;
}

export default function ValidatedInput({
  label,
  registration,
  error,
  hint,
  ...rest
}: ValidatedInputProps) {
  const uid = useId();
  const inputId = rest.id ?? rest.name ?? uid;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  // Build aria-describedby from whichever helper text is visible
  const describedBy =
    [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="gf-field">
      <label htmlFor={inputId} className="gf-field__label">
        {label}
      </label>
      <input
        id={inputId}
        className={clsx('gf-input', { 'gf-input--error': !!error })}
        {...registration}
        {...rest}
        // Accessibility overrides — must come after spread to prevent consumer clobbering
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
      />
      {hint && !error && (
        <p id={hintId} className="gf-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="gf-feedback gf-feedback--error" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}
