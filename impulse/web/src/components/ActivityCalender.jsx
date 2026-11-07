import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { useAttemptQuestionMetadata } from '@/hooks/useAttemptQuestionMetadata';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

function toDateKey(date) {
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUniqueQuestionCount(entries) {
  return new Set(entries.map(entry => entry.question_id).filter(Boolean)).size;
}

function getEntryExam(entry, question) {
  if (String(entry.attempt_id || '').startsWith('custom-test:')) return 'Custom Test';
  return entry.exam || question?.exam || 'Unknown';
}

function ActivityCalendar({ compact = false }) {
  const { solvedQuestions } = useSolvedQuestions();
  const questionMetadata = useAttemptQuestionMetadata(solvedQuestions);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedExam, setSelectedExam] = useState('');

  const monthLabel = currentMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const key = toDateKey(date);
      const entries = solvedQuestions.filter(sq => {
        const sqDate = toDateKey(new Date(sq.timestamp));
        return sqDate === key;
      });
      cells.push({ key, day, entries, questionCount: getUniqueQuestionCount(entries) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth, solvedQuestions]);

  const selectedEntries = useMemo(() => {
    if (!selectedDate) return [];
    return solvedQuestions.filter(sq => toDateKey(new Date(sq.timestamp)) === selectedDate);
  }, [selectedDate, solvedQuestions]);

  const examBreakdown = useMemo(() => {
    const questionIdsByExam = {};

    selectedEntries.forEach(entry => {
      const question = questionMetadata[String(entry.question_id)] || {};
      const exam = getEntryExam(entry, question);
      if (!questionIdsByExam[exam]) questionIdsByExam[exam] = new Set();
      questionIdsByExam[exam].add(entry.question_id);
    });

    return Object.entries(questionIdsByExam)
      .map(([exam, questionIds]) => ({ exam, count: questionIds.size }))
      .sort((a, b) => b.count - a.count || a.exam.localeCompare(b.exam));
  }, [selectedEntries, questionMetadata]);

  const selectedExamEntries = useMemo(() => {
    if (!selectedExam) return selectedEntries;

    return selectedEntries.filter(entry => {
      const question = questionMetadata[String(entry.question_id)] || {};
      return getEntryExam(entry, question) === selectedExam;
    });
  }, [selectedEntries, questionMetadata, selectedExam]);

  const subjectDistribution = useMemo(() => {
    const questionIdsBySubject = {};

    selectedExamEntries.forEach(entry => {
      const question = questionMetadata[String(entry.question_id)] || {};
      const subject = entry.subject || question.subject || 'Unknown';
      if (!questionIdsBySubject[subject]) questionIdsBySubject[subject] = new Set();
      questionIdsBySubject[subject].add(entry.question_id);
    });

    return Object.entries(questionIdsBySubject)
      .map(([subject, questionIds]) => ({ subject, count: questionIds.size }))
      .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
  }, [selectedExamEntries, questionMetadata]);

  const examDistribution = examBreakdown;

  const chartPalette = ['#111827', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#eab308'];

  const chartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
        <div className="text-sm font-semibold text-foreground">{item.name}</div>
        <div className="text-xs text-muted-foreground">{item.value} unique questions attempted</div>
      </div>
    );
  };

  const subjectChartData = subjectDistribution.map(item => ({ name: item.subject, value: item.count }));
  const examChartData = examDistribution.map(item => ({ name: item.exam, value: item.count }));

  const selectedStats = useMemo(() => {
    const questionIds = new Set(selectedEntries.map(entry => entry.question_id).filter(Boolean));
    const correctQuestionIds = new Set(
      selectedEntries
        .filter(entry => entry.is_correct && entry.question_id)
        .map(entry => entry.question_id)
    );
    const total = questionIds.size;
    const correct = correctQuestionIds.size;
    const accuracy = total ? ((correct / total) * 100).toFixed(1) : '0.0';
    return { total, correct, accuracy };
  }, [selectedEntries]);

  React.useEffect(() => {
    if (selectedDate) {
      setSelectedExam(examBreakdown[0]?.exam || '');
    } else {
      setSelectedExam('');
    }
  }, [selectedDate, examBreakdown]);

  const prevMonth = () => setCurrentMonth(curr => new Date(curr.getFullYear(), curr.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(curr => new Date(curr.getFullYear(), curr.getMonth() + 1, 1));

  const getDayTone = (entryCount) => {
    if (!entryCount) return 'bg-card border-foreground/30 dark:border-border text-muted-foreground';
    if (entryCount <= 1) return 'bg-secondary border-foreground/30 dark:border-border text-foreground';
    if (entryCount <= 3) return 'bg-muted border-foreground text-foreground';
    if (entryCount <= 6) return 'bg-foreground text-background border-foreground';
    return 'bg-foreground text-background border-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.12)]';
  };

  const selectedTone = (() => {
    const total = selectedStats.total;
    if (!total) return 'from-card via-card to-card border-border';
    if (total <= 1) return 'from-card via-secondary to-card border-border';
    if (total <= 3) return 'from-secondary via-card to-secondary border-foreground/20';
    if (total <= 6) return 'from-foreground via-card to-foreground border-foreground';
    return 'from-foreground via-muted to-foreground border-foreground';
  })();

  return (
    <div className={compact ? 'relative w-full' : 'relative'}>
      <Card className={`overflow-hidden border-2 border-foreground/30 dark:border-border bg-background shadow ${compact ? 'rounded-[24px]' : ''}`}>
        <CardContent className={`relative ${compact ? 'p-2.5 sm:p-3' : 'p-4 sm:p-6'}`}>
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.4) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />

          <div className={`relative z-10 ${compact ? 'mb-2.5' : 'flex items-center justify-between gap-3 mb-5'}`}>
            <div className={`flex items-center gap-2 ${compact ? 'justify-between w-full' : ''}`}>
              <button
                onClick={prevMonth}
                className={`rounded-lg border border-foreground/30 dark:border-border bg-card text-foreground hover:bg-secondary hover:border-foreground transition-all duration-200 flex items-center justify-center ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
                aria-label="Previous month"
              >
                ‹
              </button>
              <div className={`${compact ? 'flex-1 text-center' : 'min-w-44 text-center'}`}>
                <div className={`${compact ? 'text-base sm:text-lg' : 'text-2xl sm:text-[34px]'} font-black tracking-tight text-foreground`}>{monthLabel}</div>
              </div>
              <button
                onClick={nextMonth}
                className={`rounded-lg border border-foreground/30 dark:border-border bg-card text-foreground hover:bg-secondary hover:border-foreground transition-all duration-200 flex items-center justify-center ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>

          <p className={`relative z-10 mb-3 text-center text-muted-foreground ${compact ? 'text-[9px] sm:text-[10px]' : 'text-xs'}`}>
            Daily totals count unique questions per day. Reattempts on another day appear in both daily totals but count once on the dashboard.
          </p>

          <div className={`relative z-10 grid grid-cols-7 ${compact ? 'gap-1 mb-1 text-[9px]' : 'gap-2 sm:gap-3 mb-2 text-[11px] sm:text-xs'} font-semibold uppercase tracking-[0.18em] text-muted-foreground`}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className={`px-1 py-1 text-center ${compact ? 'text-[10px]' : ''}`}>{compact ? day[0] : day}</div>
            ))}
          </div>

          <div className={`relative z-10 grid grid-cols-7 ${compact ? 'gap-1' : 'gap-2 sm:gap-3'}`}>
            {monthDays.map((cell, index) => {
              if (!cell) {
                return <div key={`empty-${index}`} className={`rounded-2xl border border-foreground/30 dark:border-border bg-card ${compact ? 'min-h-[46px] sm:min-h-[52px]' : 'min-h-[78px] sm:min-h-[96px]'}`} />;
              }

              const count = cell.questionCount;
              const isSelected = selectedDate === cell.key;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDate(cell.key)}
                  className={`group relative rounded-2xl border text-left transition-all duration-200 ${compact ? 'min-h-[46px] sm:min-h-[52px] p-1.5 sm:p-2' : 'min-h-[78px] sm:min-h-[96px] p-3 sm:p-4'} ${getDayTone(count)} hover:border-foreground hover:ring-2 hover:ring-foreground/90 hover:-translate-y-0.5 hover:shadow ${isSelected ? 'ring-2 ring-foreground border-foreground shadow' : ''}`}
                  aria-label={`${cell.key}, ${count} unique question${count === 1 ? '' : 's'} attempted`}
                >
                  <div className="flex h-full items-start justify-start">
                    <div className={`${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'} font-bold`}>{cell.day}</div>
                  </div>
                  {count > 0 && (
                    <div className={`absolute bottom-1.5 right-2 font-bold ${compact ? 'text-[9px]' : 'text-xs'} opacity-80`}>
                      {count}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-14 px-4 pb-4 overflow-y-auto">
          <button
            type="button"
            className="absolute inset-0 bg-background/90 backdrop-blur-md"
            onClick={() => setSelectedDate(null)}
            aria-label="Close details"
          />

          <div className={`theme-scrollbar relative z-10 w-full max-w-3xl max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border bg-gradient-to-br ${selectedTone} p-4 sm:p-6 shadow-xl`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Day analysis</div>
                <h3 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-foreground">{selectedDate}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Unique questions attempted on this day; retries are counted once per day.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="mt-4 h-10 w-10 shrink-0 rounded-full border border-border bg-card text-foreground hover:bg-secondary hover:border-foreground transition-all sticky top-0"
                aria-label="Close popup"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Unique attempted</div>
                <div className="mt-1 text-3xl font-black text-foreground">{selectedStats.total}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Solved correctly</div>
                <div className="mt-1 text-3xl font-black text-foreground">{selectedStats.correct}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accuracy</div>
                <div className="mt-1 text-3xl font-black text-foreground">{selectedStats.accuracy}%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4 mb-5">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm font-bold text-foreground mb-3">Exam</div>
                {examBreakdown.length > 0 ? (
                  <select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-foreground"
                  >
                    {examBreakdown.map(({ exam, count }) => (
                      <option key={exam} value={exam}>
                        {exam} ({count})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-muted-foreground">No exam data for this date.</div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm font-bold text-foreground mb-3">Subject Distribution</div>
                {subjectDistribution.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)] gap-4 items-center">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={subjectChartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={3}
                          >
                            {subjectChartData.map((entry, index) => (
                              <Cell key={`subject-cell-${entry.name}-${index}`} fill={chartPalette[index % chartPalette.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={chartTooltip} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      {subjectDistribution.map(({ subject, count }, index) => (
                        <div key={subject} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-sm text-foreground">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                            {subject}
                          </span>
                          <span className="font-bold text-foreground">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No subject data for this exam.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm font-bold text-foreground mb-3">Exam Distribution</div>
                {examDistribution.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)] gap-4 items-center">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={examChartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={3}
                          >
                            {examChartData.map((entry, index) => (
                              <Cell key={`exam-cell-${entry.name}-${index}`} fill={chartPalette[index % chartPalette.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={chartTooltip} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2 max-h-[180px] overflow-auto pr-1">
                      {examDistribution.map(({ exam, count }, index) => (
                        <div key={exam} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-sm text-foreground">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                            {exam}
                          </span>
                          <span className="font-bold text-foreground">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No exam data for this date.</div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm font-bold text-foreground mb-3">Selected Exam Overview</div>
                {selectedExamEntries.length > 0 ? (
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Correct', value: selectedStats.correct },
                            { name: 'Wrong', value: Math.max(0, selectedStats.total - selectedStats.correct) }
                          ]}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={3}
                        >
                          <Cell fill="#22c55e" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip content={chartTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No questions found for the selected exam.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityCalendar;