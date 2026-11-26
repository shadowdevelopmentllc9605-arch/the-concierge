import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { authEventAction, createAuthEpoch } from './authRevalidation';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ backend: 'supabase' });
  const verifiedId = useRef(null);
  const epoch = useRef(createAuthEpoch());

  const clearAuth = useCallback((message='Authentication required') => {
    verifiedId.current=null;
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({type:'auth_required',message});
    setIsLoadingAuth(false);
  },[]);

  const checkAppState = useCallback(async ({background=false,expectedId=null}={}) => {
    const revision=epoch.current.advance();
    if(!background){
      verifiedId.current=null;
      setIsLoadingAuth(true);
      setAuthError(null);
      setUser(null);
      setIsAuthenticated(false);
    }
    try {
      const currentUser = await base44.auth.me();
      if(!epoch.current.isCurrent(revision))return;
      if(!currentUser?.id||(expectedId&&currentUser.id!==expectedId))throw Error('Account changed. Sign in again.');
      verifiedId.current=currentUser.id;
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      if(epoch.current.isCurrent(revision))clearAuth(error?.message || 'Authentication required');
    } finally {
      if(epoch.current.isCurrent(revision))setIsLoadingAuth(false);
    }
  },[clearAuth]);

  useEffect(() => {
    checkAppState();
    let timer=null;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const expectedId=session?.user?.id;
      const action=authEventAction(event,expectedId,verifiedId.current);
      if(action==='ignore')return;
      if(timer!==null)clearTimeout(timer);
      const eventRevision=epoch.current.advance();
      if(action==='clear'){clearAuth();return;}
      if(action==='blocking'){
        verifiedId.current=null;
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        setIsLoadingAuth(true);
      }
      // Same-account focus/reauth events retain the mounted page while the
      // server verifies identity. Never call Supabase inside its callback.
      timer=setTimeout(()=>{
        timer=null;
        if(!epoch.current.isCurrent(eventRevision))return;
        checkAppState({background:action==='background',expectedId});
      },0);
    });
    return () => {
      listener?.subscription?.unsubscribe();
      if(timer!==null)clearTimeout(timer);
      epoch.current.advance();
    };
  }, [checkAppState,clearAuth]);

  const logout = async () => {
    epoch.current.advance();
    clearAuth();
    await base44.auth.logout();
  };

  const navigateToLogin = () => {
    epoch.current.advance();
    clearAuth();
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
