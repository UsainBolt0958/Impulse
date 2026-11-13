import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const nextIsDark = storedTheme === 'dark' || (storedTheme !== 'light' && prefersDark);

    document.documentElement.classList.toggle('dark', nextIsDark);
    setIsDark(nextIsDark);
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);
    document.documentElement.classList.toggle('dark', nextIsDark);
    window.localStorage.setItem('theme', nextIsDark ? 'dark' : 'light');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-secondary"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default ThemeToggle;
