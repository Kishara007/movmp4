export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'movmp4_theme';
const THEME_EVENT = 'movmp4:theme-change';

export function getTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage access restrictions.
  }
  window.dispatchEvent(new CustomEvent<{ theme: ThemeMode }>(THEME_EVENT, { detail: { theme } }));
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function subscribeTheme(callback: (theme: ThemeMode) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ theme: ThemeMode }>;
    if (custom.detail?.theme) callback(custom.detail.theme);
  };
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}
