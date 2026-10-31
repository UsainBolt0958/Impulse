import React, { useMemo, useState } from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseQuizQuestionImport, validateQuizQuestionImport } from './quizQuestionImport';

const EXAMPLE_JSON = `{
  "questions": [
    {
      "subject": "Physics",
      "chapter": "Motion in 1D",
      "question": "A car travels 100 m in 5 s. What is its average speed?",
      "options": {
        "A": "10 m/s",
        "B": "20 m/s",
        "C": "50 m/s",
        "D": "500 m/s"
      },
      "answer": "B",
      "explanation": "Average speed is distance divided by time."
    }
  ]
}`;

export default function QuizQuestionImporter({ onImport }) {
  const [manifest, setManifest] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const validation = useMemo(() => validateQuizQuestionImport(manifest), [manifest]);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    setManifest(null);
    setFileName('');
    setError('');
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('The JSON file must be smaller than 2 MB.');
      return;
    }

    try {
      setManifest(parseQuizQuestionImport(await file.text()));
      setFileName(file.name);
    } catch (fileError) {
      setError(fileError.message || 'The JSON file could not be read.');
    }
  };

  const handleImport = async () => {
    if (validation.errors.length || validation.questions.length === 0) return;
    setIsImporting(true);
    setError('');
    try {
      await onImport(validation.questions);
      setManifest(null);
      setFileName('');
    } catch (importError) {
      setError(importError.message || 'Questions could not be imported.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">Challenge content</p>
        <h2 className="text-3xl font-black uppercase tracking-tight">Quiz question importer</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Upload MCQs tagged with a subject and chapter. Imported questions are added to the shared question library and become available for friend challenges.
        </p>
      </section>

      <Card className="rounded-[1.75rem] border-border/80">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase tracking-tight">Import JSON questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            Question JSON file (maximum 2 MB)
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              disabled={isImporting}
              className="block w-full rounded-md border border-input bg-background p-2 text-sm"
            />
          </label>
          {fileName ? <p className="text-xs text-muted-foreground">{fileName}</p> : null}

          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {manifest ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              {validation.errors.length ? (
                <div role="alert" className="space-y-1 text-sm text-destructive">
                  <p className="font-semibold">Fix these issues before importing:</p>
                  {validation.errors.map((item) => <p key={item}>• {item}</p>)}
                </div>
              ) : (
                <p className="text-sm font-semibold text-green-700">
                  {validation.questions.length} question(s) validated and ready to import.
                </p>
              )}
              {validation.questions.length > 0 ? (
                <ul className="max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-sm text-muted-foreground">
                  {validation.questions.slice(0, 5).map((question, index) => (
                    <li key={`${question.chapter}-${index}`}>
                      {question.subject} / {question.chapter}: {question.question_text}
                    </li>
                  ))}
                  {validation.questions.length > 5 ? <li>And {validation.questions.length - 5} more...</li> : null}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={handleImport}
            disabled={isImporting || !manifest || validation.errors.length > 0 || !validation.questions.length}
            className="rounded-full px-5 font-black uppercase tracking-[0.16em]"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? 'Importing...' : `Import ${validation.questions.length || ''} questions`}
          </Button>

          <details className="rounded-xl border border-border bg-secondary/20 p-4">
            <summary className="cursor-pointer text-sm font-bold">View the JSON format</summary>
            <pre className="mt-3 overflow-x-auto text-xs leading-relaxed">{EXAMPLE_JSON}</pre>
            <p className="mt-3 text-xs text-muted-foreground">
              Each question needs subject, chapter, question text, four A-D options, and an answer key. Top-level subject and chapter values may be used as defaults for every question.
            </p>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
