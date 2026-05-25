'use client';

import { useEffect, useMemo, useState } from 'react';
import { translations } from '@/lib/i18n/translations';

export type Lang = 'en' | 'am' | 'om';

const LANG_KEY = 'lang';
const LANG_EVENT = 'app-language-change';

type TranslationDict = Record<string, string>;

function normalizeLang(value: unknown): Lang {
  return value === 'am' || value === 'en' || value === 'om' ? value : 'am';
}

function getSavedLang(): Lang {
  if (typeof window === 'undefined') return 'am';

  try {
    return normalizeLang(localStorage.getItem(LANG_KEY));
  } catch {
    return 'am';
  }
}

function getTranslations(lang: Lang): TranslationDict {
  return (translations[lang] || translations.am || translations.en || {}) as unknown as TranslationDict;
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

  const setLang = (nextLang: Lang) => {
    const normalized = normalizeLang(nextLang);

    try {
      localStorage.setItem(LANG_KEY, normalized);
    } catch {
      // ignore storage errors
    }

    setLangState(normalized);

    try {
      window.dispatchEvent(new Event(LANG_EVENT));
    } catch {
      // ignore event errors
    }
  };

  const t = useMemo(() => getTranslations(lang), [lang]);

  return {
    lang,
    setLang,
    t,
  };
}
