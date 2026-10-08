import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();
const USE_SUPABASE_AUTH = import.meta.env.VITE_AUTH_BACKEND === 'supabase';

async function toAppUser(authUser) {
  if (!authUser) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('legacy_base44_user_id,display_name')
    .eq('user_id', authUser.id)
    .maybeSingle();
  if (error) console.warn('Unable to load migrated profile identity', error);
  return {
    id: profile?.legacy_base44_user_id || authUser.id,
    supabase_id: authUser.id,
    email: authUser.email || '',
    full_name: profile?.display_name || authUser.user_metadata?.full_name || authUser.email || 'User',
    role: 'user',
    auth_provider: 'supabase',
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(!USE_SUPABASE_AUTH);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const loadSupabaseUser = useCallback(async () => {
    setIsLoadingPublicSettings(false);
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error && error.name !== 'AuthSessionMissingError') throw error;
      const appUser = await toAppUser(data?.user || null);
      setUser(appUser);
      setIsAuthenticated(Boolean(appUser));
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error?.name !== 'AuthSessionMissingError') setAuthError({ type: 'supabase_auth_error', message: error.message });
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const checkBase44UserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      if (error.status === 401 || error.status === 403) setAuthError({ type: 'auth_required', message: 'Authentication required' });
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const checkBase44State = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      const appClient = createAxiosClient({
        baseURL: '/api/apps/public',
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true,
      });
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        if (appParams.token) await checkBase44UserAuth();
        else { setIsLoadingAuth(false); setIsAuthenticated(false); }
      } catch (appError) {
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          setAuthError({
            type: reason,
            message: reason === 'auth_required' ? 'Authentication required' : reason === 'user_not_registered' ? 'User not registered for this app' : appError.message,
          });
        } else {
          setAuthError({ type: 'unknown', message: appError.message || 'Failed to load app' });
        }
        setIsLoadingAuth(false);
      } finally {
        setIsLoadingPublicSettings(false);
      }
    } catch (error) {
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  }, [checkBase44UserAuth]);

  const checkAppState = useCallback(async () => {
    if (USE_SUPABASE_AUTH) return loadSupabaseUser();
    return checkBase44State();
  }, [checkBase44State, loadSupabaseUser]);

  useEffect(() => {
    checkAppState();
    if (!USE_SUPABASE_AUTH) return undefined;
    const { data } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => { loadSupabaseUser(); }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [checkAppState, loadSupabaseUser]);

  const login = async ({ email, password }) => {
    if (!USE_SUPABASE_AUTH) throw new Error('Supabase Auth is not enabled in this environment.');
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setAuthError({ type: 'signin_failed', message: error.message }); throw error; }
    const appUser = await toAppUser(data.user);
    setUser(appUser);
    setIsAuthenticated(Boolean(appUser));
    return { session: data.session, user: appUser };
  };

  const signup = async ({ email, password, fullName }) => {
    if (!USE_SUPABASE_AUTH) throw new Error('Supabase Auth is not enabled in this environment.');
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
    });
    if (error) { setAuthError({ type: 'signup_failed', message: error.message }); throw error; }
    if (data.session && data.user) {
      const appUser = await toAppUser(data.user);
      setUser(appUser);
      setIsAuthenticated(true);
      return { session: data.session, user: appUser, requiresEmailConfirmation: false };
    }
    return { session: null, user: data.user, requiresEmailConfirmation: Boolean(data.user) };
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (USE_SUPABASE_AUTH) {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn('Supabase sign out failed', error);
      return;
    }
    if (shouldRedirect) base44.auth.logout(window.location.href);
    else base44.auth.logout();
  };

  const navigateToLogin = () => {
    if (USE_SUPABASE_AUTH) { setIsAuthenticated(false); return; }
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, appPublicSettings,
      authBackend: USE_SUPABASE_AUTH ? 'supabase' : 'base44',
      login, signup, logout, navigateToLogin, checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
