import React from 'react';
import { Progress } from '@/components/ui/progress';

function ProgressBar({ current, total }) {
  const percentage = (current / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-wide">
          Question {current} of {total}
        </span>
        <span className="text-sm font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

export default ProgressBar;