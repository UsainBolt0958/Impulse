import React, { useState } from 'react';
import { Bookmark, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ColoredIcon from '@/components/ColoredIcon';
import { useMarkedQuestions } from '@/hooks/useMarkedQuestions';
import { useNotebooks } from '@/hooks/useNotebooks';

function BookmarkQuestionButton({ question, showLabel = false, className = '' }) {
  const {
    notebooks,
    createNotebook,
    addQuestionToNotebook,
    removeQuestionFromNotebooks,
  } = useNotebooks();
  const { isMarked, toggleMark } = useMarkedQuestions();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(notebooks.length === 0);
  const [notebookName, setNotebookName] = useState('');
  const marked = isMarked(question.id);

  const saveToNotebook = (notebook) => {
    try {
      const wasAdded = addQuestionToNotebook(notebook.id, question.id);
      if (!marked) toggleMark(question.id);
      toast.success(wasAdded ? `Saved to ${notebook.name}` : `Already saved in ${notebook.name}`);
      setIsOpen(false);
    } catch {
      toast.error('Could not save this question. Please try again.');
    }
  };

  const createAndSave = (event) => {
    event.preventDefault();
    const trimmedName = notebookName.trim();
    if (!trimmedName) {
      toast.error('Enter a notebook name');
      return;
    }

    try {
      const notebook = createNotebook(trimmedName);
      if (!notebook) return;
      setNotebookName('');
      saveToNotebook(notebook);
    } catch {
      toast.error('Could not create the notebook. Please try again.');
    }
  };

  const removeBookmark = () => {
    try {
      toggleMark(question.id);
      removeQuestionFromNotebooks(question.id);
      toast.success('Removed from bookmarks and notebooks');
      setIsOpen(false);
    } catch {
      toast.error('Could not remove this bookmark. Please try again.');
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={showLabel ? 'default' : 'icon'}
        aria-label={marked ? 'Save question to a notebook' : 'Bookmark question'}
        title={marked ? 'Save question to a notebook' : 'Bookmark question'}
        className={className}
        onClick={() => {
          setIsCreating(notebooks.length === 0);
          setIsOpen(true);
        }}
      >
        <ColoredIcon
          icon={Bookmark}
          name="bookmark"
          size={4}
          className={marked ? 'fill-current' : ''}
        />
        {showLabel ? (marked ? 'Marked' : 'Mark for Review') : null}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save question to a notebook</DialogTitle>
            <DialogDescription>
              {notebooks.length > 0
                ? 'Choose a notebook, or create a new one for this question.'
                : 'Create a notebook to save this question.'}
            </DialogDescription>
          </DialogHeader>

          {!isCreating && notebooks.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {notebooks.map(notebook => (
                <Button
                  key={notebook.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => saveToNotebook(notebook)}
                >
                  <ColoredIcon icon={Bookmark} name="bookmark" size={4} />
                  {notebook.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {notebook.questionIds.length} questions
                  </span>
                </Button>
              ))}
            </div>
          )}

          {notebooks.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="justify-start"
              onClick={() => setIsCreating(value => !value)}
            >
              <Plus className="h-4 w-4" />
              {isCreating ? 'Choose an existing notebook' : 'Create a new notebook'}
            </Button>
          )}

          {isCreating && (
            <form onSubmit={createAndSave} className="flex gap-2">
              <Input
                autoFocus
                value={notebookName}
                onChange={event => setNotebookName(event.target.value)}
                placeholder="Notebook name"
                aria-label="Notebook name"
                maxLength={80}
              />
              <Button type="submit" disabled={!notebookName.trim()}>
                Create and save
              </Button>
            </form>
          )}

          {marked && (
            <Button type="button" variant="ghost" onClick={removeBookmark}>
              Remove bookmark from all notebooks
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BookmarkQuestionButton;
