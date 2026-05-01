'use client';
import { useEffect, useState } from 'react';
import { translations, Lang } from '@/lib/i18n/translations';
export function useLang() {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => { const saved = localStorage.getItem('lang') as Lang | null; if (saved) setLang(saved); }, []);
  const changeLang = (l: Lang) => { setLang(l); localStorage.setItem('lang', l); };
  return { lang, setLang: changeLang, t: translations[lang] };
}
