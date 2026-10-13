import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, ArrowLeft, BookOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SubjectsPanel({ series, test, onSelectSubject, onBack, onUpdateTest }) {
  const [testSubjects, setTestSubjects] = useState(
    test?.subjects?.length ? test.subjects : series?.subjects || []
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTestSubjects(
      test?.subjects?.length ? test.subjects : series?.subjects || []
    );
  }, [test, series]);

  const handleAddSubject = async () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    if (testSubjects.includes(trimmed)) return;
    if (!onUpdateTest) {
      toast.error('Unable to save subject.');
      return;
    }

    const updatedSubjects = [...testSubjects, trimmed];
    const updatedTest = { ...test, subjects: updatedSubjects };

    setIsSaving(true);
    try {
      await onUpdateTest(updatedTest);
      setTestSubjects(updatedSubjects);
      setNewSubject('');
      setShowCreateForm(false);
      toast.success('Subject added');
    } catch (err) {
      toast.error(err?.message || 'Failed to save subject');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubject = async (subjectToDelete) => {
    if (!subjectToDelete || !onUpdateTest) {
      toast.error('Unable to remove subject.');
      return;
    }

    const updatedSubjects = testSubjects.filter((subject) => subject !== subjectToDelete);
    const updatedTest = { ...test, subjects: updatedSubjects };

    setIsSaving(true);
    try {
      await onUpdateTest(updatedTest);
      setTestSubjects(updatedSubjects);
      toast.success('Subject removed');
    } catch (err) {
      toast.error(err?.message || 'Failed to remove subject');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Subjects</h2>
            <p className="text-muted-foreground text-sm">{test?.title}</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus size={16} className="mr-2" />
          Add Subject
        </Button>
      </div>

      {showCreateForm && (
        <Card className="border border-border bg-secondary/5 dark:bg-secondary/10 dark:border-secondary/20">
          <CardHeader>
            <CardTitle>Add New Subject</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="subject-name" className="block text-sm font-medium mb-1">Subject Name</label>
              <Input
                id="subject-name"
                type="text"
                placeholder="e.g. Physics"
                className="w-full rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddSubject} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {testSubjects.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/60 mb-2" />
          <p className="text-muted-foreground">No subjects in this test yet. Add one to continue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testSubjects.map((subject, idx) => (
            <Card
              key={idx}
              className="hover:shadow-lg transition cursor-pointer"
              onClick={() => onSelectSubject(subject)}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="truncate">{subject}</CardTitle>
                  <Badge variant="outline">Manage</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => onSelectSubject(subject)}
                  className="w-full"
                >
                  Manage Sections
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      disabled={isSaving}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 size={14} className="mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete subject?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove {subject} from this test. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSubject(subject);
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
