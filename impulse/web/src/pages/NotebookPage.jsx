import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import QuestionCard from '@/components/QuestionCard.jsx';
import { useMarkedQuestions } from '@/hooks/useMarkedQuestions';
import { useQuestions } from '@/hooks/useQuestions';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark } from 'lucide-react';
import ColoredIcon from '@/components/ColoredIcon';

function NotebookPage() {
  const { markedQuestions } = useMarkedQuestions();
  const { questions } = useQuestions();
  const { isQuestionSolved } = useSolvedQuestions();
  
  const [examFilter, setExamFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const markedQuestionObjects = questions.filter(q => markedQuestions.includes(q.id));

  const filteredQuestions = markedQuestionObjects.filter(q => {
    if (examFilter !== 'all' && q.exam !== examFilter) return false;
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  const exams = [...new Set(questions.map(q => q.exam))];
  const difficulties = ['Easy', 'Medium', 'Hard'];

  return (
    <>
      <Helmet>
        <title>Notebook - Impulse</title>
        <meta name="description" content="Review your marked questions and important topics" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h1 className="text-5xl font-black uppercase tracking-tight mb-2">Notebook</h1>
              <p className="text-lg text-muted-foreground">Review your marked questions</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Select value={examFilter} onValueChange={setExamFilter}>
                <SelectTrigger className="w-full sm:w-48 font-bold">
                  <SelectValue placeholder="All Exams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold">All Exams</SelectItem>
                  {exams.map(exam => (
                    <SelectItem key={exam} value={exam} className="font-bold">{exam}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="w-full sm:w-48 font-bold">
                  <SelectValue placeholder="All Difficulties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold">All Difficulties</SelectItem>
                  {difficulties.map(diff => (
                    <SelectItem key={diff} value={diff} className="font-bold">{diff}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <span>{filteredQuestions.length} marked questions</span>
              </div>
            </div>

            {filteredQuestions.length > 0 ? (
              <div className="space-y-4">
                {filteredQuestions.map(question => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    isSolved={isQuestionSolved(question.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <ColoredIcon icon={Bookmark} name="bookmark" size={16} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">No marked questions</h3>
                <p className="text-sm text-muted-foreground">Mark questions while solving to review them later</p>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default NotebookPage;