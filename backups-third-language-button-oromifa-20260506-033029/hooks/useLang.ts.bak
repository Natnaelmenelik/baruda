'use client';

import { useEffect, useState } from 'react';
import { translations, Lang } from '@/lib/i18n/translations';

const LANG_KEY = 'lang';
const LANG_EVENT = 'app-language-change';

function getSavedLang(): Lang {
  if (typeof window === 'undefined') return 'am';

  const saved = localStorage.getItem(LANG_KEY);

  return saved === 'am' || saved === 'en' || saved === 'om' ? saved : 'am';
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>('am');

  useEffect(() => {
    setLangState(getSavedLang());

    const syncLanguage = () => {
      setLangState(getSavedLang());
    };

    window.addEventListener(LANG_EVENT, syncLanguage);
    window.addEventListener('storage', syncLanguage);

    return () => {
      window.removeEventListener(LANG_EVENT, syncLanguage);
      window.removeEventListener('storage', syncLanguage);
    };
  }, []);

  const changeLang = (nextLang: Lang) => {
    localStorage.setItem(LANG_KEY, nextLang);
    setLangState(nextLang);

    window.dispatchEvent(new Event(LANG_EVENT));
  };

  return {
    lang,
    setLang: changeLang,
    t: translations[lang],
  };
}
