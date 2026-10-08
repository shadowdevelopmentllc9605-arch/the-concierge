import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';

const USE_SUPABASE_AUTH = import.meta.env.VITE_AUTH_BACKEND === 'supabase';

async function getSupabaseUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.name === 'AuthSessionMissingError') return null;
    throw error;
  }

  const authUser = data?.user;
  if (!authUser) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('legacy_base44_user_id,display_name')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (profileError) throw profileError;

  return {
    id: profile?.legacy_base44_user_id || authUser.id,
    supabase_id: authUser.id,
    email: authUser.email || '',
    full_name:
      profile?.display_name ||
      authUser.user_metadata?.full_name ||
      authUser.email ||
      'User',
    role: 'user',
    auth_provider: 'supabase',
  };
}

async function updateSupabaseUser(fields = {}) {
  const metadata = {};
  if (typeof fields.full_name === 'string') metadata.full_name = fields.full_name.trim();

  if (Object.keys(metadata).length > 0) {
    const { error } = await supabase.auth.updateUser({ data: metadata });
    if (error) throw error;
  }

  if (typeof fields.full_name === 'string') {
    const { data } = await supabase.auth.getUser();
    const authUser = data?.user;
    if (authUser) {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: fields.full_name.trim() })
        .eq('user_id', authUser.id);
      if (error) throw error;
    }
  }

  return getSupabaseUser();
}

export const authClient = {
  async me() {
    if (USE_SUPABASE_AUTH) return getSupabaseUser();
    return base44.auth.me();
  },

  async updateMe(fields) {
    if (USE_SUPABASE_AUTH) return updateSupabaseUser(fields);
    return base44.auth.updateMe(fields);
  },

  async logout(redirectTo) {
    if (USE_SUPABASE_AUTH) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (redirectTo && typeof window !== 'undefined') window.location.assign(redirectTo);
      return;
    }
    return base44.auth.logout(redirectTo);
  },

  async redirectToLogin(returnTo) {
    if (USE_SUPABASE_AUTH) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (returnTo && typeof window !== 'undefined') window.location.assign(returnTo);
      return;
    }
    return base44.auth.redirectToLogin(returnTo);
  },
};
