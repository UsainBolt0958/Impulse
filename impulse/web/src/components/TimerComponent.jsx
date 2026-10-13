import React, { useState, useEffect } from 'react';

function TimerComponent({ isRunning, onTimeUpdate, resetKey, className = '' }) {
  const [seconds, setSeconds] = useState(0);

  // Reset timer when the resetKey changes (e.g., when moving to a new question)
  useEffect(() => {
    setSeconds(0);
  }, [resetKey]);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(prev => {
          const newTime = prev + 1;
          if (onTimeUpdate) {
            onTimeUpdate(newTime);
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, onTimeUpdate]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`inline-flex items-center justify-center rounded-full border border-border/80 bg-transparent px-3 py-1.5 text-foreground shadow-none ${className}`.trim()}>
      <span className="text-xs sm:text-sm font-normal tracking-wide" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatTime(seconds)}
      </span>
    </div>
  );
}

export default TimerComponent;