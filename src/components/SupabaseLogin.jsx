import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';

export default function SupabaseLogin() {
  const emailLinkEnabled = import.meta.env.VITE_ENABLE_EMAIL_LINK_SIGNIN === 'true';
  const recoveryEmailEnabled = import.meta.env.VITE_ENABLE_AUTH_RECOVERY_EMAIL === 'true';
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
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin }
    });
    setWorking(false);
    setMessage(error ? error.message : 'Sign-in link sent. Check your email.');
  };

  const sendRecovery = async () => {
    if (!recoveryEmailEnabled || !email) return;
    setWorking(true);
    setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/AccountAccess?recovery=1'
    });
    setWorking(false);
    // Do not expose whether an email address belongs to an account.
    setMessage(error ? 'Unable to send recovery email. Please try later or contact support.' :
      'If your invited account exists, you will receive password recovery instructions by email.');
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
        {emailLinkEnabled && (
          <button type="button" disabled={working || !email} onClick={sendLink}
            className="w-full text-sm underline disabled:opacity-50">
            Email me a sign-in link
          </button>
        )}
        {recoveryEmailEnabled && (
          <button type="button" disabled={working || !email} onClick={sendRecovery}
            className="w-full text-sm underline disabled:opacity-50">
            Forgot your password?
          </button>
        )}
        <div className="border-t border-slate-200 pt-4 text-sm text-slate-600">
          <p>Phase One pilot access is by invitation. Need an account or help signing in?</p>
          <a className="mt-2 inline-block underline" href="mailto:shadowdevelopmentllc9605@gmail.com?subject=The%20Concierge%20pilot%20access%20request">
            Request pilot access
          </a>
        </div>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </form>
    </div>
  );
}
