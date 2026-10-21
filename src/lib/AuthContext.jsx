import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ backend: 'supabase' });

  const checkAppState = async ({ background = false } = {}) => {
    // USER_UPDATED occurs during password changes and profile edits.
    // Refresh user info without unmounting the current screen and losing its status.
    if (!background) setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: error?.message || 'Authentication required' });
    } finally {
      if (!background) setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkAppState();
    // Supabase API calls inside the auth callback can deadlock; defer revalidation.
    const pending = new Set();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      const timer = setTimeout(() => {
        pending.delete(timer);
        checkAppState({ background: event === 'USER_UPDATED' });
      }, 0);
      pending.add(timer);
    });
    return () => {
      listener?.subscription?.unsubscribe();
      pending.forEach(clearTimeout);
    };
  }, []);

  const logout = async () => {
    await base44.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
  };

  const navigateToLogin = () => {
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
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
