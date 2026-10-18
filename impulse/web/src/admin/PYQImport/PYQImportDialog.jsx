import React, { useMemo, useState } from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { uploadImage } from '@/lib/portalServer';
import { generateId } from '@/lib/adminPortal';
import {
  buildImportedPyqQuestion,
  getSupportedPyqImageExtension,
  parsePyqImport,
  validatePyqImport,
} from './pyqImportFormat';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_QUESTIONS = 200;

export default function PYQImportDialog({
  exams,
  getSubjects,
  getChapters,
  existingQuestions,
  contributedBy,
  onClose,
  onImported,
}) {
  const [exam, setExam] = useState('');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [customChapter, setCustomChapter] = useState('');
  const [questionCount, setQuestionCount] = useState('1');
  const [manifest, setManifest] = useState(null);
  const [manifestName, setManifestName] = useState('');
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const subjects = useMemo(() => getSubjects(exam), [exam, getSubjects]);
  const chapters = useMemo(() => getChapters(subject, exam), [subject, exam, getChapters]);
  const selectedChapter = chapters.includes(chapter) ? chapter : customChapter;
  const target = {
    exam,
    subject,
    chapter: selectedChapter.trim(),
    questionCount: Number(questionCount),
  };
  const validation = useMemo(
    () => validatePyqImport(manifest, images, target, existingQuestions),
    [manifest, images, exam, subject, selectedChapter, questionCount, existingQuestions]
  );

  const handleExamChange = (value) => {
    setExam(value);
    setSubject('');
    setChapter('');
    setCustomChapter('');
    setManifest(null);
    setManifestName('');
  };

  const handleSubjectChange = (value) => {
    setSubject(value);
    setChapter('');
    setCustomChapter('');
    setManifest(null);
    setManifestName('');
  };

  const handleManifestSelect = async (event) => {
    const file = event.target.files?.[0];
    setManifest(null);
    setManifestName('');
    setError('');
    if (!file) return;
    try {
      const parsed = parsePyqImport(await file.text());
      setManifest(parsed);
      setManifestName(file.name);
    } catch (parseError) {
      setError(parseError.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleImagesSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const invalidFile = files.find((file) => (
      !getSupportedPyqImageExtension(file.name) || file.size > MAX_IMAGE_BYTES
    ));
    if (invalidFile) {
      setImages([]);
      setError(
        !getSupportedPyqImageExtension(invalidFile.name)
          ? `${invalidFile.name} is not a supported image. Choose SVG, PNG, JPG, or WEBP files.`
          : `${invalidFile.name} exceeds the 5 MB per-image limit.`
      );
      event.target.value = '';
      return;
    }
    setError('');
    setImages(files);
    event.target.value = '';
  };

  const handleImport = async () => {
    if (!manifest || validation.errors.length || isImporting) return;
    setIsImporting(true);
    setError('');
    try {
      const referencedNames = new Set();
      manifest.questions.forEach((question) => {
        if (question.image) referencedNames.add(question.image.toLocaleLowerCase());
        if (question.type.trim().toUpperCase() !== 'NUM' && question.type.trim().toUpperCase() !== 'NUMERIC') {
          Object.values(question.options).forEach((option) => {
            const image = typeof option === 'string' ? '' : option.image;
            if (image) referencedNames.add(image.toLocaleLowerCase());
          });
        }
      });

      const filesByName = new Map(images.map((file) => [file.name.toLocaleLowerCase(), file]));
      const imageUrls = {};
      for (const normalizedName of referencedNames) {
        const file = filesByName.get(normalizedName);
        if (!file) throw new Error(`Referenced image "${normalizedName}" was not selected.`);
        const uploaded = await uploadImage(file);
        if (!uploaded?.url) throw new Error(`Upload failed for "${file.name}".`);
        imageUrls[normalizedName] = uploaded.url;
      }

      const questions = manifest.questions.map((question) => ({
        ...buildImportedPyqQuestion(question, target, imageUrls, contributedBy),
        id: generateId('question'),
      }));
      await onImported(questions, target);
      onClose();
    } catch (importError) {
      setError(importError.message || 'Import failed. No questions were added.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isImporting && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import PYQ question series</DialogTitle>
          <DialogDescription>
            Choose where these questions belong, select the exact number to add, and validate a JSON manifest with its referenced image files before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Exam
              <select
                value={exam}
                onChange={(event) => handleExamChange(event.target.value)}
                disabled={isImporting}
                className="w-full rounded-md border border-input bg-background p-2"
              >
                <option value="">Select exam</option>
                {exams.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Subject
              <select
                value={subject}
                onChange={(event) => handleSubjectChange(event.target.value)}
                disabled={!exam || isImporting}
                className="w-full rounded-md border border-input bg-background p-2"
              >
                <option value="">Select subject</option>
                {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Chapter
              {chapters.length ? (
                <select
                  value={chapters.includes(chapter) ? chapter : ''}
                  onChange={(event) => {
                    setChapter(event.target.value);
                    setCustomChapter('');
                  }}
                  disabled={!subject || isImporting}
                  className="w-full rounded-md border border-input bg-background p-2"
                >
                  <option value="">Select a chapter or enter a custom one below</option>
                  {chapters.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              ) : null}
              <input
                value={chapters.includes(chapter) ? '' : customChapter}
                onChange={(event) => {
                  setCustomChapter(event.target.value);
                  setChapter('');
                }}
                placeholder={chapters.length ? 'Or enter a custom chapter' : 'Enter chapter'}
                disabled={!subject || isImporting}
                className="w-full rounded-md border border-input bg-background p-2"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Number of questions to add
              <input
                type="number"
                min="1"
                max={MAX_QUESTIONS}
                step="1"
                value={questionCount}
                onChange={(event) => setQuestionCount(event.target.value)}
                disabled={isImporting}
                className="w-full rounded-md border border-input bg-background p-2"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm font-medium">
            PYQ JSON manifest
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleManifestSelect}
              disabled={isImporting}
              className="block w-full rounded-md border border-input bg-background p-2 text-sm"
            />
          </label>
          {manifestName ? <p className="text-xs text-muted-foreground">Selected: {manifestName}</p> : null}

          <label className="block space-y-1 text-sm font-medium">
            Referenced question and option images (SVG, PNG, JPG, or WEBP; max 5 MB each)
            <input
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
              multiple
              onChange={handleImagesSelect}
              disabled={isImporting}
              className="block w-full rounded-md border border-input bg-background p-2 text-sm"
            />
          </label>
          {images.length ? <p className="text-xs text-muted-foreground">{images.length} image file(s) selected.</p> : null}

          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {manifest ? (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">Validation</h3>
              <p className="text-sm">
                {validation.errors.length === 0
                  ? `Ready to add ${manifest.questions.length} question(s) to ${exam} / ${subject} / ${target.chapter}.`
                  : `${validation.errors.length} issue(s) must be fixed before import.`}
              </p>
              {validation.errors.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                  {validation.errors.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
              {validation.warnings.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                  {validation.warnings.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
              {validation.errors.length === 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-md bg-secondary/40 p-3 text-sm">
                  {manifest.questions.map((question, index) => (
                    <p key={question.id || index} className="border-b border-border py-2 last:border-0">
                      {index + 1}. {question.id ? `${question.id} — ` : ''}{question.text?.trim() || '[image question]'} ({question.year}, {question.shift}, {question.difficulty})
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-semibold">JSON format</summary>
            <pre className="mt-3 overflow-x-auto text-xs">{`{
  "schemaVersion": 1,
  "expectedQuestionCount": 1,
  "questions": [{
    "id": "JEE-M-2024-001",
    "year": 2024,
    "shift": "Shift 1",
    "difficulty": "Medium",
    "type": "MCQ",
    "text": "Question text with $math$",
    "image": "JEE-M-2024-001-Q.svg",
    "options": {
      "A": { "text": "Option A", "image": "JEE-M-2024-001-OPT-A.svg" },
      "B": "Option B",
      "C": "Option C",
      "D": "Option D"
    },
    "answer": "A",
    "solution": "Worked solution"
  }]
}`}</pre>
            <p className="mt-2 text-xs text-muted-foreground">
              year must be a whole number; difficulty is required and must be Easy, Medium, or Hard. For numeric questions use type "NUM", omit options, and set answer to a finite number. The selected count must match both expectedQuestionCount and the questions array.
            </p>
          </details>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isImporting}>Cancel</Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!manifest || validation.errors.length > 0 || isImporting}
          >
            <Upload size={16} className="mr-2" />
            {isImporting ? 'Importing...' : `Add ${Number.isInteger(target.questionCount) ? target.questionCount : 0} questions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
