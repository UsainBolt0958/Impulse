import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

function LoginPage() {
  const {
    user,
    profile,
    authLoading,
    authError,
    profileError,
    profileLoading,
    isSupabaseConfigured,
    signInWithGoogle,
    signOut,
    updateProfile,
  } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || user?.user_metadata?.full_name || '');
    setUsername(profile?.username || '');
  }, [profile?.display_name, profile?.username, user?.id]);

  const handleSignIn = async () => {
    if (!acceptedLegalTerms) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      toast.error(error.message || 'Google sign-in could not be started.');
      setIsSigningIn(false);
    }
  };

  const handleSaveUsername = async (event) => {
    event.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      toast.error('Username must be 3–24 characters using letters, numbers, or underscores.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(displayName, normalizedUsername);
      toast.success('Your account is ready.');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(
        error.code === '23505'
          ? 'That username is already taken. Please choose another one.'
          : error.message || 'Your username could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      toast.error(error.message || 'You could not be signed out.');
      setIsSigningOut(false);
    }
  };

  const isSettingUsername = Boolean(user && profile && !profile.username);

  return (
    <>
      <Helmet>
        <title>{isSettingUsername ? 'Choose a username - Impulse' : 'Sign in - Impulse'}</title>
        <meta name="description" content="Sign in to Impulse and continue your exam preparation." />
      </Helmet>
      <main className="login-screen relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6 text-white sm:py-10">
        <div aria-hidden="true" className="login-grid-background pointer-events-none absolute inset-0" />
        <svg aria-hidden="true" className="absolute h-0 w-0">
          <filter id="login-ocean-grid">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.018"
              numOctaves="1"
              seed="8"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="18s"
                values="0.012 0.018;0.02 0.009;0.01 0.02;0.012 0.018"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" />
          </filter>
        </svg>

        <div className="relative z-10 flex min-h-[min(500px,calc(100svh-3rem))] w-full max-w-[460px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#08090b]/90 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8">
          <header className="flex flex-col items-center text-center">
            <img src="/logo.png" alt="Impulse logo" className="h-20 w-20 object-contain sm:h-24 sm:w-24" />
            <span className="mt-2 text-2xl font-black uppercase tracking-[0.24em] text-white sm:text-3xl">Impulse</span>
          </header>

          <div className="my-auto py-4">
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl">
              Make every
              <span className="mt-2 block text-white/55">session count.</span>
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-6 text-white/55">
              Practice with purpose, keep your progress close, and move one step nearer to your goal.
            </p>

            <section className="mt-6 border-t border-white/10 pt-5">
              {authLoading || (user && profileLoading) ? (
                <div role="status" className="py-5 text-sm text-white/55">Preparing your account...</div>
              ) : !isSupabaseConfigured ? (
                <div className="space-y-3">
                  <h2 className="text-xl font-black text-white">Account setup needed</h2>
                  <p className="text-sm leading-6 text-white/55">
                    Add the Supabase project URL and public key to <code className="text-violet-200">web/.env.local</code>, then run the SQL files listed in <code className="text-violet-200">supabase/SETUP.md</code>.
                  </p>
                </div>
              ) : user && profileError ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-black text-white">Could not load your account</h2>
                  <p role="alert" className="text-sm leading-6 text-rose-300">{profileError}</p>
                  <p className="text-sm text-white/55">
                    Confirm that you ran the latest SQL files in Supabase, then refresh this page.
                  </p>
                  <Button type="button" variant="outline" onClick={handleSignOut} disabled={isSigningOut} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </Button>
                </div>
              ) : isSettingUsername ? (
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">One last step</p>
                  <h2 className="text-3xl font-black tracking-tight text-white">Choose your username</h2>
                  <p className="mt-3 text-sm leading-6 text-white/55">
                    Friends can find you by this unique username. Your email stays private.
                  </p>
                  <form onSubmit={handleSaveUsername} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="setup-display-name" className="text-sm font-semibold text-white/85">Display name</label>
                      <Input
                        id="setup-display-name"
                        value={displayName}
                        maxLength={80}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Your name"
                        className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="setup-username" className="text-sm font-semibold text-white/85">Username</label>
                      <div className="flex items-center rounded-md border border-white/10 bg-white/[0.04] focus-within:ring-1 focus-within:ring-violet-400/70">
                        <span className="pl-3 text-sm text-white/40">@</span>
                        <Input
                          id="setup-username"
                          value={username}
                          maxLength={24}
                          autoComplete="username"
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="yourname"
                          className="border-0 bg-transparent text-white shadow-none placeholder:text-white/30 focus-visible:ring-0"
                          aria-describedby="setup-username-help"
                        />
                      </div>
                      <p id="setup-username-help" className="text-xs text-white/40">
                        3–24 characters: letters, numbers, and underscores.
                      </p>
                    </div>
                    <Button type="submit" className="h-12 w-full bg-violet-600 font-bold text-white hover:bg-violet-500" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Continue'}
                      {!isSaving && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </form>
                </div>
              ) : user ? (
                <div className="space-y-4">
                  <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                  <h2 className="text-2xl font-black text-white">You’re all set</h2>
                  <p className="text-sm text-white/55">Continue to your study dashboard.</p>
                  <Button type="button" className="h-12 w-full bg-violet-600 font-bold text-white hover:bg-violet-500" onClick={() => navigate('/', { replace: true })}>
                    Continue to Impulse
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white">Sign in to get started</h2>
                  {authError && (
                    <p role="alert" className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-300">
                      {authError}
                    </p>
                  )}
                  <label htmlFor="accept-legal-terms" className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-white/65">
                    <input
                      id="accept-legal-terms"
                      type="checkbox"
                      checked={acceptedLegalTerms}
                      onChange={(event) => setAcceptedLegalTerms(event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-violet-500"
                    />
                    <span>
                      I agree to the{' '}
                      <Link className="font-semibold text-violet-300 underline underline-offset-2 hover:text-violet-200" to="/terms">
                        Terms &amp; Conditions
                      </Link>
                      {' '}and acknowledge the{' '}
                      <Link className="font-semibold text-violet-300 underline underline-offset-2 hover:text-violet-200" to="/privacy">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 h-12 w-full justify-center gap-3 border-white/15 bg-white text-sm font-bold text-zinc-900 hover:bg-white/90 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleSignIn}
                    disabled={isSigningIn || !acceptedLegalTerms}
                  >
                    <GoogleMark />
                    {isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}
                  </Button>
                </div>
              )}
            </section>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
            <span className="flex items-center gap-2">
              <BookOpenCheck className="h-3.5 w-3.5 text-violet-300/80" />
              Built for your next breakthrough
            </span>
            <span>Impulse ©</span>
          </footer>
          <nav aria-label="About and legal" className="mt-3 flex justify-center gap-5 text-xs text-white/45">
            <Link className="transition hover:text-white" to="/about">About</Link>
            <Link className="transition hover:text-white" to="/privacy">Privacy Policy</Link>
            <Link className="transition hover:text-white" to="/terms">Terms &amp; Conditions</Link>
          </nav>
        </div>
      </main>
    </>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.66 5.95c4.48-4.14 7.11-10.24 7.11-17.6Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 5)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.66-5.95c-2.13 1.43-4.85 2.28-8.24 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -5)" />
    </svg>
  );
}

export default LoginPage;
