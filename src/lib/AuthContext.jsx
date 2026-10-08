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

  const checkAppState = async () => {
    setIsLoadingAuth(true);
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
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkAppState();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAppState();
    });
    return () => listener?.subscription?.unsubscribe();
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
