import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit3, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getTest } from '@/lib/portalServer';

export default function QuestionsPanel({ test, subject, section, onSelectQuestion, onDeleteQuestion, onBack }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        if (!test?.id) {
          setQuestions([]);
          return;
        }

        const freshTest = await getTest(test.id);
        if (freshTest?.sections) {
          const targetSection = freshTest.sections.find((s) => {
            const sameId = Boolean(section?.id) && s.id === section.id;
            const sameName = Boolean(section?.sectionName || section?.name) &&
              (s.sectionName === (section?.sectionName || section?.name) || s.name === (section?.sectionName || section?.name));
            const sameSubject = !subject || s.subject === subject || s.subject === section?.subject;
            return (sameId || sameName) && sameSubject;
          });

          const sectionQuestions = Array.isArray(targetSection?.questions)
            ? targetSection.questions
            : [];
          setQuestions(sectionQuestions);
        }
      } catch (error) {
        console.error('Failed to fetch questions:', error);
        toast.error('Failed to load questions');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [test?.id, section?.id, section?.sectionName, section?.name, subject]);

  const handleAddQuestion = () => {
    onSelectQuestion({
      id: null,
      text: '',
      imageUrl: '',
      type: section?.type || 'MCQ',
      options: [
        { text: '', imageUrl: '', key: 'A' },
        { text: '', imageUrl: '', key: 'B' },
        { text: '', imageUrl: '', key: 'C' },
        { text: '', imageUrl: '', key: 'D' },
      ],
      answer: '',
      section: section?.id || section?.sectionName || section?.name,
      subject,
    });
  };

  const handleDeleteQuestion = async (question) => {
    if (!question?.id) return;
    if (!window.confirm('Delete this question?')) return;

    try {
      await onDeleteQuestion?.(question);
      setQuestions((current) => current.filter((q) => q.id !== question.id));
      toast.success('Question deleted');
    } catch (error) {
      toast.error(error?.message || 'Failed to delete question');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Questions</h2>
            <p className="text-gray-600 text-sm">
              {subject} • Section {section?.name} ({section?.type})
            </p>
          </div>
        </div>
        <Button onClick={handleAddQuestion} disabled={loading}>
          <Plus size={20} className="mr-2" />
          New Question
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-500">Loading questions...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-500">No questions yet for this section</p>
          <Button onClick={handleAddQuestion} className="mt-4">
            <Plus size={20} className="mr-2" />
            Add First Question
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => (
            <Card key={q.id || `question-${q.text || 'draft'}-${idx}`} className="hover:shadow-md transition">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">Q{idx + 1}</div>
                    <div className="text-sm text-gray-600 line-clamp-2">{q.text}</div>
                    {q.imageUrl && <Badge className="mt-2">Has image</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectQuestion(q)}
                    >
                      <Edit3 size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => handleDeleteQuestion(q)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
