export type Theme = 'system' | 'night' | 'day';
export type ResolvedTheme = 'night' | 'day';

export const THEME_STORAGE_KEY = 'gofish_theme';

function isTheme(value: string | null): value is Theme {
  return value === 'system' || value === 'night' || value === 'day';
}

export function resolveInitialTheme(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null
): Theme {
  const storedTheme = storage?.getItem(THEME_STORAGE_KEY) ?? null;
  if (isTheme(storedTheme)) {
    return storedTheme;
  }
  return 'system';
}

export function resolveSystemTheme(
  mediaMatcher: Pick<MediaQueryList, 'matches'> | null = typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: light)')
    : null
): ResolvedTheme {
  return mediaMatcher?.matches ? 'day' : 'night';
}

export function resolveEffectiveTheme(
  theme: Theme,
  mediaMatcher: Pick<MediaQueryList, 'matches'> | null = typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: light)')
    : null
): ResolvedTheme {
  if (theme === 'system') {
    return resolveSystemTheme(mediaMatcher);
  }
  return theme;
}

export function applyTheme(
  theme: Theme,
  root: Pick<HTMLElement, 'dataset'> | null = typeof document !== 'undefined'
    ? document.documentElement
    : null
) {
  if (!root) {
    return;
  }

  root.dataset.theme = theme;
}

export function persistTheme(
  theme: Theme,
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null
) {
  storage?.setItem(THEME_STORAGE_KEY, theme);
}
