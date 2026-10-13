import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import ColoredIcon from './ColoredIcon';

function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialize theme from localStorage or OS preference
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (stored === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
        setIsDark(true);
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <header className="border-b border-border bg-background sticky top-0 z-50 flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-20">
          <Link to="/" className="flex items-center group">
            <span className="text-2xl md:text-3xl font-black tracking-[0.28em] uppercase group-hover:opacity-80 transition-opacity duration-200">
              Impulse
            </span>
          </Link>

          <div className="flex-1" />

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-md hover:bg-secondary transition"
            title={isDark ? 'Switch to light' : 'Switch to dark'}
          >
            {isDark ? <ColoredIcon icon={Sun} name="sun" size={5} /> : <ColoredIcon icon={Moon} name="moon" size={5} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;