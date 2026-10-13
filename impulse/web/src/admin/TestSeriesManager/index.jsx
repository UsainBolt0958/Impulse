import React, { useState } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { getTest, updateTest } from '@/lib/portalServer';
import SeriesDashboard from './SeriesDashboard';
import SeriesEditor from './SeriesEditor';
import TestsPanel from './TestsPanel';
import SubjectsPanel from './SubjectsPanel';
import SectionsPanel from './SectionsPanel';
import QuestionsPanel from './QuestionsPanel';
import QuestionEditor from './QuestionEditor';

const LEVELS = {
  DASHBOARD: 'dashboard',
  SERIES_EDITOR: 'series_editor',
  TESTS: 'tests',
  SUBJECTS: 'subjects',
  SECTIONS: 'sections',
  QUESTIONS: 'questions',
  QUESTION_EDITOR: 'question_editor',
};

export default function TestSeriesManager() {
  const [workspace, setWorkspace] = useState([
    { level: LEVELS.DASHBOARD, data: {} },
  ]);

  const currentLevel = workspace[workspace.length - 1];

  const pushLevel = (level, data = {}) => {
    setWorkspace([...workspace, { level, data }]);
  };

  const popLevel = () => {
    if (workspace.length > 1) {
      setWorkspace(workspace.slice(0, -1));
    }
  };

  const goBack = () => {
    popLevel();
  };

  const resetToDashboard = () => {
    setWorkspace([{ level: LEVELS.DASHBOARD, data: {} }]);
  };

  const updateTestInWorkspace = async (updatedTest) => {
    try {
      const savedTest = await updateTest(updatedTest.id, updatedTest);
      setWorkspace((current) =>
        current.map((w) => {
          if (w.data?.test?.id === updatedTest.id) {
            return { ...w, data: { ...w.data, test: savedTest || updatedTest } };
          }
          return w;
        })
      );
    } catch (err) {
      console.error('Failed to save test update', err);
    }
  };

  const getSectionIdentity = (sectionItem, fallbackSubject) => {
    const sectionSubject = sectionItem?.subject || fallbackSubject || 'unknown';
    const sectionId = sectionItem?.id || `${sectionSubject}::${sectionItem?.sectionName || sectionItem?.name || 'untitled'}`;
    return `${sectionSubject}::${sectionId}`;
  };

  const resolveSectionMatch = (sectionItem, targetSection, targetSubject) => {
    if (!sectionItem) return false;

    const targetId = targetSection?.id || null;
    const targetName = targetSection?.sectionName || targetSection?.name || null;
    const targetSubjectValue = targetSubject || targetSection?.subject || sectionItem?.subject || null;

    const sameId = Boolean(targetId) && sectionItem.id === targetId;
    const sameName = Boolean(targetName) &&
      (sectionItem.sectionName === targetName || sectionItem.name === targetName);
    const sameSubject = !targetSubjectValue || sectionItem.subject === targetSubjectValue;

    return (sameId || sameName) && sameSubject;
  };

  const saveQuestionInTest = async (question) => {
    const currentEntry = workspace[workspace.length - 1];
    const currentTest = currentEntry?.data?.test;
    const currentSubject = currentEntry?.data?.subject || question.subject;
    const currentSection = currentEntry?.data?.section || null;

    if (!currentTest) {
      throw new Error('No test is currently selected.');
    }

    const latestTest = await getTest(currentTest.id) || currentTest;
    const targetSection = currentSection || {
      id: question.section,
      sectionName: question.section,
      name: question.section,
      subject: currentSubject,
    };

    const targetSubject = question.subject || currentSubject;
    const normalizedQuestion = {
      ...question,
      id: question.id || `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subject: targetSubject,
      section: question.section || targetSection.id || targetSection.sectionName || targetSection.name,
    };

    const sectionIndex = (latestTest.sections || []).findIndex((sectionItem) =>
      resolveSectionMatch(sectionItem, targetSection, targetSubject)
    );

    if (sectionIndex === -1) {
      throw new Error('The selected question section could not be found in this test.');
    }

    const nextSections = [...(latestTest.sections || [])];
    const targetSectionItem = nextSections[sectionIndex];
    const existingQuestions = Array.isArray(targetSectionItem.questions) ? targetSectionItem.questions : [];

    const updatedQuestions = existingQuestions.some((q) => q.id && q.id === normalizedQuestion.id)
      ? existingQuestions.map((q) => (q.id === normalizedQuestion.id ? normalizedQuestion : q))
      : [...existingQuestions, normalizedQuestion];

    nextSections[sectionIndex] = {
      ...targetSectionItem,
      questions: updatedQuestions,
    };

    const updatedTest = { ...latestTest, sections: nextSections };
    await updateTestInWorkspace(updatedTest);
  };

  const deleteQuestionInTest = async (questionToDelete) => {
    const currentEntry = workspace[workspace.length - 1];
    const currentTest = currentEntry?.data?.test;
    const currentSubject = currentEntry?.data?.subject || questionToDelete?.subject;
    const currentSection = currentEntry?.data?.section || null;

    if (!currentTest || !questionToDelete?.id) {
      throw new Error('No question selected for deletion.');
    }

    const latestTest = await getTest(currentTest.id) || currentTest;
    const targetSection = currentSection || {
      id: questionToDelete.section,
      sectionName: questionToDelete.section,
      name: questionToDelete.section,
      subject: currentSubject,
    };

    const targetSubject = questionToDelete.subject || currentSubject;
    const sectionIndex = (latestTest.sections || []).findIndex((sectionItem) =>
      resolveSectionMatch(sectionItem, targetSection, targetSubject)
    );

    if (sectionIndex === -1) {
      throw new Error('The selected question section could not be found in this test.');
    }

    const nextSections = [...(latestTest.sections || [])];
    nextSections[sectionIndex] = {
      ...nextSections[sectionIndex],
      questions: (nextSections[sectionIndex].questions || []).filter((q) => q.id !== questionToDelete.id),
    };

    const updatedTest = { ...latestTest, sections: nextSections };
    await updateTestInWorkspace(updatedTest);
  };

  const getBreadcrumb = () => {
    const crumbs = workspace.map((w) => {
      switch (w.level) {
        case LEVELS.DASHBOARD:
          return 'Series';
        case LEVELS.SERIES_EDITOR:
          return w.data?.series?.title || 'Edit Series';
        case LEVELS.TESTS:
          return 'Tests';
        case LEVELS.SUBJECTS:
          return 'Subjects';
        case LEVELS.SECTIONS:
          return `${w.data?.subject} Sections`;
        case LEVELS.QUESTIONS:
          return 'Questions';
        case LEVELS.QUESTION_EDITOR:
          return 'Edit Question';
        default:
          return 'Unknown';
      }
    });
    return crumbs;
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          {getBreadcrumb().map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem
                onClick={() => {
                  if (idx < workspace.length - 1) {
                    setWorkspace(workspace.slice(0, idx + 1));
                  }
                }}
                className={idx < workspace.length - 1 ? 'cursor-pointer hover:text-blue-600' : ''}
              >
                {crumb}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Current Level Component */}
      <div>
        {currentLevel.level === LEVELS.DASHBOARD && (
          <SeriesDashboard
            onSelectSeries={(series) =>
              pushLevel(LEVELS.TESTS, { series })
            }
            onEditSeries={(series) =>
              pushLevel(LEVELS.SERIES_EDITOR, { series })
            }
            onBack={resetToDashboard}
          />
        )}

        {currentLevel.level === LEVELS.SERIES_EDITOR && (
          <SeriesEditor
            series={currentLevel.data.series}
            onBack={goBack}
            onTestsClick={() =>
              pushLevel(LEVELS.TESTS, { series: currentLevel.data.series })
            }
            onSave={(updatedSeries) => {
              setWorkspace(
                workspace.map((w, i) =>
                  i === workspace.length - 1
                    ? { ...w, data: { series: updatedSeries } }
                    : w
                )
              );
            }}
          />
        )}

        {currentLevel.level === LEVELS.TESTS && (
          <TestsPanel
            series={currentLevel.data.series}
            onSelectTest={(test) =>
              pushLevel(LEVELS.SUBJECTS, {
                series: currentLevel.data.series,
                test,
              })
            }
            onEditSeries={(series) =>
              pushLevel(LEVELS.SERIES_EDITOR, { series })
            }
            onBack={goBack}
          />
        )}

        {currentLevel.level === LEVELS.SUBJECTS && (
          <SubjectsPanel
            series={currentLevel.data.series}
            test={currentLevel.data.test}
            onUpdateTest={updateTestInWorkspace}
            onSelectSubject={(subject) =>
              pushLevel(LEVELS.SECTIONS, {
                series: currentLevel.data.series,
                test: currentLevel.data.test,
                subject,
              })
            }
            onBack={goBack}
          />
        )}

        {currentLevel.level === LEVELS.SECTIONS && (
          <SectionsPanel
            series={currentLevel.data.series}
            test={currentLevel.data.test}
            subject={currentLevel.data.subject}
            onUpdateTest={updateTestInWorkspace}
            onSelectSection={(section) =>
              pushLevel(LEVELS.QUESTIONS, {
                series: currentLevel.data.series,
                test: currentLevel.data.test,
                subject: currentLevel.data.subject,
                section,
              })
            }
            onBack={goBack}
          />
        )}

        {currentLevel.level === LEVELS.QUESTIONS && (
          <QuestionsPanel
            test={currentLevel.data.test}
            subject={currentLevel.data.subject}
            section={currentLevel.data.section}
            onSelectQuestion={(question) =>
              pushLevel(LEVELS.QUESTION_EDITOR, {
                series: currentLevel.data.series,
                test: currentLevel.data.test,
                subject: currentLevel.data.subject,
                section: currentLevel.data.section,
                question,
              })
            }
            onDeleteQuestion={deleteQuestionInTest}
            onBack={goBack}
          />
        )}

        {currentLevel.level === LEVELS.QUESTION_EDITOR && (
          <QuestionEditor
            question={currentLevel.data.question}
            section={currentLevel.data.section}
            subject={currentLevel.data.subject}
            onBack={goBack}
            onSave={async (savedQuestion) => {
              await saveQuestionInTest({
                ...savedQuestion,
                section: currentLevel.data.section?.id || currentLevel.data.section?.name,
                subject: currentLevel.data.subject,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
