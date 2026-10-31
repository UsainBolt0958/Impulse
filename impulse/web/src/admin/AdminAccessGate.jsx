import React, { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { establishAdminServerSession, logoutFromAdminServer } from '@/lib/portalServer';

function AdminAccessGate({ children }) {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      setError('Admin sign-in is unavailable because Supabase is not configured.');
      return undefined;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setIsAdmin(false);
        setIsDenied(false);
        setError('');
      }
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) throw sessionError;
      if (active) setSession(data.session);
    }).catch((sessionError) => {
      console.error('Could not load the admin sign-in session.', sessionError);
      if (active) setError(sessionError.message || 'Could not check the sign-in session.');
    }).finally(() => {
      if (active) setLoadingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setIsAdmin(false);
      setIsDenied(false);
      setCheckingAccess(false);
      return undefined;
    }

    let active = true;
    setCheckingAccess(true);
    setError('');

    (async () => {
      try {
        const { data: allowed, error: roleError } = await supabase.rpc('is_billing_admin');
        if (roleError) throw roleError;

        if (!allowed) {
          if (active) {
            setIsAdmin(false);
            setIsDenied(true);
          }
          await logoutFromAdminServer();
          return;
        }

        await establishAdminServerSession(session.access_token);
        if (active) {
          setIsAdmin(true);
          setIsDenied(false);
        }
      } catch (accessError) {
        console.error('Could not verify admin access.', accessError);
        if (active) {
          setIsAdmin(false);
          setIsDenied(false);
          setError(accessError.message || 'Could not verify admin access. Check the Supabase and API configuration.');
        }
      } finally {
        if (active) setCheckingAccess(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [session, retryCount]);

  const signIn = async () => {
    if (!supabase) return;
    setSigningIn(true);
    setError('');
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (authError) throw authError;
    } catch (authError) {
      console.error('Could not start Google admin sign-in.', authError);
      setError(authError.message || 'Could not start Google sign-in.');
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setError('');
    let signOutError;
    try {
      await logoutFromAdminServer();
    } catch (requestError) {
      signOutError = requestError;
    }
    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw authError;
    } catch (authError) {
      signOutError = authError;
    }
    if (signOutError) {
      console.error('Could not complete admin sign-out.', signOutError);
      setError(signOutError.message || 'Could not sign out completely.');
    }
  };

  if (loadingSession || checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <p role="status" className="text-sm text-muted-foreground">Checking admin access…</p>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
        <Card className="w-full max-w-md rounded-3xl border-border">
          <CardHeader>
            <CardTitle>{session ? (isDenied ? 'No admin access' : 'Could not verify admin access') : 'Admin sign-in'}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isDenied
                ? 'No admin access'
                : session
                  ? 'Admin sign-in could not be verified. Try again or sign out.'
                  : 'Sign in with an approved Google account to continue.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {session?.user?.email && (
              <p className="break-all text-sm text-muted-foreground">{session.user.email}</p>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {session ? (
              <div className="space-y-2">
                {!isDenied && (
                  <Button className="w-full" onClick={() => setRetryCount((count) => count + 1)}>
                    Try again
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={signOut}>
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={signIn} disabled={signingIn || !supabase}>
                <LogIn className="h-4 w-4" /> {signingIn ? 'Redirecting…' : 'Sign in with Google'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-8">
        <p className="min-w-0 truncate text-sm text-muted-foreground">Signed in as {session.user.email}</p>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
      {error && <p role="alert" className="mx-auto mt-4 max-w-7xl px-4 text-sm text-destructive sm:px-8">{error}</p>}
      {children}
    </div>
  );
}

export default AdminAccessGate;
