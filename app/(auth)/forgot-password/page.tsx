'use client';
import { useState } from 'react';
export default function ForgotPasswordPage() {
  const [email,setEmail]=useState(''); const [msg,setMsg]=useState('');
  async function submit(e:React.FormEvent){e.preventDefault(); const r=await fetch('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}); const d=await r.json(); setMsg(d.message || d.error);}
  return <div className="min-h-screen flex items-center justify-center p-4"><form onSubmit={submit} className="bg-white p-6 rounded-2xl shadow max-w-md w-full space-y-4"><h1 className="text-xl font-bold">Forgot Password</h1><input className="w-full border rounded-xl px-4 py-3" type="email" placeholder="Your email" value={email} onChange={e=>setEmail(e.target.value)} required/><button className="w-full bg-blue-600 text-white rounded-xl py-3">Request reset</button>{msg&&<p className="text-sm">{msg}</p>}</form></div>;
}
