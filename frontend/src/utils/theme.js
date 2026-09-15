const THEME_KEY = 'cricket_auction_theme';

export const getTheme = () => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
};

export const setTheme = (theme) => {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
};

// Applies the saved/system theme before React mounts, so there's no
// flash of the wrong theme on load.
export const initTheme = () => {
  const theme = getTheme();
  applyTheme(theme);
  return theme;
};
