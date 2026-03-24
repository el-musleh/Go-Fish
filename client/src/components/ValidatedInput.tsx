import { FieldError, UseFormRegisterReturn } from 'react-hook-form';
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
  const inputId = rest.id || rest.name;
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
      />
      {hint && !error && <p className="gf-field__hint">{hint}</p>}
      {error && <p className="gf-feedback gf-feedback--error">{error.message}</p>}
    </div>
  );
}
