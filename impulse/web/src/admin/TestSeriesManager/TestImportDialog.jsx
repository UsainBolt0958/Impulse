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
import { updateTest, uploadImage } from '@/lib/portalServer';
import {
  buildImportedSections,
  getSupportedImageExtension,
  parseTestImport,
  validateTestImport,
} from './testImportFormat';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function TestImportDialog({ test, onClose, onImported }) {
  const [manifest, setManifest] = useState(null);
  const [manifestName, setManifestName] = useState('');
  const [images, setImages] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const validation = useMemo(
    () => validateTestImport(manifest, images),
    [manifest, images]
  );
  const existingQuestionCount = (test?.sections || []).reduce(
    (total, section) => total + (section.questions || []).length,
    0
  );

  const handleManifestSelect = async (event) => {
    const file = event.target.files?.[0];
    setManifest(null);
    setManifestName('');
    setParseError('');
    if (!file) return;

    try {
      const parsed = parseTestImport(await file.text());
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('The JSON file must contain a manifest object.');
      }
      setManifest(parsed);
      setManifestName(file.name);
    } catch (error) {
      setParseError(error.message);
    }
  };

  const handleImagesSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const invalidFile = files.find((file) => (
      !getSupportedImageExtension(file.name) || file.size > MAX_IMAGE_BYTES
    ));
    if (invalidFile) {
      setImages([]);
      setParseError(
        !getSupportedImageExtension(invalidFile.name)
          ? `${invalidFile.name} is not a supported image. Choose SVG, PNG, JPG, or WEBP files.`
          : `${invalidFile.name} exceeds the 5 MB per-image limit.`
      );
      return;
    }
    setParseError('');
    setImages(files);
  };

  const handleImport = async () => {
    if (!manifest || validation.errors.length > 0 || !test?.id) return;
    if (existingQuestionCount > 0 && !window.confirm(
      `This will replace all ${existingQuestionCount} existing questions and sections in "${test.title}". Continue?`
    )) {
      return;
    }

    setIsImporting(true);
    try {
      const referencedNames = new Set();
      manifest.subjects.forEach((subject) => subject.sections.forEach((section) => {
        section.questions.forEach((question) => {
          if (question.image) referencedNames.add(question.image.toLowerCase());
          (question.options || []).forEach((option) => {
            if (option.image) referencedNames.add(option.image.toLowerCase());
          });
        });
      }));

      const imageFilesByName = new Map(images.map((file) => [file.name.toLowerCase(), file]));
      const imageUrls = {};
      for (const normalizedName of referencedNames) {
        const file = imageFilesByName.get(normalizedName);
        if (!file) throw new Error(`Referenced image "${normalizedName}" was not selected.`);
        const uploaded = await uploadImage(file);
        if (!uploaded?.url) throw new Error(`Upload failed for "${file.name}".`);
        imageUrls[normalizedName] = uploaded.url;
      }

      const updated = await updateTest(test.id, {
        title: manifest.test.title.trim(),
        durationMinutes: manifest.test.durationMinutes,
        subjects: manifest.subjects.map((subject) => subject.name.trim()),
        sections: buildImportedSections(manifest, test.id, imageUrls),
        published: false,
        publish_at: null,
      });
      if (!updated) throw new Error('The imported test could not be saved.');
      onImported(updated);
      onClose();
    } catch (error) {
      setParseError(error.message || 'Import failed. No test changes were saved.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isImporting && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import questions into {test?.title}</DialogTitle>
          <DialogDescription>
            Select a schema-version-1 JSON manifest and its referenced image files.
            The import is validated and saved as an unpublished draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1 text-sm font-medium">
            Test JSON manifest
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleManifestSelect}
              disabled={isImporting}
              className="block w-full rounded-md border border-input bg-background p-2 text-sm"
            />
          </label>
          {manifestName ? <p className="text-xs text-muted-foreground">{manifestName}</p> : null}

          <label className="block space-y-1 text-sm font-medium">
            Question and option images (SVG, PNG, JPG, or WEBP; max 5 MB each)
            <input
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
              multiple
              onChange={handleImagesSelect}
              disabled={isImporting}
              className="block w-full rounded-md border border-input bg-background p-2 text-sm"
            />
          </label>
          {images.length > 0 ? (
            <p className="text-xs text-muted-foreground">{images.length} image file(s) selected.</p>
          ) : null}

          {parseError ? (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{parseError}</span>
            </div>
          ) : null}

          {manifest ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <h3 className="font-semibold">{manifest.test?.title || 'Untitled import'}</h3>
                <p className="text-sm text-muted-foreground">
                  {manifest.test?.durationMinutes ?? '?'} minutes · {manifest.test?.expectedQuestionCount ?? '?'} declared questions
                </p>
              </div>

              {validation.errors.length > 0 ? (
                <div role="alert" className="space-y-1 text-sm text-destructive">
                  <p className="font-semibold">Fix these errors before importing:</p>
                  {validation.errors.map((error) => <p key={error}>• {error}</p>)}
                </div>
              ) : (
                <p className="text-sm font-medium text-green-700">
                  Manifest is valid. The test will be saved as a draft.
                </p>
              )}

              {validation.warnings.length > 0 ? (
                <div className="space-y-1 text-sm text-amber-700">
                  <p className="font-semibold">Review these warnings:</p>
                  {validation.warnings.map((warning) => <p key={warning}>• {warning}</p>)}
                </div>
              ) : null}

              <div className="max-h-72 space-y-3 overflow-y-auto">
                {(manifest.subjects || []).map((subject, subjectIndex) => (
                  <section key={`${subject.name || 'subject'}-${subjectIndex}`} className="space-y-2">
                    <h4 className="font-medium">{subject.name || 'Unnamed subject'}</h4>
                    {(subject.sections || []).map((section, sectionIndex) => (
                      <div key={`${section.name || 'section'}-${sectionIndex}`} className="rounded-md bg-muted/50 p-3">
                        <p className="text-sm font-semibold">
                          {section.name || 'Unnamed section'} · {section.type || 'Unknown type'} · {section.questions?.length || 0}/{section.expectedQuestionCount ?? '?'} questions
                        </p>
                        {section.marking ? (
                          <p className="text-xs text-muted-foreground">
                            Marking: correct {section.marking.correct}, wrong {section.marking.wrong}, unanswered {section.marking.unanswered}
                          </p>
                        ) : null}
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                          {(section.questions || []).map((question, questionIndex) => (
                            <li key={`${question.id || 'question'}-${questionIndex}`}>
                              <span className="font-medium">{question.id || 'No ID'}</span>
                              {question.number != null ? ` (source #${question.number})` : ''}
                              {question.text ? ` — ${question.text}` : ''}
                              {question.answer != null ? ` · Answer: ${Array.isArray(question.answer) ? question.answer.join(', ') : JSON.stringify(question.answer)}` : ''}
                              {question.image ? ` · Image: ${question.image}` : ''}
                              {question.solution ? <p className="mt-1 text-muted-foreground">Solution: {question.solution}</p> : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          ) : null}

          {test?.published ? (
            <p role="alert" className="text-sm text-destructive">
              Published tests cannot be overwritten by an import. Create an unpublished test first.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isImporting}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={
              isImporting
              || !manifest
              || validation.errors.length > 0
              || Boolean(test?.published)
              || Boolean(parseError)
            }
          >
            <Upload size={16} className="mr-2" />
            {isImporting ? 'Uploading and saving…' : 'Import as draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
