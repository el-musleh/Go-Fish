import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("gf-card", className)} {...props} />;
}

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("gf-surface", className)} {...props} />;
}

export function Button({
  className,
  variant = "primary",
  loading = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button className={cn("gf-button", `gf-button--${variant}`, loading && "is-loading", className)} {...props}>
      <span className="gf-button__inner">{loading ? "Working..." : children}</span>
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("gf-input", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("gf-input", "gf-textarea", className)} {...props} />;
}

export function Field({
  className,
  hint,
  label,
  children,
}: HTMLAttributes<HTMLLabelElement> & {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("gf-field", className)}>
      <span className="gf-field__label">{label}</span>
      {hint ? <span className="gf-field__hint">{hint}</span> : null}
      {children}
    </label>
  );
}

export function Chip({
  active = false,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  active?: boolean;
}) {
  return <span className={cn("gf-chip", active && "gf-chip--active", className)} {...props} />;
}

