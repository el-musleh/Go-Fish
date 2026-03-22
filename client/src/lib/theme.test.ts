import { applyTheme, persistTheme, resolveInitialTheme, THEME_STORAGE_KEY } from './theme';

describe('theme helpers', () => {
  it('prefers a stored theme over system preference', () => {
    const theme = resolveInitialTheme(
      { getItem: vi.fn(() => 'day') },
      { matches: false },
    );

    expect(theme).toBe('day');
  });

  it('falls back to the system preference when no theme is stored', () => {
    const theme = resolveInitialTheme(
      { getItem: vi.fn(() => null) },
      { matches: true },
    );

    expect(theme).toBe('day');
  });

  it('defaults to night when storage and media preference are unavailable', () => {
    expect(resolveInitialTheme(null, null)).toBe('night');
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
