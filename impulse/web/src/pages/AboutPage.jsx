import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  Layers3,
  ListChecks,
  NotebookPen,
  PieChart,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Target,
  Timer,
  TrendingUp,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import Footer from '@/components/Footer';
import ThemeToggle from '@/components/ThemeToggle';

const FEATURES = [
  {
    icon: BookOpen,
    iconColor: 'text-blue-500',
    title: 'Chapter-wise PYQ practice',
    description: 'Choose an exam, subject, and chapter to work through previous-year questions in focused batches. Question pages can be filtered by available metadata such as year and difficulty, so you can narrow practice to the topic you are studying.',
    href: '/pyq-practice',
    link: 'Explore PYQ practice',
  },
  {
    icon: FileText,
    iconColor: 'text-violet-500',
    title: 'Previous-paper library',
    description: 'Browse published past papers by exam and year, open an individual paper, and launch a timed attempt. Where the catalog has them, paper details include year and shift information.',
    href: '/previous-papers',
    link: 'Browse previous papers',
  },
  {
    icon: Settings2,
    iconColor: 'text-amber-500',
    title: 'Build a custom test',
    description: 'Choose an available exam, subjects, chapters, PYQ years, question counts, a difficulty mix, time limit, and scoring for supported question types. The builder samples questions from the selected pool; it reports when the pool cannot satisfy your requested count.',
    href: '/custom-test/build',
    link: 'Build a custom test',
  },
  {
    icon: BarChart3,
    iconColor: 'text-emerald-500',
    title: 'Performance analysis',
    description: 'Turn saved attempts into a view of your practice: unique questions attempted, accuracy, activity by period, difficulty breakdown, chapter and subject metrics, time per question, and accuracy trends.',
    href: '/analysis',
    link: 'See analysis tools',
  },
  {
    icon: NotebookPen,
    iconColor: 'text-pink-500',
    title: 'Notebook and saved questions',
    description: 'Collect questions for later review and keep your own study notes organized into notebooks. Saved work is tied to your account and can synchronize across supported signed-in sessions.',
    href: '/notebook',
    link: 'Open your notebook',
  },
  {
    icon: CalendarDays,
    iconColor: 'text-cyan-500',
    title: 'Study calendar',
    description: 'Use your recorded solving activity to see consistency over time and spot gaps in your routine. It reflects saved activity; it is not a planner that automatically schedules study tasks.',
    href: '/calendar',
    link: 'View study calendar',
  },
  {
    icon: UsersRound,
    iconColor: 'text-indigo-500',
    title: 'Profiles and friends',
    description: 'Create a username, find other learners, and manage friend requests. Selected profile statistics can be controlled through the profile visibility settings.',
    href: '/friends',
    link: 'See the friends feature',
  },
  {
    icon: ShieldCheck,
    iconColor: 'text-teal-500',
    title: 'Account-backed progress',
    description: 'Sign in with Google to associate a profile with saved study data. The app keeps browser state for active work and synchronizes supported data with your account so progress is not limited to one page view.',
    href: '/privacy',
    link: 'Read how data is handled',
  },
];

function SectionHeading({ eyebrow, title, description, centered = false }) {
  return (
    <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      ) : null}
      <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About Impulse - Study and Test Practice</title>
        <meta
          name="description"
          content="Learn how Impulse brings configurable test series, previous-year question practice, custom tests, and study analysis together."
        />
      </Helmet>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
            <Link to="/" className="text-xl font-black uppercase tracking-[0.22em] text-foreground">
              Impulse
            </Link>
            <nav aria-label="About page navigation" className="flex items-center gap-4 text-sm">
              <Link to="/privacy" className="hidden text-muted-foreground hover:text-foreground sm:inline">Privacy</Link>
              <Link to="/terms" className="hidden text-muted-foreground hover:text-foreground sm:inline">Terms</Link>
              <ThemeToggle />
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground transition hover:opacity-90"
              >
                Open Impulse <ArrowRight className="h-4 w-4" />
              </Link>
            </nav>
          </div>
        </header>

        <main>
          <section className="relative isolate overflow-hidden border-b border-border">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.14),transparent_52%)]" />
            <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:py-28">
              <div>
                <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-6xl">
                  Prepare with purpose.
                  <span className="mt-2 block text-primary">Learn from every attempt.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                  Impulse brings exam-style tests, previous-year questions, custom practice, and progress
                  insights into one workspace—so you can move from solving to reviewing to choosing your
                  next study step.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/test-series" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition hover:opacity-90">
                    Explore test series <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a href="#test-series-analysis" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-bold text-foreground transition hover:bg-muted">
                    See test analysis <ArrowDown className="h-4 w-4" />
                  </a>
                </div>
                <p className="mt-5 text-xs leading-5 text-muted-foreground">
                  Independent practice tools; not an official exam authority or a guarantee of academic results.
                </p>
              </div>

              <div className="rounded-[2rem] border border-primary/20 bg-card p-5 shadow-2xl shadow-primary/5 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">The Impulse loop</p>
                    <h2 className="mt-2 text-2xl font-black text-foreground">Practice. Review. Refocus.</h2>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <TrendingUp className="h-6 w-6 text-emerald-500" />
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    ['01', 'Choose the right practice', 'Open a published test, past paper, or build a focused custom set.'],
                    ['02', 'Attempt under structure', 'Work through a timed session with the configured question and scoring format.'],
                    ['03', 'Review what happened', 'Revisit attempts and use accuracy, time, and topic-level summaries to guide practice.'],
                  ].map(([number, title, description]) => (
                    <div key={number} className="flex gap-4 rounded-2xl border border-border bg-background/70 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{number}</span>
                      <div>
                        <h3 className="font-bold text-foreground">{title}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="test-series-analysis" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              eyebrow="Test series highlight"
              title="More than a score: understand your whole attempt"
              description="After a test, go beyond checking the total. Explore where marks came from, which subjects and question types felt strong, how you used time, and what patterns you can work on in your next attempt."
            />

            <div className="mt-10 overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-xl">
              <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
                <div className="p-6 sm:p-9 lg:p-11">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                      <BarChart3 className="h-6 w-6 text-emerald-500" />
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Your post-test breakdown</p>
                      <h3 className="text-2xl font-black text-foreground sm:text-3xl">Turn one attempt into a plan</h3>
                    </div>
                  </div>
                  <p className="mt-6 text-base leading-7 text-muted-foreground">
                    Review a detailed scorecard, compare performance across subjects and sections, inspect
                    question-type accuracy, and see how time and answer choices shaped your result. The
                    question-level review and detailed solutions help you revisit the actual problems—not
                    just a summary number.
                  </p>
                  <Link to="/test-series" className="mt-7 inline-flex items-center gap-2 font-bold text-primary underline underline-offset-4">
                    Explore test series <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="border-t border-primary/15 bg-background/55 p-6 sm:p-9 lg:border-l lg:border-t-0 lg:p-11">
                  <h4 className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">What you can learn from an attempt</h4>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      [Target, 'Score and accuracy', 'See your score, correct, partial, wrong, and unattempted responses, plus your overall accuracy.', 'text-emerald-500'],
                      [Layers3, 'Subject and section report', 'Compare marks, attempts, accuracy, and time across subjects and sections.', 'text-blue-500'],
                      [ListChecks, 'Question-type performance', 'Review results for formats such as MCQ, multi-select, and numerical questions.', 'text-violet-500'],
                      [Timer, 'Time management', 'Check total time, average time per attempted question, pace, and question-level time patterns.', 'text-cyan-500'],
                      [TriangleAlert, 'Marking impact', 'Understand positive and partial marks, penalties from wrong answers, and risk taken.', 'text-amber-500'],
                      [PieChart, 'Test-taking patterns', 'Explore consistency, first- versus second-half performance, streaks, and review/skip patterns.', 'text-pink-500'],
                      [Gauge, 'Focus opportunities', 'Use subject-wise and question-wise feedback to spot areas that may deserve another look.', 'text-orange-500'],
                      [FileCheck2, 'Solutions and review', 'Revisit questions and detailed solutions after submission to learn from specific mistakes.', 'text-indigo-500'],
                    ].map(([Icon, title, description, iconColor]) => (
                      <div key={title} className="rounded-2xl border border-border bg-card p-4">
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                        <h5 className="mt-3 font-bold text-foreground">{title}</h5>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: CheckCircle2,
                  iconColor: 'text-emerald-500',
                  step: '01',
                  title: 'Know what went well',
                  text: 'Use subject, section, question-type, and accuracy breakdowns to recognize reliable areas in this attempt.',
                },
                {
                  icon: Clock3,
                  iconColor: 'text-amber-500',
                  step: '02',
                  title: 'Spot avoidable losses',
                  text: 'Look at time distribution, unanswered questions, and negative-marking impact to reflect on your test strategy.',
                },
                {
                  icon: RotateCcw,
                  iconColor: 'text-blue-500',
                  step: '03',
                  title: 'Choose a next step',
                  text: 'Revisit question-level feedback and solutions, then use what you learned to guide your next practice session.',
                },
              ].map(({ icon: Icon, iconColor, step, title, text }) => (
                <article key={step} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-[0.18em] text-primary">STEP {step}</span>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-y border-border bg-muted/25">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <SectionHeading
                eyebrow="More ways to practice"
                title="A connected toolkit for your preparation"
                description="Choose a ready-made route or shape a smaller session around what you are learning now. Each feature has a distinct job in your study workflow."
                centered
              />
              <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {FEATURES.map(({ icon: Icon, iconColor, title, description, href, link }) => (
                  <article key={title} className="flex flex-col rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                    </span>
                    <h3 className="mt-5 text-lg font-black text-foreground">{title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{description}</p>
                    <Link to={href} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary underline underline-offset-4">
                      {link} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              eyebrow="A practical workflow"
              title="From a single question to a useful review"
              description="Impulse is designed to keep practice and reflection close together, whether you have a few minutes for a chapter or time for a full mock test."
            />
            <div className="mt-9 grid gap-4 lg:grid-cols-4">
              {[
                [BookOpen, 'Choose', 'Pick a published test, a previous paper, a chapter question set, or a custom-test blueprint.', 'text-blue-500'],
                [Clock3, 'Attempt', 'Work through questions in the relevant practice or timed-exam experience.', 'text-amber-500'],
                [BookMarked, 'Save', 'Mark questions to revisit, or collect them in a notebook for later study.', 'text-pink-500'],
                [BarChart3, 'Reflect', 'Use your saved attempts and performance summaries to decide what to practice next.', 'text-emerald-500'],
              ].map(([Icon, title, text, iconColor], index) => (
                <div key={title} className="relative rounded-2xl border border-border bg-card p-6">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">0{index + 1}</span>
                  <Icon className={`mt-4 h-6 w-6 ${iconColor}`} />
                  <h3 className="mt-4 text-lg font-black text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
            <div className="rounded-[2rem] border border-border bg-card p-7 sm:p-10">
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Designed to be clear</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Your preparation stays yours.</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Sign in to save supported study progress, control profile-stat visibility, and use your
                    workspace across sessions. Review the policies to understand how account and study data
                    are handled.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-4 text-sm">
                    <Link to="/privacy" className="font-bold text-primary underline underline-offset-4">Privacy Policy</Link>
                    <Link to="/terms" className="font-bold text-primary underline underline-offset-4">Terms &amp; Conditions</Link>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
                  <Link to="/test-series" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">
                    Start with a test <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/pyq-practice" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 font-bold text-foreground hover:bg-muted">
                    Practice questions <Check className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default AboutPage;
