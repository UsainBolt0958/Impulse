import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit3, Trash2, ArrowLeft, CheckCircle, Circle, Settings, Upload } from 'lucide-react';
import { getSeriesTests, createTest, deleteTest, updateTest } from '@/lib/portalServer';
import { toast } from 'sonner';
import TestImportDialog from './TestImportDialog';

const PERCENTILE_ANCHORS = [
  99.9, 99.6, 99.4, 99.2, 99, 98.5, 98, 97.5,
  97, 96.5, 96, 95.5, 95, 94.5, 94, 93.5,
  93, 92.5, 92, 91.5, 91, 90.5, 90,
];

export default function TestsPanel({ series, onSelectTest, onEditSeries, onBack }) {
  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingDuration, setEditingDuration] = useState(null);
  const [durationValue, setDurationValue] = useState('');
  const [editingPercentiles, setEditingPercentiles] = useState(null);
  const [percentileValues, setPercentileValues] = useState({});
  const [isSavingPercentiles, setIsSavingPercentiles] = useState(false);
  const [importingTest, setImportingTest] = useState(null);

  useEffect(() => {
    loadTests();
  }, [series?.id]);

  const loadTests = async () => {
    setIsLoading(true);
    try {
      const data = await getSeriesTests(series.id);
      setTests(data);
    } catch (err) {
      toast.error('Failed to load tests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTest = async () => {
    if (!newTestTitle.trim()) {
      toast.error('Test title required');
      return;
    }
    if (!series?.id) {
      toast.error('Series is not selected.');
      return;
    }

    setIsCreating(true);
    try {
      const newTest = await createTest({
        title: newTestTitle,
        seriesId: series.id,
        sections: [],
      });
      if (!newTest) {
        throw new Error('Failed to create test.');
      }
      setTests([...tests, newTest]);
      setNewTestTitle('');
      setShowCreateForm(false);
      toast.success('Test created');
      onSelectTest(newTest);
    } catch (err) {
      toast.error(err?.message || 'Failed to create test');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!window.confirm('Delete this test? This cannot be undone.')) return;

    try {
      await deleteTest(testId);
      setTests(tests.filter(t => t.id !== testId));
      toast.success('Test deleted');
    } catch (err) {
      toast.error('Failed to delete test');
    }
  };

  const handlePublishTest = async (test, e) => {
    e.stopPropagation();
    try {
      const updated = await updateTest(test.id, {
        published: !test.published,
        publish_at: !test.published ? new Date().toISOString() : null,
      });
      setTests(tests.map(t => t.id === test.id ? updated : t));
      toast.success(updated.published ? 'Test published' : 'Test unpublished');
    } catch (err) {
      toast.error('Failed to update test');
    }
  };

  const handleEditDuration = (test) => {
    setEditingDuration(test.id);
    setDurationValue(String(test.durationMinutes || ''));
  };

  const handleSaveDuration = async (testId) => {
    if (!durationValue || isNaN(parseInt(durationValue))) {
      toast.error('Enter a valid duration (minutes)');
      return;
    }
    try {
      const updated = await updateTest(testId, {
        durationMinutes: parseInt(durationValue),
      });
      setTests(tests.map(t => t.id === testId ? updated : t));
      setEditingDuration(null);
      toast.success('Duration updated');
    } catch (err) {
      toast.error('Failed to update duration');
    }
  };

  const handleEditPercentiles = (test) => {
    const savedMarks = test.percentileMarks || {};
    setEditingPercentiles(test.id);
    setPercentileValues(Object.fromEntries(
      PERCENTILE_ANCHORS.map((percentile) => [
        String(percentile),
        savedMarks[percentile] == null ? '' : String(savedMarks[percentile]),
      ])
    ));
  };

  const handleSavePercentiles = async (testId) => {
    const marks = PERCENTILE_ANCHORS
      .map((percentile) => {
        const rawValue = percentileValues[String(percentile)]?.trim();
        return rawValue === '' || rawValue == null
          ? null
          : { percentile, marks: Number(rawValue) };
      })
      .filter(Boolean);

    if (
      marks.length < 2
      || !marks.some((entry) => entry.percentile === 90)
      || marks.some((entry) => !Number.isFinite(entry.marks))
    ) {
      toast.error('Enter the score in marks for the 90th-percentile cutoff and at least one other cutoff.');
      return;
    }

    if (marks.some((entry, index) => index > 0 && marks[index - 1].marks <= entry.marks)) {
      toast.error('Marks must decrease as the percentile cutoffs decrease.');
      return;
    }

    setIsSavingPercentiles(true);
    try {
      const percentileMarks = Object.fromEntries(
        marks.map(({ percentile, marks: score }) => [String(percentile), score])
      );
      const updated = await updateTest(testId, { percentileMarks });
      setTests((currentTests) => currentTests.map((test) => (
        test.id === testId ? updated : test
      )));
      setEditingPercentiles(null);
      toast.success('Percentile marks saved');
    } catch (err) {
      toast.error('Failed to save percentile marks');
    } finally {
      setIsSavingPercentiles(false);
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
            <h2 className="text-2xl font-bold">Tests</h2>
            <p className="text-muted-foreground text-sm">{series?.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEditSeries ? (
            <Button variant="outline" size="sm" onClick={() => onEditSeries(series)}>
              <Edit3 size={16} className="mr-2" />
              Edit Series
            </Button>
          ) : null}
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus size={20} className="mr-2" />
            New Test
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <Card className="border border-border bg-secondary/5 dark:bg-secondary/10 dark:border-secondary/20">
          <CardHeader>
            <CardTitle>Create New Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Test Name *</label>
              <Input
                placeholder="e.g., Full Length Test 1"
                value={newTestTitle}
                onChange={(e) => setNewTestTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateTest()}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateTest}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading tests...</div>
      ) : tests.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No tests yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tests.map((test) => {
            const totalQuestions = (test.sections || []).reduce((count, section) => {
              const sectionQuestions = Array.isArray(section.questions) ? section.questions : [];
              return count + sectionQuestions.length;
            }, 0);
            const displayDuration = test.durationMinutes || series?.durationMinutes || '';

            return (
            <Card
              key={test.id}
              className="hover:shadow-lg transition cursor-pointer"
              onClick={() => onSelectTest(test)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">{test.title}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">{test.id}</p>
                  </div>
                  <Badge variant={test.published ? 'default' : 'secondary'}>
                    {test.published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {test.sections?.length || 0} sections • {totalQuestions} questions
                </div>
                <div className="text-sm text-muted-foreground">
                  {editingDuration === test.id ? (
                    <div
                      className="flex gap-2 items-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Input
                        type="number"
                        min="1"
                        value={durationValue}
                        onChange={(e) => setDurationValue(e.target.value)}
                        placeholder="Duration (min)"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveDuration(test.id);
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDuration(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>Duration: {displayDuration} mins</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Edit duration"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDuration(test);
                        }}
                      >
                        <Settings size={14} />
                      </Button>
                    </div>
                  )}
                </div>
                {editingPercentiles === test.id ? (
                  <div
                    className="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div>
                      <div className="font-semibold text-foreground">Score-to-percentile cutoffs</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enter the test score in marks that corresponds to each percentile, not a percentage of total marks. The 90th-percentile score and at least one other cutoff are required.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PERCENTILE_ANCHORS.map((percentile) => (
                        <label key={percentile} className="space-y-1 text-xs font-medium text-muted-foreground">
                          <span>{percentile}%ile</span>
                          <Input
                            type="number"
                            step="any"
                            value={percentileValues[String(percentile)] ?? ''}
                            onChange={(event) => setPercentileValues((current) => ({
                              ...current,
                              [String(percentile)]: event.target.value,
                            }))}
                            placeholder="Marks"
                            aria-label={`${percentile} percentile marks`}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={isSavingPercentiles}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSavePercentiles(test.id);
                        }}
                      >
                        {isSavingPercentiles ? 'Saving...' : 'Save cutoffs'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingPercentiles(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEditPercentiles(test);
                    }}
                  >
                    <Settings size={14} className="mr-2" />
                    Set percentile marks
                  </Button>
                )}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={Boolean(test.published)}
                    title={test.published ? 'Create an unpublished test before importing' : 'Import question data'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setImportingTest(test);
                    }}
                  >
                    <Upload size={16} className="mr-1" />
                    Import JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTest(test);
                    }}
                  >
                    <Edit3 size={16} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={test.published ? 'default' : 'outline'}
                    onClick={(e) => handlePublishTest(test, e)}
                    title={test.published ? 'Unpublish test' : 'Publish test'}
                  >
                    {test.published ? (
                      <CheckCircle size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTest(test.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {importingTest ? (
        <TestImportDialog
          test={importingTest}
          onClose={() => setImportingTest(null)}
          onImported={(updatedTest) => {
            setTests((currentTests) => currentTests.map((test) => (
              test.id === updatedTest.id ? updatedTest : test
            )));
            toast.success('Questions imported as a draft');
          }}
        />
      ) : null}
    </div>
  );
}
