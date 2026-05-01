'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const THEME_KEY = 'theme';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;

  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    const initial: Theme = saved === 'dark' ? 'dark' : 'light';

    setThemeState(initial);
    applyTheme(initial);
  }, []);

  function setTheme(nextTheme: Theme) {
    localStorage.setItem(THEME_KEY, nextTheme);
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return { theme, setTheme, toggleTheme };
}
