import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { AuthContextValue, Profile } from '@/types/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

function readableAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'Invalid email or password.';
  if (message.includes('email') && message.includes('valid')) return 'Please enter a valid email address.';
  if (message.includes('already registered') || message.includes('already been registered')) return 'An account with this email already exists.';
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error) setProfile(data as Profile | null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: current } = await supabase.auth.getUser();
    if (!current.user) { setProfile(null); return; }
    await loadProfile(current.user.id);
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) void loadProfile(data.session.user.id);
      if (!data.session) setIsLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) void loadProfile(nextSession.user.id);
      if (!nextSession) setProfile(null);
      setIsLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    session, user, profile, isLoading, isAuthenticated: Boolean(session),
    signIn: async (email, password) => { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw new Error(readableAuthError(error, 'We could not sign you in. Please try again.')); },
    signUp: async (displayName, email, password) => { const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() } } }); if (error) throw new Error(readableAuthError(error, 'We could not create your account. Please try again.')); return { needsEmailConfirmation: !data.session }; },
    signOut: async () => { const { error } = await supabase.auth.signOut(); if (error) throw new Error('We could not sign you out. Please try again.'); },
    resetPassword: async (email) => { const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'playbookai://auth/callback' }); if (error) throw new Error('We could not send the reset email. Please try again.'); },
    refreshProfile,
    updateProfile: async (displayName) => { if (!user) throw new Error('You need to be signed in to update your profile.'); const { data, error } = await supabase.from('profiles').update({ display_name: displayName.trim(), updated_at: new Date().toISOString() }).eq('id', user.id).select().single(); if (error) throw new Error('We could not update your profile. Please try again.'); setProfile(data as Profile); },
  }), [isLoading, profile, refreshProfile, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
