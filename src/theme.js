import { useEffect, useState } from 'react';

// Light / Night mode.
//   mode  = what the person chose: 'light', 'dark' or 'system' (follow the phone or computer setting)
//   theme = what is actually shown right now: 'light' or 'dark'
// The choice is kept in the browser and written to <html data-theme="...">. The colours themselves live in
// index.css / theme.css as CSS variables, so a theme is only a block of variables.
// index.html runs a tiny script before the page is drawn, so there is no white flash when the page opens in night mode.

export const THEME_KEY = 'smartcampus-theme';
const MODES = ['light', 'dark', 'system'];

const osDark = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const getMode = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return MODES.includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
};

export const resolveTheme = (mode) => (mode === 'system' ? (osDark() ? 'dark' : 'light') : mode);

export const applyTheme = (mode, animate = false) => {
  const root = document.documentElement;
  const theme = resolveTheme(mode);
  if (animate) {
    // Colours fade for a moment instead of jumping.
    root.classList.add('theme-anim');
    setTimeout(() => root.classList.remove('theme-anim'), 350);
  }
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0f1e' : '#17707f');
};

export const setMode = (mode) => {
  if (!MODES.includes(mode)) return;
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* private browsing: the choice just is not remembered */ }
  applyTheme(mode, true);
  window.dispatchEvent(new Event('themechange'));
};

// Called once when the app starts. Also reacts when the device switches between day and night.
export const initTheme = () => {
  applyTheme(getMode());
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getMode() !== 'system') return;
    applyTheme('system', true);
    window.dispatchEvent(new Event('themechange'));
  });
};

export function useTheme() {
  const [state, setState] = useState(() => ({ mode: getMode(), theme: resolveTheme(getMode()) }));
  useEffect(() => {
    const sync = () => setState({ mode: getMode(), theme: resolveTheme(getMode()) });
    window.addEventListener('themechange', sync);
    return () => window.removeEventListener('themechange', sync);
  }, []);
  return {
    ...state,
    setMode,
    toggle: () => setMode(state.theme === 'dark' ? 'light' : 'dark'),
  };
}
