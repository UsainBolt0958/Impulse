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
import {
  buildImportedPaperQuestions,
  getSupportedPaperImageExtension,
  parsePaperImport,
  validatePaperImport,
} from './paperImportFormat';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function PaperImportDialog({
  exam,
  existingQuestions,
  contributedBy,
  onClose,
  onImported,
}) {
  const [manifest, setManifest] = useState(null);
  const [manifestName, setManifestName] = useState('');
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const validation = useMemo(
    () => validatePaperImport(manifest, images, existingQuestions, exam),
    [manifest, images, existingQuestions, exam]
  );
  const subjectCounts = useMemo(() => {
    if (!Array.isArray(manifest?.questions)) return [];
    const counts = new Map();
    manifest.questions.forEach((question) => {
      if (typeof question?.subject !== 'string') return;
      const subject = question.subject.trim();
      counts.set(subject, (counts.get(subject) || 0) + 1);
    });
    return [...counts.entries()];
  }, [manifest]);
  const exampleSubject = exam === 'NEET' ? 'Biology' : 'Mathematics';
  const exampleIdPrefix = exam === 'NEET' ? 'NEET' : exam === 'MHTCET' ? 'MHTCET' : 'JEE-MAINS';

  const handleManifestSelect = async (event) => {
    const file = event.target.files?.[0];
    setManifest(null);
    setManifestName('');
    setError('');
    if (!file) return;
    try {
      setManifest(parsePaperImport(await file.text()));
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
      !getSupportedPaperImageExtension(file.name) || file.size > MAX_IMAGE_BYTES
    ));
    if (invalidFile) {
      setImages([]);
      setError(
        !getSupportedPaperImageExtension(invalidFile.name)
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
    if (!manifest || validation.errors.length > 0 || isImporting) return;
    setIsImporting(true);
    setError('');
    try {
      const referencedNames = new Set();
      manifest.questions.forEach((question) => {
        if (question.image) referencedNames.add(question.image.toLocaleLowerCase());
        if (['MCQ'].includes(question.type.trim().toUpperCase())) {
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

      const questions = buildImportedPaperQuestions(manifest, imageUrls, contributedBy);
      await onImported(questions, manifest);
      onClose();
    } catch (importError) {
      setError(importError.message || 'Paper import failed. No questions were saved.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isImporting && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import complete {exam} paper</DialogTitle>
          <DialogDescription>
            Upload one {exam} paper JSON and its referenced images. Each question is placed in the PYQ library under its JSON subject and chapter.
            The complete paper is also added to Previous Papers as its own playable dynamic-engine exam.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <label className="block space-y-1 text-sm font-medium">
            {exam} paper JSON
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
              <h3 className="font-semibold">Paper validation</h3>
              <p className="text-sm">
                {validation.errors.length === 0
                  ? `Ready to import ${manifest.questions.length} questions from ${manifest.exam} ${manifest.year}, ${manifest.shiftName}.`
                  : `${validation.errors.length} issue(s) must be fixed before import.`}
              </p>
              {subjectCounts.length ? (
                <div className="flex flex-wrap gap-2">
                  {subjectCounts.map(([subject, count]) => (
                    <span key={subject} className="rounded-full border px-3 py-1 text-xs">
                      {subject}: {count}
                    </span>
                  ))}
                </div>
              ) : null}
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
                <div className="max-h-56 overflow-y-auto rounded-md bg-secondary/40 p-3 text-sm">
                  {manifest.questions.map((question, index) => (
                    <p key={question.id} className="border-b border-border py-2 last:border-0">
                      {index + 1}. {question.id} — {question.subject} / {question.chapter} / {question.difficulty}: {question.text?.trim() || '[image question]'}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-semibold">{exam} paper JSON format</summary>
            <pre className="mt-3 overflow-x-auto text-xs">{`{
  "schemaVersion": 1,
  "exam": "${exam}",
  "year": 2025,
  "shiftName": "Session / date - shift or paper identifier",
  "expectedQuestionCount": 2,
  "questions": [
    {
      "id": "${exampleIdPrefix}-2025-PHY-001",
      "subject": "Physics",
      "chapter": "Electrostatics",
      "difficulty": "Medium",
      "type": "MCQ",
      "text": "Question text with $math$",
      "image": "PHY-001-Q.svg",
      "options": {
        "A": { "text": "Option A", "image": "PHY-001-OPT-A.svg" },
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "answer": "A",
      "solution": "Worked solution"
    },
    {
      "id": "${exampleIdPrefix}-2025-SUBJECT-001",
      "subject": "${exampleSubject}",
      "chapter": "Enter the matching chapter",
      "difficulty": "Hard",
      "type": "MCQ",
      "text": "Question text",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "answer": "A",
      "solution": "Worked solution"
    }
  ]
}`}</pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Put year and shiftName once at the paper level. Every question must include its own subject, chapter, difficulty, and stable unique id. The number of questions must match expectedQuestionCount. Choose subjects allowed for {exam}.
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
            {isImporting ? 'Importing paper...' : `Import ${manifest?.questions?.length || 0} questions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
