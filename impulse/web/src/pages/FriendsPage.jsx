import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Check, Clock3, Search, UserPlus, UsersRound, X } from 'lucide-react';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

function FriendsPage() {
  const { friendId } = useParams();
  const { user, profile, authLoading, isSupabaseConfigured } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [connections, setConnections] = useState([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [connectionsError, setConnectionsError] = useState('');
  const [busyUserId, setBusyUserId] = useState('');

  const loadConnections = useCallback(async () => {
    if (!supabase || !user) return;
    setIsLoadingConnections(true);
    setConnectionsError('');
    try {
      const { data, error } = await supabase.rpc('get_my_friend_connections');
      if (error) {
        setConnectionsError(error.message || 'Your friends could not be loaded.');
      } else {
        setConnections(data || []);
      }
    } catch (error) {
      setConnectionsError(error.message || 'Your friends could not be loaded.');
    } finally {
      setIsLoadingConnections(false);
    }
  }, [user]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const searchTerm = query.trim().replace(/^@/, '').toLowerCase();
    if (!user || !supabase || searchTerm.length < 3) {
      setResults([]);
      setSearchError('');
      setIsSearching(false);
      return undefined;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError('');
      try {
        const { data, error } = await supabase.rpc('search_profiles', {
          search_query: searchTerm,
        });
        if (!active) return;
        if (error) {
          setSearchError(error.message || 'User search failed.');
          setResults([]);
        } else {
          setResults(data || []);
        }
      } catch (error) {
        if (active) {
          setSearchError(error.message || 'User search failed.');
          setResults([]);
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [query, user]);

  const friends = useMemo(
    () => connections.filter((connection) => connection.status === 'accepted'),
    [connections],
  );
  const incomingRequests = useMemo(
    () => connections.filter((connection) => (
      connection.status === 'pending' && connection.requested_by !== user?.id
    )),
    [connections, user?.id],
  );
  const outgoingRequests = useMemo(
    () => connections.filter((connection) => (
      connection.status === 'pending' && connection.requested_by === user?.id
    )),
    [connections, user?.id],
  );
  const connectionByUserId = useMemo(
    () => new Map(connections.map((connection) => [connection.user_id, connection])),
    [connections],
  );

  const handleSendRequest = async (targetUserId) => {
    if (!supabase) return;
    setBusyUserId(targetUserId);
    try {
      const { error } = await supabase.rpc('send_friend_request', {
        target_user_id: targetUserId,
      });
      if (error) {
        setSearchError(error.message || 'Friend request could not be sent.');
        return;
      }
      setSearchError('');
      await loadConnections();
    } catch (error) {
      setSearchError(error.message || 'Friend request could not be sent.');
    } finally {
      setBusyUserId('');
    }
  };

  const handleRespond = async (targetUserId, accept) => {
    if (!supabase) return;
    setBusyUserId(targetUserId);
    try {
      const { error } = await supabase.rpc('respond_to_friend_request', {
        target_user_id: targetUserId,
        accept_request: accept,
      });
      if (error) {
        setConnectionsError(error.message || 'Friend request could not be updated.');
        return;
      }
      await loadConnections();
    } catch (error) {
      setConnectionsError(error.message || 'Friend request could not be updated.');
    } finally {
      setBusyUserId('');
    }
  };

  if (friendId) return <Navigate to="/friends" replace />;

  return (
    <>
      <Helmet>
        <title>Friends - Impulse</title>
        <meta name="description" content="Find friends by username and manage friend requests." />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 py-8 sm:py-12">
          <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">Learn together</p>
                <h1 className="flex items-center gap-3 text-5xl font-black uppercase tracking-tight">
                  <UsersRound className="h-9 w-9 text-amber-500" />
                  Friends
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  Find people by username and connect with other learners.
                </p>
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add friends
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isSupabaseConfigured ? (
                  <p role="alert" className="text-sm text-destructive">
                    Friends are unavailable until Supabase is configured.
                  </p>
                ) : authLoading ? (
                  <p className="text-sm text-muted-foreground">Checking your account...</p>
                ) : !user ? (
                  <p className="text-sm text-muted-foreground">
                    <Link className="font-semibold underline" to="/account">Sign in</Link> to search for and add friends.
                  </p>
                ) : (
                  <>
                    {!profile?.username && (
                      <p className="text-sm text-muted-foreground">
                        Set your username in <Link className="font-semibold underline" to="/account">account settings</Link> so friends can find you.
                      </p>
                    )}
                    <label htmlFor="friend-search" className="sr-only">Search usernames</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="friend-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search by username"
                        autoComplete="off"
                        className="pl-9"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Enter at least 3 characters. User emails are never shown.</p>
                    {searchError && <p role="alert" className="text-sm text-destructive">{searchError}</p>}
                    {isSearching && <p role="status" className="text-sm text-muted-foreground">Searching...</p>}
                    {!isSearching && query.trim().replace(/^@/, '').length >= 3 && !searchError && results.length === 0 && (
                      <p className="text-sm text-muted-foreground">No users found for that username.</p>
                    )}
                    {results.length > 0 && (
                      <ul aria-label="Username search results" className="divide-y divide-border rounded-lg border border-border">
                        {results.map((result) => {
                          const existingConnection = connectionByUserId.get(result.id);
                          return (
                            <li key={result.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold">{result.display_name || result.username}</p>
                                <p className="truncate text-sm text-muted-foreground">@{result.username}</p>
                              </div>
                              {existingConnection?.status === 'accepted' ? (
                                <span className="text-sm font-semibold text-muted-foreground">Friends</span>
                              ) : existingConnection?.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock3 className="h-4 w-4" />
                                  {existingConnection.requested_by === user.id ? 'Request sent' : 'Request received'}
                                </span>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSendRequest(result.id)}
                                  disabled={busyUserId === result.id}
                                >
                                  <UserPlus className="h-4 w-4" />
                                  {busyUserId === result.id ? 'Sending...' : 'Add friend'}
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {user && (
              <>
                <section aria-label="Incoming friend requests" className="space-y-3">
                  <h2 className="text-xl font-black">Friend requests</h2>
                  {connectionsError && <p role="alert" className="text-sm text-destructive">{connectionsError}</p>}
                  {isLoadingConnections ? (
                    <p className="text-sm text-muted-foreground">Loading your connections...</p>
                  ) : incomingRequests.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {incomingRequests.map((request) => (
                        <Card key={request.user_id}>
                          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{request.display_name || request.username}</p>
                              <p className="truncate text-sm text-muted-foreground">@{request.username}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleRespond(request.user_id, true)}
                                disabled={busyUserId === request.user_id}
                                aria-label={`Accept ${request.username}'s friend request`}
                              >
                                <Check className="h-4 w-4" />
                                Accept
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRespond(request.user_id, false)}
                                disabled={busyUserId === request.user_id}
                                aria-label={`Decline ${request.username}'s friend request`}
                              >
                                <X className="h-4 w-4" />
                                Decline
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No incoming friend requests.</p>
                  )}
                  {outgoingRequests.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Waiting for {outgoingRequests.map((request) => `@${request.username}`).join(', ')} to respond.
                    </p>
                  )}
                </section>

                <section aria-label="Friends list" className="space-y-3">
                  <h2 className="text-xl font-black">Your friends</h2>
                  {friends.length ? (
                    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {friends.map((friend) => (
                        <li key={friend.user_id}>
                          <Card>
                            <CardContent className="flex items-center gap-4 p-5">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-black text-background">
                                {(friend.display_name || friend.username || '?').slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-black">{friend.display_name || friend.username}</p>
                                <p className="truncate text-sm text-muted-foreground">@{friend.username}</p>
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {isLoadingConnections ? 'Loading your friends...' : 'No friends yet. Search for a username above to send a request.'}
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default FriendsPage;
