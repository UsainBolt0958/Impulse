import React, { lazy, Suspense } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Sidebar from './components/Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { startClientSessionHeartbeat } from '@/lib/portalServer';

const HomePage = lazy(() => import('./pages/HomePage'));
const PYQPracticePage = lazy(() => import('./pages/PYQPracticePage'));
const FullScreenSolvingPage = lazy(() => import('./pages/FullScreenSolvingPage.jsx'));
const TestSeriesPage = lazy(() => import('./pages/TestSeriesPage'));
const TestSeriesExamPage = lazy(() => import('./pages/TestSeriesExamPage'));
const ExamPlayer = lazy(() => import('./pages/ExamPlayer'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const NotebookPage = lazy(() => import('./pages/NotebookPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const PreviousPapersPage = lazy(() => import('./pages/PreviousPapersPage'));
const PreviousPapersExamPage = lazy(() => import('./pages/PreviousPapersExamPage'));
const CustomTestBuilderPage = lazy(() => import('./pages/CustomTestBuilderPage'));
const CustomTestExamPage = lazy(() => import('./pages/CustomTestExamPage'));
const CustomTestResultsPage = lazy(() => import('./pages/CustomTestResultsPage'));
const CustomTestPage = lazy(() => import('./pages/CustomTestPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PremiumPage = lazy(() => import('./pages/PremiumPage'));
const LegalPages = lazy(() => import('./pages/LegalPages'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

function AppContent() {
  const location = useLocation();
  const { user, profile, authLoading, profileLoading, syncStatus } = useAuth();
  const isPublicPage = ['/about', '/privacy', '/terms'].includes(location.pathname);
  React.useEffect(() => {
    if (authLoading || !user) return undefined;
    return startClientSessionHeartbeat();
  }, [authLoading, user]);
  // Determine if we are on a full-screen route (like the solving interface)
  const isFullScreen = location.pathname.startsWith('/solve') || location.pathname === '/custom-test/exam';

  if (!isPublicPage && (authLoading || (user && (profileLoading || syncStatus === 'loading')))) {
    return (
      <main
        role="status"
        aria-label="Loading your saved study data"
        className="app-loading-screen flex min-h-screen flex-col items-center justify-center gap-6"
      >
        <div aria-hidden="true" className="app-loader" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          Loading your saved study data
        </p>
      </main>
    );
  }

  if ((!user || !profile?.username) && !isPublicPage) return <LoginPage />;

  return (
    <div className={isPublicPage ? "min-h-screen bg-background" : isFullScreen ? "flex h-[100dvh] w-full overflow-hidden bg-background" : "app-layout"}>
      {!isPublicPage && !isFullScreen && <Sidebar />}
      
      <div className={isPublicPage ? "min-h-screen" : isFullScreen ? "flex-1 min-w-0 flex flex-col relative" : "main-content"}>
        <Suspense
          fallback={(
            <main role="status" aria-label="Loading page" className="flex min-h-[50vh] items-center justify-center">
              <p className="text-sm font-semibold text-muted-foreground">Loading page...</p>
            </main>
          )}
        >
          <Routes>
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<LegalPages />} />
            <Route path="/terms" element={<LegalPages />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/account" element={<Navigate to="/profile" replace />} />
            
            <Route path="/pyq-practice" element={<PYQPracticePage />} />
            <Route path="/test-series" element={<TestSeriesPage />} />
            <Route path="/test-series/:seriesId/:testId" element={<TestSeriesExamPage />} />
            <Route path="/exam-player" element={<ExamPlayer />} />
            <Route path="/custom-test" element={<CustomTestPage />} />
            <Route path="/custom-test/build" element={<CustomTestBuilderPage />} />
            <Route path="/custom-test/exam" element={<CustomTestExamPage />} />
            <Route path="/custom-test/results/:resultId" element={<CustomTestResultsPage />} />
            
            <Route path="/practice" element={<Navigate to="/pyq-practice" replace />} />
            <Route path="/tests" element={<Navigate to="/test-series" replace />} />
            
            <Route path="/solve/:questionId" element={<FullScreenSolvingPage />} />
            
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/premium" element={<PremiumPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/friends/:friendId" element={<FriendsPage />} />
            <Route path="/notebook" element={<NotebookPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/previous-papers" element={<PreviousPapersPage />} />
            <Route path="/previous-papers/:examKey/year/:year" element={<PreviousPapersExamPage />} />
            <Route path="/previous-papers/:examKey/:paperId" element={<PreviousPapersExamPage />} />
            <Route path="/previous-papers/:examKey" element={<PreviousPapersExamPage />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppContent />
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;