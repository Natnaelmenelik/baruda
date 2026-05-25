'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/useLang';
import LanguageButtons from '@/components/LanguageButtons';

const copy = {
  en: {
    title: 'Forgot Password',
    emailPlaceholder: 'Your email',
    button: 'Request reset',
    ok: 'If this account exists, a reset link will be sent.',
  },
  am: {
    title: 'የይለፍ ቃል ረሱ?',
    emailPlaceholder: 'ኢሜይልዎ',
    button: 'ሪሴት ይጠይቁ',
    ok: 'ይህ መለያ ካለ፣ የሪሴት መልዕክት ይላካል።',
  },
  om: {
    title: 'Jecha darbii irraanfattan?',
    emailPlaceholder: 'Imeelii keessan',
    button: 'Reset gaafadhaa',
    ok: 'Yoo herregni kun jiraate, ergaan reset ni ergama.',
  },
} as const;

export default function ForgotPasswordPage() {
  const { lang, setLang } = useLang();
  const currentCopy = copy[lang] ?? copy.am;

  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(currentCopy.ok);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white p-6 rounded-2xl shadow max-w-md w-full space-y-4"
      >
        <LanguageButtons lang={lang} setLang={setLang} />

        <h1 className="text-xl font-bold">{currentCopy.title}</h1>

        <input
          className="w-full border rounded-xl px-4 py-3"
          type="email"
          placeholder={currentCopy.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button className="w-full bg-blue-600 text-white rounded-xl py-3">
          {currentCopy.button}
        </button>

        {msg && <p className="text-sm">{msg}</p>}
      </form>
    </div>
  );
}
