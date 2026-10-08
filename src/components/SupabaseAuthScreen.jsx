import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function SupabaseAuthScreen({ appName }) {
  const { login, signup, authError } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('Erick Austin');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLocalError('');
    setMessage('');
    setWorking(true);
    try {
      if (mode === 'signup') {
        const result = await signup({ email, password, fullName });
        if (result?.requiresEmailConfirmation) {
          setMessage('Account created. Check your email to confirm it, then return here and sign in.');
          setMode('signin');
        }
      } else {
        await login({ email, password });
      }
    } catch (error) {
      setLocalError(error?.message || 'Authentication failed.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 shadow-2xl p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-300 mb-3">Supabase migration preview</p>
        <h1 className="text-3xl font-semibold mb-2">{appName}</h1>
        <p className="text-slate-400 mb-7">
          {mode === 'signup'
            ? 'Create your fresh Concierge login. Your staged profile data will be linked by email.'
            : 'Sign in with your new Supabase credentials.'}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <label className="block">
              <span className="text-sm text-slate-300">Name</span>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-violet-400" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required />
            </label>
          )}
          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-violet-400" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Password</span>
            <input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-violet-400" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required />
          </label>
          {(localError || authError?.message) && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{localError || authError.message}</div>
          )}
          {message && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>
          )}
          <button type="submit" disabled={working} className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold hover:bg-violet-500 disabled:opacity-60">
            {working ? 'Working…' : mode === 'signup' ? 'Create fresh login' : 'Sign in'}
          </button>
        </form>
        <button type="button" className="mt-5 w-full text-sm text-violet-300 hover:text-violet-200" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setLocalError(''); setMessage(''); }}>
          {mode === 'signin' ? 'Need the fresh Supabase login? Create it here.' : 'Already created it? Sign in.'}
        </button>
      </div>
    </div>
  );
}
