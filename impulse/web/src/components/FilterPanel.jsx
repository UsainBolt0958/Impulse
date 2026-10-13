import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import ColoredIcon from './ColoredIcon';

function FilterPanel({ filters, updateFilters, clearFilters, getUniqueValues }) {
  const exams = getUniqueValues('exam');
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const subjects = getUniqueValues('subject');
  const chapters = getUniqueValues('chapter');
  const years = getUniqueValues('year');

  const handleCheckboxChange = (category, value) => {
    const current = filters[category] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateFilters({ [category]: updated });
  };

  const FilterSection = ({ title, category, options }) => (
    <div className="space-y-3">
      <h3 className="font-bold text-sm uppercase tracking-wide">{title}</h3>
      <div className="space-y-2">
        {options.map(option => (
          <div key={option} className="flex items-center gap-2">
            <Checkbox
              id={`${category}-${option}`}
              checked={filters[category]?.includes(option) || false}
              onCheckedChange={() => handleCheckboxChange(category, option)}
            />
            <Label
              htmlFor={`${category}-${option}`}
              className="text-sm font-medium cursor-pointer"
            >
              {option}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-black uppercase tracking-tight">Filters</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 px-2 text-xs font-bold"
        >
          <ColoredIcon icon={X} name="x" size={4} className="mr-1" />
          Clear
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <FilterSection title="Exam" category="exam" options={exams} />
        <FilterSection title="Difficulty" category="difficulty" options={difficulties} />
        <FilterSection title="Subject" category="subject" options={subjects} />
        <FilterSection title="Chapter" category="chapter" options={chapters} />
        <FilterSection title="Year" category="year" options={years} />
      </CardContent>
    </Card>
  );
}

export default FilterPanel;