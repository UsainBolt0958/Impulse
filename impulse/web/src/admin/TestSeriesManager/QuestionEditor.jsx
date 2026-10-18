import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import ImageUploadField from './ImageUploadField';
import { toast } from 'sonner';

export default function QuestionEditor({ question, section, subject, onBack, onSave }) {
  const [formData, setFormData] = useState({
    id: question?.id || null,
    sourceId: question?.sourceId || '',
    sourceNumber: question?.sourceNumber || '',
    text: question?.text || '',
    imageUrl: question?.imageUrl || '',
    type: section?.type || 'MCQ',
    options: question?.options || [
      { text: '', imageUrl: '', key: 'A' },
      { text: '', imageUrl: '', key: 'B' },
      { text: '', imageUrl: '', key: 'C' },
      { text: '', imageUrl: '', key: 'D' },
    ],
    answer: question?.answer ?? '',
    solution: question?.solution || question?.explanation || '',
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveQuestion = async () => {
    if (!formData.text.trim() && !formData.imageUrl) {
      toast.error('Question text or image required');
      return;
    }

    if (formData.type === 'MCQ' || formData.type === 'MULTI') {
      if (!formData.options.some(o => o.text?.trim() || o.imageUrl)) {
        toast.error('Add at least one option');
        return;
      }
      if (!formData.answer) {
        toast.error('Select correct answer');
        return;
      }
    }
    if (formData.type === 'NUM') {
      if (formData.answer && typeof formData.answer === 'object') {
        const { min, max } = formData.answer;
        if (
          String(min).trim() === ''
          || String(max).trim() === ''
          || !Number.isFinite(Number(min))
          || !Number.isFinite(Number(max))
          || Number(min) > Number(max)
        ) {
          toast.error('Enter a valid numeric range with minimum no greater than maximum');
          return;
        }
      } else if (
        String(formData.answer).trim() === ''
        || !Number.isFinite(Number(formData.answer))
      ) {
        toast.error('Enter a valid numeric answer');
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave?.({ ...formData, id: formData.id || question?.id });
      toast.success('Question saved');
      onBack?.();
    } catch (err) {
      toast.error('Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Edit Question</h2>
          <p className="text-gray-600 text-sm">
            {subject} • Section {section?.sectionName || section?.name}
          </p>
          {formData.sourceId ? (
            <p className="text-xs text-muted-foreground">
              Imported ID: {formData.sourceId}
              {formData.sourceNumber ? ` · Source question ${formData.sourceNumber}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      {/* Question Text */}
      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Question Text *</label>
            <Textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Enter question text..."
              rows={4}
            />
          </div>

          <ImageUploadField
            label="Question Image"
            currentImageUrl={formData.imageUrl}
            onUpload={(url) => setFormData({ ...formData, imageUrl: url })}
            onDelete={() => setFormData({ ...formData, imageUrl: '' })}
          />
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle>Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.options.map((option, idx) => (
            <div key={idx} className="border-l-4 border-blue-300 pl-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Option {option.key}
                  {formData.type === 'MCQ' && (
                    <input
                      type="radio"
                      name="answer"
                      value={option.key}
                      checked={formData.answer === option.key}
                      onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                      className="ml-2"
                    />
                  )}
                  {formData.type === 'MULTI' && (
                    <input
                      type="checkbox"
                      checked={formData.answer?.includes(option.key)}
                      onChange={(e) => {
                        const answer = formData.answer || '';
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            answer: (answer + option.key).split('').sort().join(''),
                          });
                        } else {
                          setFormData({
                            ...formData,
                            answer: answer.replace(option.key, ''),
                          });
                        }
                      }}
                      className="ml-2"
                    />
                  )}
                </label>
              </div>

              <Textarea
                value={option.text}
                onChange={(e) => {
                  const newOptions = [...formData.options];
                  newOptions[idx].text = e.target.value;
                  setFormData({ ...formData, options: newOptions });
                }}
                placeholder={`Option ${option.key} text...`}
                rows={2}
              />

              <div className="mt-2">
                <ImageUploadField
                  label={`Option ${option.key} Image`}
                  currentImageUrl={option.imageUrl}
                  onUpload={(url) => {
                    const newOptions = [...formData.options];
                    newOptions[idx].imageUrl = url;
                    setFormData({ ...formData, options: newOptions });
                  }}
                  onDelete={() => {
                    const newOptions = [...formData.options];
                    newOptions[idx].imageUrl = '';
                    setFormData({ ...formData, options: newOptions });
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Answer for NUM type */}
      {formData.type === 'NUM' && (
        <Card>
          <CardHeader>
            <CardTitle>Correct Answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Answer (or range)</label>
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(formData.answer && typeof formData.answer === 'object')}
                  onChange={(event) => setFormData({
                    ...formData,
                    answer: event.target.checked ? { min: '', max: '', allowSign: false } : '',
                  })}
                />
                Accept a range of numeric answers
              </label>
              {formData.answer && typeof formData.answer === 'object' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-sm">
                      Minimum (inclusive)
                      <Input
                        type="number"
                        step="any"
                        value={formData.answer.min}
                        onChange={(e) => setFormData({
                          ...formData,
                          answer: { ...formData.answer, min: e.target.value },
                        })}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      Maximum (inclusive)
                      <Input
                        type="number"
                        step="any"
                        value={formData.answer.max}
                        onChange={(e) => setFormData({
                          ...formData,
                          answer: { ...formData.answer, max: e.target.value },
                        })}
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.answer.allowSign)}
                      onChange={(e) => setFormData({
                        ...formData,
                        answer: { ...formData.answer, allowSign: e.target.checked },
                      })}
                    />
                    Match absolute value (allow either sign)
                  </label>
                </div>
              ) : (
                <Input
                  type="number"
                  step="any"
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  placeholder="e.g., 5, 5.5, or -2.5"
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Solution / Explanation</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.solution}
            onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
            placeholder="Enter the worked solution or explanation..."
            rows={6}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Markdown and LaTeX math are supported by the exam review display.
          </p>
        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button onClick={handleSaveQuestion} disabled={isSaving} size="lg">
          <Save size={20} className="mr-2" />
          {isSaving ? 'Saving...' : 'Save Question'}
        </Button>
        <Button variant="outline" onClick={onBack} size="lg">
          Cancel
        </Button>
      </div>
    </div>
  );
}
