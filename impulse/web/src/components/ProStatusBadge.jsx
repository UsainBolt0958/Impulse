import React from 'react';
import { Sparkles } from 'lucide-react';

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
      className={`inline-flex flex-col items-center justify-center bg-transparent text-violet-500 ${compact ? 'gap-0' : 'gap-1'}`}
    >
      <Sparkles
        className={`text-violet-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.9)] motion-safe:animate-pulse motion-reduce:animate-none ${compact ? 'h-3 w-3' : 'h-7 w-7'}`}
        aria-hidden="true"
      />
      <span className={`font-black leading-none tracking-[0.16em] ${compact ? 'text-[8px]' : 'text-xs'}`}>
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
