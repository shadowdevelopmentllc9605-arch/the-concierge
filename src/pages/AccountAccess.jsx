import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';

const MIN_PASSWORD_LENGTH = 12;

/**
 * Requires an authenticated, invited Supabase session. The invitation or
 * password-recovery link grants that session, never this component itself.
 * No password is sent to the app's database, logs or analytics.
 */
export default function AccountAccess() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const recovery = new URLSearchParams(window.location.search).get('recovery') === '1';

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError || !data?.user?.email) {
        setError('Your sign-in link may have expired. Return to sign-in and request another recovery email.');
      } else {
        setEmail(data.user.email);
      }
    });
    return () => { active = false; };
  }, []);

  const savePassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!email) {
      setError('Sign in with your invitation or recovery link before setting a password.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError('Choose a password with at least 12 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setWorking(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) throw new Error('Your sign-in session has expired.');
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirm('');
      setMessage('Your account password was saved. You can use it to sign in on your next visit.');
      if (recovery) {
        window.history.replaceState(null, '', '/AccountAccess');
      }
    } catch (saveError) {
      setError(saveError?.message || 'Could not save your password. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf8f5] px-5 py-12 flex items-center justify-center">
      <form onSubmit={savePassword} className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{recovery ? 'Reset your password' : 'Secure your Concierge account'}</h1>
        <p className="text-sm text-slate-600">
          {recovery ? 'Your recovery link has opened a protected sign-in session.' : 'Give your invited account a password so you can sign back in later.'}
        </p>
        <p className="text-sm text-slate-700">Account: {email || 'Checking session…'}</p>
        <label className="block text-sm font-medium text-slate-800" htmlFor="account-password">
          New password
        </label>
        <input
          id="account-password" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 p-3"
          placeholder="At least 12 characters" value={password}
          onChange={e => setPassword(e.target.value)} required
        />
        <label className="block text-sm font-medium text-slate-800" htmlFor="account-password-confirm">Confirm new password</label>
        <input
          id="account-password-confirm" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 p-3" value={confirm}
          onChange={e => setConfirm(e.target.value)} required
        />
        <button type="submit" disabled={working || !email}
          className="w-full rounded-lg bg-slate-900 text-white py-3 disabled:opacity-50">
          {working ? 'Saving…' : 'Save password'}
        </button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
        <button type="button" className="w-full text-sm underline text-slate-700"
          onClick={() => navigate('/Onboarding')}>Return to onboarding</button>
      </form>
    </main>
  );
}
