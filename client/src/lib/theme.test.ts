import {
  applyTheme,
  persistTheme,
  resolveInitialTheme,
  resolveEffectiveTheme,
  resolveSystemTheme,
  THEME_STORAGE_KEY,
} from './theme';

describe('theme helpers', () => {
  it('returns stored theme when valid', () => {
    const theme = resolveInitialTheme({ getItem: vi.fn(() => 'day') });
    expect(theme).toBe('day');
  });

  it('returns system when no theme is stored', () => {
    const theme = resolveInitialTheme({ getItem: vi.fn(() => null) });
    expect(theme).toBe('system');
  });

  it('resolves system theme to day when prefers light', () => {
    const resolved = resolveSystemTheme({ matches: true });
    expect(resolved).toBe('day');
  });

  it('resolves system theme to night when prefers dark', () => {
    const resolved = resolveSystemTheme({ matches: false });
    expect(resolved).toBe('night');
  });

  it('resolves effective theme correctly', () => {
    expect(resolveEffectiveTheme('day')).toBe('day');
    expect(resolveEffectiveTheme('night')).toBe('night');
    expect(resolveEffectiveTheme('system', { matches: true })).toBe('day');
    expect(resolveEffectiveTheme('system', { matches: false })).toBe('night');
  });

  it('applies the theme to the root dataset and persists it', () => {
    const root = { dataset: {} as DOMStringMap };
    const setItem = vi.fn();

    applyTheme('night', root);
    persistTheme('night', { setItem });

    expect(root.dataset.theme).toBe('night');
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'night');
  });
});
