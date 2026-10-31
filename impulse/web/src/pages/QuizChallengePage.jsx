import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, LoaderCircle, Swords, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  answerQuizChallenge,
  createQuizChallenge,
  joinQuizChallenge,
  loadQuizCatalog,
  loadQuizChallenge,
} from '@/lib/portalServer';

const PLAYER_ID_KEY = 'impulse_quiz_player_id';
const PLAYER_NAME_KEY = 'impulse_quiz_player_name';
const PLAYER_TOKEN_PREFIX = 'impulse_quiz_player_token:';
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const TIMER_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];

function createRandomId(prefix) {
  return window.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getPlayerId() {
  let playerId = window.localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId) {
    playerId = createRandomId('player');
    window.localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
}

function getPlayerToken(challengeId) {
  const tokenKey = `${PLAYER_TOKEN_PREFIX}${challengeId}`;
  let token = window.localStorage.getItem(tokenKey);
  if (!token) {
    token = createRandomId('session');
    window.localStorage.setItem(tokenKey, token);
  }
  return token;
}

function getSavedPlayerName() {
  return window.localStorage.getItem(PLAYER_NAME_KEY) || '';
}

function ChallengeSetup() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [playerName, setPlayerName] = useState(getSavedPlayerName);
  const [inviteeName, setInviteeName] = useState('');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(30);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let active = true;
    loadQuizCatalog()
      .then((result) => {
        if (!active) return;
        setCatalog(result);
        setSubject((current) => current || result[0]?.name || '');
      })
      .catch((error) => {
        if (active) setCatalogError(error.message || 'Question chapters could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedSubject = catalog.find((item) => item.name === subject);
  const chapters = selectedSubject?.chapters || [];
  const selectedChapter = chapters.find((item) => item.name === chapter);

  useEffect(() => {
    if (!chapters.length) {
      setChapter('');
      return;
    }
    if (!chapters.some((item) => item.name === chapter)) setChapter(chapters[0].name);
  }, [chapters, chapter]);

  useEffect(() => {
    if (selectedChapter && questionCount > selectedChapter.questionCount) {
      setQuestionCount(selectedChapter.questionCount);
    }
  }, [questionCount, selectedChapter]);

  const handleCreate = async (event) => {
    event.preventDefault();
    const cleanPlayerName = playerName.trim();
    const cleanInviteeName = inviteeName.trim();
    if (!cleanPlayerName || !cleanInviteeName || !selectedChapter) {
      toast.error('Enter both player names and select a chapter with quiz questions.');
      return;
    }

    setIsCreating(true);
    try {
      window.localStorage.setItem(PLAYER_NAME_KEY, cleanPlayerName);
      const challenge = await createQuizChallenge({
        hostId: getPlayerId(),
        hostName: cleanPlayerName,
        inviteeName: cleanInviteeName,
        subject,
        chapter,
        questionCount: Number(questionCount),
        secondsPerQuestion: Number(secondsPerQuestion),
      });
      if (challenge.playerToken) {
        window.localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${challenge.id}`, challenge.playerToken);
      }
      navigate(`/quiz-challenge/${challenge.id}`);
    } catch (error) {
      toast.error(error.message || 'The challenge could not be created.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <section>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">Study together</p>
        <h1 className="flex items-center gap-3 text-4xl font-black uppercase tracking-tight sm:text-5xl">
          <Swords className="h-9 w-9 text-amber-500" />
          Quiz challenge
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Choose a chapter, set the pace, then share an invite link. Your friend joins from their device and each question starts together.
        </p>
      </section>

      <Card className="rounded-[1.75rem] border-border/80">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase tracking-tight">Set up a challenge</CardTitle>
        </CardHeader>
        <CardContent>
          {catalogError ? (
            <div role="alert" className="mb-5 rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
              {catalogError}
            </div>
          ) : null}
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                Your name
                <input
                  required
                  maxLength={60}
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 font-normal"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Friend's name
                <input
                  required
                  maxLength={60}
                  value={inviteeName}
                  onChange={(event) => setInviteeName(event.target.value)}
                  placeholder="Who are you challenging?"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 font-normal"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                Subject
                <select
                  required
                  value={subject}
                  disabled={!catalog.length}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 font-normal"
                >
                  {catalog.length ? catalog.map((item) => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  )) : <option value="">No quiz questions available</option>}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Chapter
                <select
                  required
                  value={chapter}
                  disabled={!chapters.length}
                  onChange={(event) => setChapter(event.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 font-normal"
                >
                  {chapters.map((item) => (
                    <option key={item.name} value={item.name}>{item.name} ({item.questionCount})</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                Number of questions
                <input
                  required
                  type="number"
                  min="1"
                  max={selectedChapter?.questionCount || 1}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 font-normal"
                />
                <span className="block text-xs font-normal text-muted-foreground">
                  Up to {selectedChapter?.questionCount || 0} playable questions in this chapter.
                </span>
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Time per question
                <select
                  value={secondsPerQuestion}
                  onChange={(event) => setSecondsPerQuestion(Number(event.target.value))}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 font-normal"
                >
                  {TIMER_OPTIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>{seconds} seconds</option>
                  ))}
                </select>
                <span className="block text-xs font-normal text-muted-foreground">
                  Default is 30 seconds. Correct answers score more points when answered faster.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isCreating || !catalog.length || !selectedChapter || questionCount < 1}
              className="rounded-full px-6 font-black uppercase tracking-[0.16em]"
            >
              {isCreating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Swords className="mr-2 h-4 w-4" />}
              Create challenge invite
            </Button>
          </form>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            Friends join with the shared link; they do not need an account. This prototype does not connect invitations to existing friend profiles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function copyInviteLink(challengeId) {
  const inviteUrl = `${window.location.origin}/quiz-challenge/${challengeId}`;
  if (!navigator.clipboard?.writeText) {
    toast.error('Clipboard access is unavailable. Copy the invite URL from the address bar.');
    return;
  }
  navigator.clipboard.writeText(inviteUrl)
    .then(() => toast.success('Challenge invite link copied.'))
    .catch(() => toast.error('Invite link could not be copied. Copy it from the address bar instead.'));
}

function ChallengeRoom({ challengeId }) {
  const [challenge, setChallenge] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    let pollTimer;
    const playerId = getPlayerId();
    const playerToken = getPlayerToken(challengeId);

    const schedulePoll = () => {
      pollTimer = window.setTimeout(async () => {
        try {
          const nextChallenge = await loadQuizChallenge(challengeId, playerId, playerToken);
          if (active) {
            setChallenge(nextChallenge);
            setReceivedAt(Date.now());
            setLoadError('');
          }
        } catch (error) {
          if (active) setLoadError(error.message || 'The challenge could not be refreshed.');
        }
        if (active) schedulePoll();
      }, 1000);
    };

    (async () => {
      try {
        const joinedChallenge = await joinQuizChallenge(challengeId, {
          playerId,
          playerToken,
          name: getSavedPlayerName(),
        });
        if (!active) return;
        setChallenge(joinedChallenge);
        setReceivedAt(Date.now());
        setLoadError('');
        schedulePoll();
      } catch (error) {
        if (active) setLoadError(error.message || 'This challenge could not be joined.');
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(pollTimer);
    };
  }, [challengeId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const myPlayer = challenge?.players.find((player) => player.isCurrentPlayer);
  const countdown = useMemo(() => {
    if (!challenge || challenge.status !== 'playing' || !challenge.questionStartedAt) return 0;
    const estimatedServerTime = challenge.serverTime + (now - receivedAt);
    return Math.max(
      0,
      Math.ceil((challenge.questionStartedAt + challenge.secondsPerQuestion * 1000 - estimatedServerTime) / 1000),
    );
  }, [challenge, now, receivedAt]);

  const handleAnswer = async (answer) => {
    if (!challenge || !myPlayer || myPlayer.answered || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updatedChallenge = await answerQuizChallenge(challenge.id, {
        playerId: myPlayer.id,
        playerToken: getPlayerToken(challenge.id),
        questionIndex: challenge.questionIndex,
        answer,
      });
      setChallenge(updatedChallenge);
      setReceivedAt(Date.now());
    } catch (error) {
      toast.error(error.message || 'Your answer could not be submitted.');
      try {
        const updatedChallenge = await loadQuizChallenge(
          challenge.id,
          myPlayer.id,
          getPlayerToken(challenge.id),
        );
        setChallenge(updatedChallenge);
        setReceivedAt(Date.now());
      } catch (refreshError) {
        setLoadError(refreshError.message || 'The challenge could not be refreshed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const waitingForPlayers = challenge?.status === 'waiting';
  const waitingForOpponent = challenge?.status === 'playing' && myPlayer?.answered;
  const isComplete = challenge?.status === 'completed';
  const opponent = challenge?.players.find((player) => !player.isCurrentPlayer);
  const winner = isComplete
    ? challenge.players.reduce((leading, player) => (player.score > leading.score ? player : leading), challenge.players[0])
    : null;
  const isDraw = isComplete && challenge.players[0]?.score === challenge.players[1]?.score;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/quiz-challenge" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> New challenge
        </Link>
        {challenge && !isComplete ? (
          <Button type="button" variant="outline" onClick={() => copyInviteLink(challenge.id)} className="rounded-full">
            <Copy className="mr-2 h-4 w-4" /> Copy invite link
          </Button>
        ) : null}
      </div>

      {loadError && !challenge ? (
        <Card className="rounded-[1.75rem] border-destructive/40">
          <CardContent className="space-y-4 p-6">
            <p role="alert" className="text-sm text-destructive">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => window.location.reload()} className="rounded-full">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {challenge ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">{challenge.subject} / {challenge.chapter}</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">
                {isComplete ? 'Challenge complete' : 'Quiz challenge'}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {challenge.questionCount} questions · {challenge.secondsPerQuestion}s each
              </p>
            </div>
            {challenge.status === 'playing' ? (
              <div className={`rounded-2xl border px-5 py-3 text-center ${countdown <= 5 ? 'border-destructive text-destructive' : 'border-border'}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Time left</p>
                <p className="font-mono text-3xl font-black">{countdown}s</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {challenge.players.map((player) => (
              <Card key={player.id} className="rounded-2xl border-border/80">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-black">{player.name}{player.isCurrentPlayer ? ' (you)' : ''}</p>
                    <p className="text-xs text-muted-foreground">{player.correctAnswers} correct</p>
                  </div>
                  <p className="font-mono text-2xl font-black">{player.score.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
            {waitingForPlayers ? (
              <Card className="rounded-2xl border-dashed border-border">
                <CardContent className="flex h-full min-h-20 items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-black">{challenge.inviteeName}</p>
                    <p className="text-xs text-muted-foreground">Waiting to join...</p>
                  </div>
                  <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : null}
          </div>

          {waitingForPlayers ? (
            <Card className="rounded-[1.75rem] border-amber-500/30 bg-amber-500/5">
              <CardContent className="space-y-3 p-6">
                <h2 className="text-xl font-black">Your invite is ready</h2>
                <p className="text-sm text-muted-foreground">
                  Share this page with {challenge.inviteeName}. The quiz starts for both players as soon as they join.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => copyInviteLink(challenge.id)} className="rounded-full">
                    <Copy className="mr-2 h-4 w-4" /> Copy invite link
                  </Button>
                  <input
                    readOnly
                    aria-label="Challenge invite URL"
                    value={`${window.location.origin}/quiz-challenge/${challenge.id}`}
                    onFocus={(event) => event.target.select()}
                    className="min-w-[220px] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {challenge.status === 'playing' && challenge.currentQuestion ? (
            <Card className="rounded-[1.75rem] border-border/80">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Question {challenge.questionIndex + 1} of {challenge.questionCount}</span>
                  <span>{opponent?.answered ? `${opponent.name} answered` : `${opponent?.name || 'Friend'} is thinking`}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <h2 className="text-xl font-bold leading-relaxed sm:text-2xl">{challenge.currentQuestion.question}</h2>
                {challenge.currentQuestion.image ? (
                  <img src={challenge.currentQuestion.image} alt="" className="max-h-80 rounded-xl border border-border object-contain" />
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {OPTION_KEYS.map((key) => {
                    const option = challenge.currentQuestion.options[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={myPlayer?.answered || isSubmitting || countdown === 0}
                        onClick={() => handleAnswer(key)}
                        className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-background p-4 text-left transition hover:border-foreground hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-black">{key}</span>
                        <span className="font-medium">{option.text}</span>
                        {option.image ? <img src={option.image} alt="" className="ml-auto max-h-14 max-w-24 object-contain" /> : null}
                      </button>
                    );
                  })}
                </div>
                {waitingForOpponent ? (
                  <p role="status" className="flex items-center gap-2 rounded-xl bg-secondary/60 p-4 text-sm font-semibold">
                    <Check className="h-4 w-4" /> Answer locked in. Waiting for {opponent?.name || 'your friend'} or the timer to finish.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Both players see the next question at the same time. A correct answer earns up to 1,000 points; speed increases your score.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {isComplete ? (
            <Card className="rounded-[1.75rem] border-amber-500/30">
              <CardContent className="space-y-4 p-6 text-center">
                <Trophy className="mx-auto h-10 w-10 text-amber-500" />
                <h2 className="text-2xl font-black uppercase tracking-tight">
                  {isDraw ? "It's a draw!" : `${winner?.name} wins!`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Final scores: {challenge.players.map((player) => `${player.name} ${player.score.toLocaleString()}`).join(' · ')}
                </p>
                <Link to="/quiz-challenge">
                  <Button className="mt-2 rounded-full px-6 font-black uppercase tracking-[0.16em]">Challenge again</Button>
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : !loadError ? (
        <Card className="rounded-[1.75rem]">
          <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin" /> Joining challenge...
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function QuizChallengePage() {
  const { challengeId } = useParams();

  return (
    <>
      <Helmet>
        <title>Quiz Challenge - Impulse</title>
        <meta name="description" content="Challenge a friend to a timed chapter quiz." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        {challengeId ? <ChallengeRoom challengeId={challengeId} /> : <ChallengeSetup />}
      </div>
    </>
  );
}
