import { useTheme } from '../theme.js';

// A small sun / moon switch. Place it anywhere (top bar, login page, landing page).
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={`thm ${dark ? 'dark' : ''} ${className}`}
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to night mode'}
      title={dark ? 'Switch to light mode' : 'Switch to night mode'}
    >
      <i>{dark ? '🌙' : '☀️'}</i>
    </button>
  );
}
