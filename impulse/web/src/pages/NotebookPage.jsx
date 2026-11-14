import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import QuestionCard from '@/components/QuestionCard.jsx';
import { useMarkedQuestions } from '@/hooks/useMarkedQuestions';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useQuestions } from '@/hooks/useQuestions';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark, NotebookPen, Plus } from 'lucide-react';
import { toast } from 'sonner';
import ColoredIcon from '@/components/ColoredIcon';

function NotebookPage() {
  const { markedQuestions } = useMarkedQuestions();
  const { notebooks, createNotebook } = useNotebooks();
  const { questions } = useQuestions();
  const { isQuestionSolved } = useSolvedQuestions();

  const [activeNotebookId, setActiveNotebookId] = useState('marked');
  const [isCreating, setIsCreating] = useState(false);
  const [notebookName, setNotebookName] = useState('');
  const [examFilter, setExamFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const selectedNotebook = notebooks.find(notebook => notebook.id === activeNotebookId);
  const selectedQuestionIds = selectedNotebook?.questionIds || markedQuestions;
  const selectedQuestions = questions.filter(question => selectedQuestionIds.includes(question.id));
  const filteredQuestions = selectedQuestions.filter(question => {
    if (examFilter !== 'all' && question.exam !== examFilter) return false;
    if (difficultyFilter !== 'all' && question.difficulty !== difficultyFilter) return false;
    return true;
  });
  const exams = [...new Set(selectedQuestions.map(question => question.exam).filter(Boolean))];
  const selectedTitle = selectedNotebook?.name || 'Bookmarked questions';

  const handleCreateNotebook = (event) => {
    event.preventDefault();
    const trimmedName = notebookName.trim();
    if (!trimmedName) {
      toast.error('Enter a notebook name');
      return;
    }

    try {
      const notebook = createNotebook(trimmedName);
      if (!notebook) return;
      setActiveNotebookId(notebook.id);
      setNotebookName('');
      setIsCreating(false);
      setExamFilter('all');
      setDifficultyFilter('all');
      toast.success(`Created ${notebook.name}`);
    } catch {
      toast.error('Could not create the notebook. Please try again.');
    }
  };

  const selectNotebook = (notebookId) => {
    setActiveNotebookId(notebookId);
    setExamFilter('all');
    setDifficultyFilter('all');
  };

  return (
    <>
      <Helmet>
        <title>Notebook - Impulse</title>
        <meta name="description" content="Organize and review questions saved in your notebooks" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h1 className="mb-2 text-3xl font-black uppercase tracking-tight sm:text-5xl">Notebook</h1>
              <p className="text-lg text-muted-foreground">Organize questions into notebooks for later review</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-bold"
                  onClick={() => setIsCreating(value => !value)}
                >
                  <Plus className="h-4 w-4" />
                  Create new notebook
                </Button>

                {isCreating && (
                  <form onSubmit={handleCreateNotebook} className="space-y-2 rounded-xl border border-border bg-card p-3">
                    <Input
                      autoFocus
                      value={notebookName}
                      onChange={event => setNotebookName(event.target.value)}
                      placeholder="Notebook name"
                      aria-label="Notebook name"
                      maxLength={80}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={!notebookName.trim()}>
                        Create
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => selectNotebook('marked')}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      activeNotebookId === 'marked'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:bg-secondary/50'
                    }`}
                  >
                    <ColoredIcon icon={Bookmark} name="bookmark" size={4} />
                    <span className="min-w-0 flex-1 font-bold">Bookmarked questions</span>
                    <span className="text-xs text-muted-foreground">{markedQuestions.length}</span>
                  </button>

                  {notebooks.map(notebook => (
                    <button
                      key={notebook.id}
                      type="button"
                      onClick={() => selectNotebook(notebook.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        activeNotebookId === notebook.id
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border hover:bg-secondary/50'
                      }`}
                    >
                      <ColoredIcon icon={NotebookPen} name="notebook" size={4} />
                      <span className="min-w-0 flex-1 truncate font-bold">{notebook.name}</span>
                      <span className="text-xs text-muted-foreground">{notebook.questionIds.length}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="min-w-0">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{selectedTitle}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {filteredQuestions.length} question{filteredQuestions.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select value={examFilter} onValueChange={setExamFilter}>
                      <SelectTrigger className="w-full font-bold sm:w-48">
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
                      <SelectTrigger className="w-full font-bold sm:w-48">
                        <SelectValue placeholder="All Difficulties" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="font-bold">All Difficulties</SelectItem>
                        {['Easy', 'Medium', 'Hard'].map(difficulty => (
                          <SelectItem key={difficulty} value={difficulty} className="font-bold">{difficulty}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div className="rounded-2xl border-2 border-dashed border-border py-20 text-center">
                    <ColoredIcon
                      icon={selectedNotebook ? NotebookPen : Bookmark}
                      name={selectedNotebook ? 'notebook' : 'bookmark'}
                      size={16}
                      className="mx-auto mb-4 text-muted-foreground"
                    />
                    <h3 className="mb-2 text-xl font-black uppercase tracking-tight">
                      {selectedNotebook ? 'This notebook is empty' : 'No bookmarked questions'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Save questions from PYQ Practice or while solving to review them here.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default NotebookPage;
