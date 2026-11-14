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
      className={`inline-flex flex-col items-center justify-center bg-transparent ${compact ? 'gap-0' : 'gap-1'}`}
    >
      <span className={`pro-status-badge__label inline-flex items-center justify-center rounded-full font-semibold leading-none tracking-[0.2em] ${compact ? 'px-2 py-1 text-[8px]' : 'px-3 py-1.5 text-xs'}`}>
        <span className="pro-status-badge__text">PRO</span>
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
