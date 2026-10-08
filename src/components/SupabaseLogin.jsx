import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';

export default function SupabaseLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  const signIn = async (event) => {
    event.preventDefault();
    setWorking(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setWorking(false);
    if (error) setMessage(error.message);
  };

  const sendLink = async () => {
    if (!email) return;
    setWorking(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    setWorking(false);
    setMessage(error ? error.message : 'Sign-in link sent. Check your email.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl bg-white shadow-sm p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-light">The Concierge</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue.</p>
        </div>
        <input
          className="w-full rounded-lg border px-3 py-2"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border px-3 py-2"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button disabled={working} className="w-full rounded-lg bg-black text-white py-2.5 disabled:opacity-50">
          {working ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" disabled={working || !email} onClick={sendLink} className="w-full text-sm underline disabled:opacity-50">
          Email me a sign-in link
        </button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </form>
    </div>
  );
}
