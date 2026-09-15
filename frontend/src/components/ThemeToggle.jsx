import { useState } from 'react';
import { getTheme, setTheme } from '../utils/theme.js';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme());

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      className="theme-toggle-btn"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark mode"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
