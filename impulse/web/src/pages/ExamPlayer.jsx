import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getSeries, getTest } from '@/lib/portalServer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

function ExamPlayer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const testId = searchParams.get('testId');
  const seriesId = searchParams.get('seriesId');

  const [series, setSeries] = useState(null);
  const [test, setTest] = useState(null);
  const [template, setTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!testId || !seriesId) {
        toast.error('Missing test or series id');
        navigate('/test-series');
        return;
      }

      setIsLoading(true);
      try {
        const s = await getSeries(seriesId);
        const t = await getTest(testId);
        const tplResp = await fetch(`/api/tests/${testId}/template`);
        const tpl = await tplResp.json();

        setSeries(s);
        setTest(t);
        setTemplate(tpl);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load exam');
        navigate('/test-series');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [testId, seriesId, navigate]);

  if (isLoading) return <div className="p-8 text-center">Loading exam...</div>;
  if (!template || !template.sections) return <div className="p-8 text-center">No exam template found.</div>;

  const flatQuestions = template.sections.flatMap((sec) => sec.questions || []);
  const question = flatQuestions[currentIndex] || null;

  const handleSelect = (qIndex, answer) => {
    setAnswers({ ...answers, [qIndex]: answer });
  };

  const handleNext = () => setCurrentIndex(Math.min(currentIndex + 1, flatQuestions.length - 1));
  const handlePrev = () => setCurrentIndex(Math.max(currentIndex - 1, 0));

  const handleSubmit = () => {
    // Basic scoring using series sections marking if available
    let score = 0;
    flatQuestions.forEach((q, idx) => {
      const correct = q.answer || 'A';
      const user = answers[idx];
      // Find section for this question
      const section = template.sections.find((s) => (s.questions || []).includes(q));
      const pos = section?.marksCorrect ?? 4;
      const neg = typeof section?.marksWrong === 'number' ? section.marksWrong : -1;
      if (!user) return;
      if (user === correct) score += pos;
      else score += neg;
    });

    toast.success(`Submitted — Score: ${score}`);
    navigate('/test-series');
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{series?.title || 'Exam'}</h1>
        <p className="text-sm text-muted-foreground mb-6">{test?.title || test?.name}</p>

        <Card>
          <CardHeader>
            <CardTitle>Question {currentIndex + 1} of {flatQuestions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            {question ? (
              <div className="space-y-4">
                <div className="prose" dangerouslySetInnerHTML={{ __html: question.text || 'No question text' }} />
                {(question.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`q-${currentIndex}`}
                      checked={answers[currentIndex] === opt.key}
                      onChange={() => handleSelect(currentIndex, opt.key)}
                    />
                    <div dangerouslySetInnerHTML={{ __html: opt.text || opt }} />
                  </div>
                ))}
              </div>
            ) : (
              <div>No question</div>
            )}

            <div className="flex gap-2 mt-6">
              <Button onClick={handlePrev} disabled={currentIndex === 0}>Previous</Button>
              <Button onClick={handleNext} disabled={currentIndex === flatQuestions.length - 1}>Next</Button>
              <div className="flex-1" />
              <Button variant="destructive" onClick={handleSubmit}>Submit Test</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ExamPlayer;
