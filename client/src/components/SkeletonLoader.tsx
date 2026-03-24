import { clsx } from 'clsx';

// ── Primitive ─────────────────────────────────────────────────────────────────

interface SkeletonProps {
  /** Visual shape of the placeholder */
  variant?: 'text' | 'heading' | 'card' | 'avatar' | 'button';
  /** Inline width override, e.g. "60%" or "120px" */
  width?: string;
  className?: string;
}

/**
 * Single shimmer block. Always aria-hidden — place role="status" on the
 * containing list/section so AT announces the loading state once.
 */
export function Skeleton({ variant = 'text', width, className }: SkeletonProps) {
  return (
    <span
      className={clsx('gf-skeleton', `gf-skeleton--${variant}`, className)}
      style={width ? { width } : undefined}
      aria-hidden="true"
    />
  );
}

// ── Card skeleton ─────────────────────────────────────────────────────────────

interface SkeletonCardProps {
  /** Number of body-text lines below the heading */
  lines?: number;
  showTitle?: boolean;
  className?: string;
}

export function SkeletonCard({ lines = 3, showTitle = true, className }: SkeletonCardProps) {
  return (
    <div className={clsx('gf-card gf-skeleton-card', className)} aria-hidden="true">
      {showTitle && <Skeleton variant="heading" width="55%" />}
      <div className="gf-skeleton-card__lines">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} variant="text" width={i === lines - 1 ? '72%' : '100%'} />
        ))}
      </div>
    </div>
  );
}

// ── List skeleton ─────────────────────────────────────────────────────────────

interface SkeletonListProps {
  /** How many placeholder cards to render */
  count?: number;
  /** Accessible label announced by screen readers */
  label?: string;
  className?: string;
}

/**
 * Ready-made list of card skeletons. The wrapping div carries the live-region
 * role so assistive technology announces loading exactly once.
 */
export function SkeletonList({
  count = 3,
  label = 'Loading content',
  className,
}: SkeletonListProps) {
  return (
    <div
      className={clsx('gf-stack', className)}
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}…</span>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
