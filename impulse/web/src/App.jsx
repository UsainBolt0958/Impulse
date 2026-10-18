import React from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import PYQPracticePage from './pages/PYQPracticePage';
import FullScreenSolvingPage from './pages/FullScreenSolvingPage.jsx';
import TestSeriesPage from './pages/TestSeriesPage';
import ExamPlayer from './pages/ExamPlayer';
import AnalysisPage from './pages/AnalysisPage';
import ProfilePage from './pages/ProfilePage';
import NotebookPage from './pages/NotebookPage';
import CalendarPage from './pages/CalendarPage';
import PreviousPapersPage from './pages/PreviousPapersPage';
import PreviousPapersExamPage from './pages/PreviousPapersExamPage';
import CustomTestBuilderPage from './pages/CustomTestBuilderPage';
import CustomTestExamPage from './pages/CustomTestExamPage';
import CustomTestResultsPage from './pages/CustomTestResultsPage';
import CustomTestPage from './pages/CustomTestPage';
import Sidebar from './components/Sidebar';
import { Toaster } from '@/components/ui/sonner';

function AppContent() {
  const location = useLocation();
  // Determine if we are on a full-screen route (like the solving interface)
  const isFullScreen = location.pathname.startsWith('/solve') || location.pathname === '/custom-test/exam';

  return (
    <div className={isFullScreen ? "flex h-[100dvh] w-full overflow-hidden bg-background" : "app-layout"}>
      {!isFullScreen && <Sidebar />}
      
      <div className={isFullScreen ? "flex-1 min-w-0 flex flex-col relative" : "main-content"}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          
          <Route path="/pyq-practice" element={<PYQPracticePage />} />
          <Route path="/test-series" element={<TestSeriesPage />} />
          <Route path="/exam-player" element={<ExamPlayer />} />
          <Route path="/custom-test" element={<CustomTestPage />} />
          <Route path="/custom-test/build" element={<CustomTestBuilderPage />} />
          <Route path="/custom-test/exam" element={<CustomTestExamPage />} />
          <Route path="/custom-test/results/:resultId" element={<CustomTestResultsPage />} />
          
          <Route path="/practice" element={<Navigate to="/pyq-practice" replace />} />
          <Route path="/tests" element={<Navigate to="/test-series" replace />} />
          
          {/* Replaced SolvingPage with FullScreenSolvingPage */}
          <Route path="/solve/:questionId" element={<FullScreenSolvingPage />} />
          
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notebook" element={<NotebookPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/previous-papers" element={<PreviousPapersPage />} />
          <Route path="/previous-papers/:examKey" element={<PreviousPapersExamPage />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AppContent />
      <Toaster />
    </Router>
  );
}

export default App;