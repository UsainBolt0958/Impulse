import React from 'react';

export function formatProExpiry(expiresAt) {
  if (!expiresAt) return 'No expiry date';
  const date = new Date(expiresAt);
  if (!Number.isFinite(date.getTime())) return 'Expiry date unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function ProStatusBadge({ expiresAt, compact = false }) {
  return (
    <span
      aria-label={`Impulse Pro member${compact ? '' : `, expires ${formatProExpiry(expiresAt)}`}`}
      className={`inline-flex flex-col items-center justify-center ${compact ? 'gap-0' : 'gap-1'}`}
    >
      <span className={`inline-flex items-center justify-center rounded-full border border-violet-400/50 bg-violet-500/10 font-black leading-none tracking-[0.14em] text-violet-700 shadow-[0_0_8px_rgba(168,85,247,0.28)] dark:text-violet-300 ${compact ? 'px-2 py-1 text-[8px]' : 'px-3 py-1.5 text-xs'}`}>
        PRO
      </span>
      {!compact && (
        <span className="text-xs font-medium text-muted-foreground">
          Expires {formatProExpiry(expiresAt)}
        </span>
      )}
    </span>
  );
}

export default ProStatusBadge;
