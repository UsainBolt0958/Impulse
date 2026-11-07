import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearLocalUserData, startUserDataSync } from '@/lib/userDataSync';
import { clearExamSession } from '@/lib/portalServer';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState('');
  const activeUserId = useRef(null);
  const localDataCleanup = useRef(Promise.resolve());
  const user = session?.user || null;

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let active = true;
    const applySession = (nextSession) => {
      const nextUserId = nextSession?.user.id || null;
      const userChanged = activeUserId.current !== nextUserId;
      if (activeUserId.current && userChanged) {
        localDataCleanup.current = clearLocalUserData();
        localDataCleanup.current.catch((error) => {
          console.error('Could not securely clear the previous account’s local data.', error);
          if (active) {
            const message = error.message || 'Could not clear data from the previous account.';
            setAuthError(message);
            setSyncError(message);
            setSyncStatus('error');
          }
        });
      }
      activeUserId.current = nextUserId;
      setSession(nextSession);
      setAuthError('');
      setAuthLoading(false);
      if (userChanged) {
        setProfileLoading(Boolean(nextUserId));
        setProfileError('');
        setSyncStatus(nextSession ? 'loading' : 'idle');
        if (!nextUserId) setProfile(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) applySession(data.session);
      })
      .catch((error) => {
        console.error('Could not read the Supabase session.', error);
        if (active) {
          setAuthError(error.message || 'Could not load your sign-in status.');
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError('');
      return undefined;
    }

    let active = true;
    setProfile(null);
    setProfileLoading(true);
    const loadProfile = async () => {
      setProfileError('');
      const { data: existing, error: readError } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url,username')
        .eq('id', user.id)
        .maybeSingle();
      if (readError) throw readError;

      if (existing) {
        if (active) {
          setProfile(existing);
          setProfileLoading(false);
        }
        return;
      }

      const metadata = user.user_metadata || {};
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          display_name: metadata.full_name || metadata.name || '',
          avatar_url: metadata.avatar_url || metadata.picture || null,
        })
        .select('id,display_name,avatar_url,username')
        .single();
      if (createError) throw createError;
      if (active) {
        setProfile(created);
        setProfileLoading(false);
      }
    };

    loadProfile().catch((error) => {
      console.error('Could not load your profile from Supabase.', error);
      if (active) {
        setProfileError(error.message || 'Could not load your profile.');
        setProfileLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !supabase) {
      setSyncStatus('idle');
      setSyncError('');
      return undefined;
    }

    return startUserDataSync(supabase, user.id, (status, error) => {
      setSyncStatus(status);
      setSyncError(error?.message || '');
    });
  }, [user?.id]);

  const value = useMemo(() => ({
    user,
    profile,
    profileLoading,
    authLoading,
    authError,
    profileError,
    syncStatus,
    syncError,
    isSupabaseConfigured,
    async signInWithGoogle() {
      if (!supabase) throw new Error('Supabase is not configured for this website yet.');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/account` },
      });
      if (error) throw error;
    },
    async signOut() {
      if (!supabase) return;
      let examSessionError = null;
      try {
        await clearExamSession();
      } catch (error) {
        examSessionError = error;
        console.error('Could not revoke the active exam session before sign-out.', error);
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (activeUserId.current) {
        activeUserId.current = null;
        localDataCleanup.current = clearLocalUserData();
      }
      await localDataCleanup.current;
      if (examSessionError) {
        throw new Error('You are signed out, but the test session could not be revoked on the server. It will expire automatically.');
      }
    },
    async updateProfile(displayName, username) {
      if (!supabase || !user) throw new Error('Sign in before updating your profile.');
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: displayName.trim(),
          avatar_url: profile?.avatar_url || null,
          username: username?.trim().toLowerCase() || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
        .select('id,display_name,avatar_url,username')
        .single();
      if (error) throw error;
      setProfile(data);
      return data;
    },
  }), [
    user,
    profile,
    profileLoading,
    authLoading,
    authError,
    profileError,
    syncStatus,
    syncError,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
