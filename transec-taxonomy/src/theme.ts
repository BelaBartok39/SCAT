/**
 * Theme state.
 *
 * The app ships dark and stays dark unless the user asks otherwise, so
 * the deployed appearance is unchanged for anyone who never touches the
 * toggle. The choice persists in localStorage. To follow the OS instead,
 * change DEFAULT below to `prefersDark() ? 'dark' : 'light'`.
 *
 * CSS reads the theme from `data-theme` on <html>. Canvas code cannot
 * read CSS custom properties cheaply per frame, so it imports the
 * palettes here instead; `subscribeTheme` lets a renderer repaint when
 * the theme changes rather than waiting for its next natural frame.
 */

export type ThemeId = 'dark' | 'light';

const STORAGE_KEY = 'transec:theme';
const DEFAULT: ThemeId = 'dark';

function stored(): ThemeId | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;   // private mode / storage disabled
  }
}

let current: ThemeId = stored() ?? DEFAULT;

const listeners = new Set<(t: ThemeId) => void>();

export function getTheme(): ThemeId {
  return current;
}

export function isLight(): boolean {
  return current === 'light';
}

export function setTheme(t: ThemeId): void {
  if (t === current) return;
  current = t;
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* not fatal — the theme still applies for this session */
  }
  apply();
  for (const fn of listeners) fn(current);
}

export function toggleTheme(): void {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/** Subscribe to theme changes; returns an unsubscribe function. */
export function subscribeTheme(fn: (t: ThemeId) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Write the current theme to the document root. */
export function apply(): void {
  document.documentElement.dataset.theme = current;
  document.documentElement.style.colorScheme = current;
}
