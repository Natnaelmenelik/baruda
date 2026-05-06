'use client';

import type { Lang } from '@/lib/i18n/translations';

type Props = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  size?: 'sm' | 'md';
};

export default function LanguageButtons({ lang, setLang, size = 'md' }: Props) {
  const nextLang: Lang =
    lang === 'am' ? 'en' : lang === 'en' ? 'om' : 'am';

  const label =
    lang === 'am' ? 'English' : lang === 'en' ? 'Oromifa' : 'Amharic';

  const currentLabel =
    lang === 'am' ? 'AM' : lang === 'en' ? 'EN' : 'OM';

  const padding = size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-2 text-sm';

  return (
    <button
      type="button"
      onClick={() => setLang(nextLang)}
      title={`Switch to ${label}`}
      className={`group inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 ${padding} font-bold text-slate-800 shadow-lg shadow-black/10 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-xl active:translate-y-0 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white dark:hover:bg-slate-800`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-black text-white shadow-sm">
        {currentLabel}
      </span>

      <span className="leading-none">
        {label}
      </span>

      <span className="text-base leading-none text-blue-600 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-blue-300">
        →
      </span>
    </button>
  );
}
