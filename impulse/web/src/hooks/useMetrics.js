import { useMemo } from 'react';
import { useSolvedQuestions } from './useSolvedQuestions';
import { useAttemptQuestionMetadata } from './useAttemptQuestionMetadata';

export function useMetrics() {
  const { solvedQuestions } = useSolvedQuestions();
  const questionMetadata = useAttemptQuestionMetadata(solvedQuestions);

  const metrics = useMemo(() => {
    const getQuestionDetails = (attempt) => {
      const metadata = questionMetadata[String(attempt.question_id)] || {};
      return {
        ...metadata,
        ...attempt,
        exam: attempt.exam || metadata.exam,
        subject: attempt.subject || metadata.subject,
        chapter: attempt.chapter || metadata.chapter,
        difficulty: attempt.difficulty || metadata.difficulty,
      };
    };

    // Daily/Weekly/Yearly counts
    const getCountsByPeriod = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const yearAgo = new Date(today);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      const daily = new Set();
      const weekly = new Set();
      const yearly = new Set();

      solvedQuestions.forEach(sq => {
        const date = new Date(sq.timestamp);
        if (!sq.question_id || !Number.isFinite(date.getTime())) return;
        if (date >= today) daily.add(sq.question_id);
        if (date >= weekAgo) weekly.add(sq.question_id);
        if (date >= yearAgo) yearly.add(sq.question_id);
      });

      return {
        daily: daily.size,
        weekly: weekly.size,
        yearly: yearly.size
      };
    };

    // Difficulty breakdown
    const getDifficultyBreakdown = () => {
      const breakdown = { Easy: 0, Medium: 0, Hard: 0 };
      const uniqueQuestions = new Set();

      solvedQuestions.forEach(sq => {
        if (!uniqueQuestions.has(sq.question_id)) {
          uniqueQuestions.add(sq.question_id);
          const q = getQuestionDetails(sq);
          if (q && q.difficulty) {
            breakdown[q.difficulty] = (breakdown[q.difficulty] || 0) + 1;
          }
        }
      });

      return breakdown;
    };

    // Chapter-wise metrics
    const getChapterMetrics = () => {
      const chapterData = {};

      solvedQuestions.forEach(sq => {
        const q = getQuestionDetails(sq);
        if (q?.chapter) {
          if (!chapterData[q.chapter]) {
            chapterData[q.chapter] = { total: 0, correct: 0, totalTime: 0 };
          }
          chapterData[q.chapter].total++;
          if (sq.is_correct) chapterData[q.chapter].correct++;
          chapterData[q.chapter].totalTime += sq.time_taken || 0;
        }
      });

      return Object.entries(chapterData).map(([chapter, data]) => ({
        chapter,
        solved: data.total,
        accuracy: ((data.correct / data.total) * 100).toFixed(1),
        avgTime: (data.totalTime / data.total).toFixed(1)
      }));
    };

    // Subject-wise metrics
    const getSubjectMetrics = () => {
      const subjectData = {};

      solvedQuestions.forEach(sq => {
        const q = getQuestionDetails(sq);
        if (q?.subject) {
          if (!subjectData[q.subject]) {
            subjectData[q.subject] = { total: 0, correct: 0, totalTime: 0 };
          }
          subjectData[q.subject].total++;
          if (sq.is_correct) subjectData[q.subject].correct++;
          subjectData[q.subject].totalTime += sq.time_taken || 0;
        }
      });

      return Object.entries(subjectData).map(([subject, data]) => ({
        subject,
        solved: data.total,
        accuracy: ((data.correct / data.total) * 100).toFixed(1),
        avgTime: (data.totalTime / data.total).toFixed(1)
      }));
    };

    // Exam-wise performance
    const getExamMetrics = () => {
      const examData = {};

      solvedQuestions.forEach(sq => {
        const q = getQuestionDetails(sq);
        if (q?.exam) {
          if (!examData[q.exam]) {
            examData[q.exam] = { total: 0, correct: 0, totalTime: 0 };
          }
          examData[q.exam].total++;
          if (sq.is_correct) examData[q.exam].correct++;
          examData[q.exam].totalTime += sq.time_taken || 0;
        }
      });

      return Object.entries(examData).map(([exam, data]) => ({
        exam,
        solved: data.total,
        accuracy: ((data.correct / data.total) * 100).toFixed(1),
        avgTime: (data.totalTime / data.total).toFixed(1)
      }));
    };

    // Accuracy trends over time (last 30 days)
    const getAccuracyTrends = () => {
      const trends = [];
      const now = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayQuestions = solvedQuestions.filter(sq => {
          const sqDate = new Date(sq.timestamp);
          return sqDate >= date && sqDate < nextDate;
        });

        const correct = dayQuestions.filter(sq => sq.is_correct).length;
        const total = dayQuestions.length;
        const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;

        trends.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          accuracy: parseFloat(accuracy),
          count: total
        });
      }

      return trends;
    };

    // Activity heatmap data
    const getActivityHeatmap = () => {
      const heatmapData = {};

      solvedQuestions.forEach(sq => {
        const date = new Date(sq.timestamp);
        const dateKey = date.toISOString().split('T')[0];
        heatmapData[dateKey] = (heatmapData[dateKey] || 0) + 1;
      });

      return heatmapData;
    };

    return {
      periodCounts: getCountsByPeriod(),
      difficultyBreakdown: getDifficultyBreakdown(),
      chapterMetrics: getChapterMetrics(),
      subjectMetrics: getSubjectMetrics(),
      examMetrics: getExamMetrics(),
      accuracyTrends: getAccuracyTrends(),
      activityHeatmap: getActivityHeatmap()
    };
  }, [solvedQuestions, questionMetadata]);

  return metrics;
}