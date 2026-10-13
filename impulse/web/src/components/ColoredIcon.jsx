import React from 'react';

// Map semantic keys or icon names to Tailwind color classes
const COLOR_MAP = {
  flame: 'text-orange-500',
  streak: 'text-orange-500',
  trending: 'text-green-500',
  trendingup: 'text-green-500',
  target: 'text-indigo-600',
  clock: 'text-yellow-500',
  award: 'text-amber-500',
  bookmark: 'text-purple-500',
  bookmarkicon: 'text-purple-500',
  check: 'text-green-500',
  checkcircle2: 'text-green-600',
  xcircle: 'text-red-500',
  home: 'text-sky-500',
  book: 'text-emerald-500',
  bookopen: 'text-emerald-500',
  clipboard: 'text-indigo-500',
  chart: 'text-green-600',
  calendar: 'text-sky-400',
  filetext: 'text-indigo-500',
  loader: 'text-primary',
};

const FALLBACK_COLORS = [
  'text-sky-500',
  'text-emerald-500',
  'text-indigo-500',
  'text-amber-500',
  'text-rose-500',
  'text-cyan-500',
  'text-violet-500',
  'text-orange-500'
];

const NEUTRAL_TEXT_CLASSES = /\btext-(muted-foreground|foreground|primary|secondary-foreground|background|card-foreground|popover-foreground|accent-foreground|destructive-foreground)\b/g;

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function sizeToClass(size) {
  switch (size) {
    case 3: return 'h-3 w-3';
    case 4: return 'h-4 w-4';
    case 5: return 'h-5 w-5';
    case 6: return 'h-6 w-6';
    case 7: return 'h-7 w-7';
    case 8: return 'h-8 w-8';
    default: return 'h-5 w-5';
  }
}

export default function ColoredIcon({ icon: Icon, name = '', size = 5, className = '', strokeWidth }) {
  const key = String(name || Icon?.name || '').toLowerCase();
  const colorClass = COLOR_MAP[key] || FALLBACK_COLORS[hashString(key) % FALLBACK_COLORS.length];
  const sizeClass = sizeToClass(size);
  const sanitizedClassName = className.replace(NEUTRAL_TEXT_CLASSES, '').trim();
  const combined = `${sizeClass} ${colorClass} ${sanitizedClassName}`.trim();

  return <Icon className={combined} strokeWidth={strokeWidth} />;
}
