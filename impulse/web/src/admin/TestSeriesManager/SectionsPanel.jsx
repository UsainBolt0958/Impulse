import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getTest } from '@/lib/portalServer';

export default function SectionsPanel({ series, test, subject, onSelectSection, onBack, onUpdateTest }) {
  const [assignedSections, setAssignedSections] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [showManualSectionForm, setShowManualSectionForm] = useState(false);
  const [manualSectionName, setManualSectionName] = useState('');
  const [manualSectionType, setManualSectionType] = useState('MCQ');
  const [manualQuestionCount, setManualQuestionCount] = useState(10);
  const [manualPosMarks, setManualPosMarks] = useState(4);
  const [manualNegMarks, setManualNegMarks] = useState(1);
  const [freshTest, setFreshTest] = useState(test);

  useEffect(() => {
    const fetchFreshTest = async () => {
      if (!test?.id) return;
      try {
        const latest = await getTest(test.id);
        setFreshTest(latest || test);
      } catch (error) {
        console.error('Failed to fetch test:', error);
        setFreshTest(test);
      }
    };

    fetchFreshTest();
  }, [test?.id]);

  useEffect(() => {
    const subjectSections = series?.sections?.filter((s) =>
      !s.subjects || s.subjects.includes(subject) || s.applicableToSubjects?.includes(subject)
    ) || [];

    const assigned = freshTest?.sections?.filter((section) => section.subject === subject) || [];
    const available = subjectSections.filter(
      (section) => !assigned.some((assignedSection) => assignedSection.sectionName === section.name)
    );

    setAssignedSections(assigned);
    setAvailableSections(available);
  }, [series, subject, freshTest]);

  const handleAddSection = async (section) => {
    const newSection = {
      id: `${freshTest.id}-${subject}-${section.name}`.replace(/\s+/g, '-').toLowerCase(),
      subject,
      sectionName: section.name,
      type: section.type,
      questionCount: section.questionCountPerSubject || 0,
      posMarks: section.posMarks ?? 4,
      negMarks: section.negMarks ?? 1,
      questions: [],
    };

    const updatedTest = {
      ...freshTest,
      sections: [...(freshTest.sections || []), newSection],
    };

    try {
      await onUpdateTest?.(updatedTest);
      setAssignedSections((current) => [...current, newSection]);
    } catch (err) {
      toast.error('Unable to add section');
    }
  };

  const handleAddManualSection = async () => {
    const title = manualSectionName.trim();
    if (!title) {
      toast.error('Section name is required');
      return;
    }

    const newSection = {
      id: `${freshTest.id}-${subject}-${title}`.replace(/\s+/g, '-').toLowerCase(),
      subject,
      sectionName: title,
      type: manualSectionType,
      questionCount: manualQuestionCount,
      posMarks: manualPosMarks,
      negMarks: manualNegMarks,
      questions: [],
    };

    const updatedTest = {
      ...freshTest,
      sections: [...(freshTest.sections || []), newSection],
    };

    try {
      await onUpdateTest?.(updatedTest);
      setAssignedSections((current) => [...current, newSection]);
      setManualSectionName('');
      setManualSectionType('MCQ');
      setManualQuestionCount(10);
      setManualPosMarks(4);
      setManualNegMarks(1);
      setShowManualSectionForm(false);
      toast.success('Section added');
    } catch (err) {
      toast.error('Unable to add section');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h2 className="text-2xl font-bold">Sections</h2>
              <p className="text-muted-foreground text-sm">{subject} • {test?.title}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowManualSectionForm((value) => !value)}>
            <Plus size={16} className="mr-2" />
            Create Section
          </Button>
        </div>

        {showManualSectionForm && (
          <Card className="border border-border bg-secondary/5 dark:bg-secondary/10 dark:border-secondary/20">
            <CardHeader>
              <CardTitle>Create Section</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Section Name</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                    value={manualSectionName}
                    onChange={(e) => setManualSectionName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={manualSectionType}
                    onChange={(e) => setManualSectionType(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                  >
                    <option>MCQ</option>
                    <option>MULTI</option>
                    <option>NUM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Questions</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                    value={manualQuestionCount}
                    onChange={(e) => setManualQuestionCount(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">+Marks</label>
                  <input
                    type="number"
                    className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                    value={manualPosMarks}
                    onChange={(e) => setManualPosMarks(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">-Marks</label>
                  <input
                    type="number"
                    className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                    value={manualNegMarks}
                    onChange={(e) => setManualNegMarks(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddManualSection}>
                  Add Section
                </Button>
                <Button variant="outline" onClick={() => setShowManualSectionForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {assignedSections.length === 0 ? (
        <div className="space-y-4">
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">No sections assigned to this subject yet.</p>
          </div>
          {availableSections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableSections.map((section, idx) => (
                <Card key={idx} className="hover:shadow-lg transition">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{section.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{section.type}</p>
                      </div>
                      <Badge>{section.questionCountPerSubject || 0} Q</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-1">
                      <div><strong>Marking:</strong> +{section.posMarks ?? 4}/{section.negMarks ?? 1}</div>
                      <div><strong>Questions:</strong> {section.questionCountPerSubject || 0}</div>
                    </div>
                    <Button onClick={() => handleAddSection(section)} className="w-full">
                      <Plus size={16} className="mr-2" />
                      Add Section
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              No section templates are available in this series for {subject}.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignedSections.map((section, idx) => (
              <Card
                key={section.id || idx}
                className="hover:shadow-lg transition cursor-pointer"
                onClick={() => onSelectSection(section)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{section.sectionName}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{section.type}</p>
                    </div>
                    <Badge>{(section.questions || []).length} Q</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1">
                    <div><strong>Marking:</strong> +{section.posMarks}/{section.negMarks}</div>
                    <div><strong>Questions:</strong> {(section.questions || []).length}</div>
                  </div>
                  <Button onClick={() => onSelectSection(section)} className="w-full">
                    Edit Questions
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {availableSections.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableSections.map((section, idx) => (
                <Card key={idx} className="hover:shadow-lg transition">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{section.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{section.type}</p>
                      </div>
                      <Badge>{section.questionCountPerSubject || 0} Q</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-1">
                      <div><strong>Marking:</strong> +{section.posMarks ?? 4}/{section.negMarks ?? 1}</div>
                      <div><strong>Questions:</strong> {section.questionCountPerSubject || 0}</div>
                    </div>
                    <Button onClick={() => handleAddSection(section)} className="w-full">
                      <Plus size={16} className="mr-2" />
                      Add Section
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
