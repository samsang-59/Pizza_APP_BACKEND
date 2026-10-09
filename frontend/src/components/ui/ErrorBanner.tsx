import { AlertOctagon, RotateCw, WifiOff, X } from 'lucide-react';
import type { AppError } from '../../api/errors';
import { Button } from './Button';

interface Props {
  error: AppError;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retrying?: boolean;
  className?: string;
}

const TITLES: Record<AppError['kind'], string> = {
  network: 'Backend unreachable',
  timeout: 'Request timed out',
  validation: 'Inputs rejected by the backend',
  server: 'Backend error',
  unknown: 'Something went wrong',
};

export function ErrorBanner({ error, title, onRetry, onDismiss, retrying, className = '' }: Props) {
  const Icon = error.kind === 'network' || error.kind === 'timeout' ? WifiOff : AlertOctagon;
  return (
    <div role="alert" className={`rounded-xl border border-danger/35 bg-danger/10 p-3 text-sm ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">
            {title ?? TITLES[error.kind]}
            {error.code && <span className="ml-2 font-mono text-[10px] font-normal text-muted">{error.code}</span>}
          </p>
          <p className="mt-0.5 text-muted">{error.message}</p>
          {error.otherDetails.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted">
              {error.otherDetails.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {onRetry && error.retryable && (
            <Button size="sm" variant="danger" className="mt-3" onClick={onRetry} loading={retrying} icon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}>
              Retry
            </Button>
          )}
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="rounded-md p-1 text-muted hover:text-ink" aria-label="Dismiss error">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
