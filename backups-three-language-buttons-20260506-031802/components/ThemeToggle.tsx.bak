'use client';

import { useTheme } from '@/hooks/useTheme';
import { useLang } from '@/hooks/useLang';

function SunIcon() { return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.2M12 18.8V21M4.22 4.22l1.56 1.56M18.22 18.22l1.56 1.56M3 12h2.2M18.8 12H21M4.22 19.78l1.56-1.56M18.22 5.78l1.56-1.56" /><circle cx="12" cy="12" r="4" /></svg>; }
function MoonIcon() { return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 14.6A8.5 8.5 0 019.4 3 7.6 7.6 0 1012 21a8.5 8.5 0 009-6.4z" /></svg>; }

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLang();
  const isDark = theme === 'dark';
  return <button type="button" onClick={toggleTheme} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-gray-800 shadow transition hover:bg-gray-50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700" title={isDark ? t.lightMode : t.darkMode}>{isDark ? <SunIcon /> : <MoonIcon />}<span className="hidden sm:inline">{isDark ? t.light : t.dark}</span></button>;
}
