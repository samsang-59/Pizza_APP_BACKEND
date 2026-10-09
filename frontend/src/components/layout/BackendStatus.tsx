import { useId } from 'react';
import type { BackendStatus as Status } from '../../hooks/useBackendHealth';
import { API_BASE_URL } from '../../api/client';

const LABELS: Record<Status, string> = {
  checking: 'Checking API',
  connected: 'API connected',
  unreachable: 'API unreachable',
};

const DOT: Record<Status, string> = {
  checking: 'bg-muted',
  connected: 'bg-ok',
  unreachable: 'bg-danger',
};

interface Props {
  status: Status;
  lastChecked: Date | null;
  onRetry: () => void;
}

/** Reflects GET /health. Click to re-check. Connectivity only — not aircraft tracking. */
export function BackendStatus({ status, lastChecked, onRetry }: Props) {
  const tipId = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onRetry}
        aria-describedby={tipId}
        aria-label={`${LABELS[status]}. Click to check again.`}
        className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          status === 'unreachable' ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-line/20 text-ink/90 hover:border-accent/40'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${DOT[status]} ${status === 'checking' ? 'animate-pulse' : ''}`} aria-hidden="true" />
        <span aria-live="polite" className="max-[379px]:sr-only">{LABELS[status]}</span>
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-[1500] mt-2 hidden w-60 rounded-lg border border-line/20 bg-elevated px-3 py-2 text-xs text-ink shadow-panel group-focus-within:block group-hover:block"
      >
        API connectivity only — not live aircraft tracking.
        <span className="mt-1 block font-mono text-[10px] text-muted">
          {API_BASE_URL || window.location.origin}/health{lastChecked ? ` · checked ${lastChecked.toLocaleTimeString()}` : ''}
        </span>
        <span className="mt-0.5 block text-[10px] text-muted">Click to re-check.</span>
      </span>
    </span>
  );
}
