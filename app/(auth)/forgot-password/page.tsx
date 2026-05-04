'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/useLang';

export default function ForgotPasswordPage() {
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  function submit(e: any) {
    e.preventDefault();
    setMsg(t.ok);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white p-6 rounded-2xl shadow max-w-md w-full space-y-4">
        <button type="button" onClick={() => setLang(lang === 'en' ? 'am' : 'en')} className="rounded border px-3 py-2">
          {lang === 'en' ? t.switchToAmharic : t.switchToEnglish}
        </button>
        <h1 className="text-xl font-bold">{t.forgotPassword}</h1>
        <input className="w-full border rounded-xl px-4 py-3" type="email" placeholder={t.yourEmail} value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <button className="w-full bg-blue-600 text-white rounded-xl py-3">{t.requestReset}</button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
    </div>
  );
}
