import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

function AccountPage() {
  const {
    user,
    profile,
    authLoading,
    authError,
    profileError,
    syncStatus,
    syncError,
    isSupabaseConfigured,
    signInWithGoogle,
    signOut,
    updateProfile,
  } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
    setUsername(profile?.username || '');
  }, [profile?.display_name, profile?.username]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      toast.error(error.message || 'Google sign-in could not be started.');
      setIsSigningIn(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      toast.error('Username must be 3–24 characters using letters, numbers, or underscores.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(displayName, normalizedUsername);
      toast.success('Profile saved.');
    } catch (error) {
      toast.error(
        error.code === '23505'
          ? 'That username is already taken. Please choose another one.'
          : error.message || 'Your profile could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success('You have been signed out.');
    } catch (error) {
      toast.error(error.message || 'You could not be signed out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const syncMessage = {
    idle: 'Your data is saved in this browser until you sign in.',
    loading: 'Loading your saved study data...',
    syncing: 'Your saved data is loaded. Syncing recent changes in the background...',
    synced: 'Your learning data is synced to your account.',
    error: `Cloud sync needs attention${syncError ? `: ${syncError}` : '.'}`,
  }[syncStatus];

  return (
    <>
      <Helmet>
        <title>Account - Impulse</title>
        <meta name="description" content="Sign in and manage your Impulse account." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
          <section>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">Impulse</p>
            <h1 className="text-4xl font-black uppercase tracking-tight">Your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to keep your study history and preferences available across devices.
            </p>
          </section>

          {!isSupabaseConfigured ? (
            <Card>
              <CardHeader><CardTitle>Supabase setup needed</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Add your Supabase project URL and public anon key to <code>web/.env.local</code>, then run the SQL files in the Supabase dashboard as described in <code>supabase/SETUP.md</code>.</p>
                <p>Google sign-in also needs to be enabled in Supabase Authentication and configured with Google OAuth credentials.</p>
              </CardContent>
            </Card>
          ) : authLoading ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Checking your sign-in status...</CardContent></Card>
          ) : user ? (
            <>
              <Card>
                <CardHeader><CardTitle>Signed in</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1 text-sm">
                    <p className="font-bold">{user.email}</p>
                    <p className="text-muted-foreground">{syncMessage}</p>
                    {profileError ? <p role="alert" className="text-destructive">{profileError}</p> : null}
                  </div>
                  <form onSubmit={handleSave} className="space-y-3">
                    <label htmlFor="display-name" className="text-sm font-semibold">Profile name</label>
                    <Input
                      id="display-name"
                      value={displayName}
                      maxLength={80}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Your name"
                    />
                    <label htmlFor="username" className="block text-sm font-semibold">Username</label>
                    <Input
                      id="username"
                      value={username}
                      maxLength={24}
                      autoComplete="username"
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="e.g. studywithsam"
                      aria-describedby="username-help"
                    />
                    <p id="username-help" className="text-xs text-muted-foreground">
                      Choose a unique username (3–24 letters, numbers, or underscores). Friends can search for it; your email stays private.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" disabled={isSaving || !displayName.trim()}>
                        {isSaving ? 'Saving...' : 'Save profile'}
                      </Button>
                      <Button type="button" variant="outline" onClick={handleSignOut} disabled={isSigningOut}>
                        {isSigningOut ? 'Signing out...' : 'Sign out'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Saved learning data</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Solved-question history, calendar activity, bookmarks, notebooks, custom-test results, test-series sessions and exam analytics sync to your private account.
                  {syncStatus === 'error' ? <p role="alert" className="mt-3 text-destructive">{syncMessage}</p> : null}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader><CardTitle>Save your progress across devices</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sign in with Google. Your study records already saved in this browser will be copied to your account.
                </p>
                {authError ? <p role="alert" className="text-sm text-destructive">{authError}</p> : null}
                <Button type="button" onClick={handleSignIn} disabled={isSigningIn}>
                  {isSigningIn ? 'Opening Google...' : 'Continue with Google'}
                </Button>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Your account data is private. Your username must be unique so friends can find the right account.
          </p>
        </main>
      </div>
    </>
  );
}

export default AccountPage;
