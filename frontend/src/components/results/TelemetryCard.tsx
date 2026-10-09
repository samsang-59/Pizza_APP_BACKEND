import type { ReactNode } from 'react';
import { InfoTip } from '../ui/InfoTip';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  hint: ReactNode;
  loading?: boolean;
  sub?: ReactNode;
}

export function TelemetryCard({ label, value, unit, hint, loading, sub }: Props) {
  return (
    <div className="interactive-card min-w-0 rounded-xl border border-line/10 bg-elevated/50 p-3">
      <div className="flex items-start justify-between gap-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
        <InfoTip label={`About ${label}`} align="right">
          {hint}
        </InfoTip>
      </div>
      {loading ? (
        <LoadingSkeleton className="mt-1 h-6 w-3/4" />
      ) : (
        <p className="mt-0.5 break-words font-mono text-lg font-semibold leading-tight text-ink">
          {value}
          {unit && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}
        </p>
      )}
      {sub && !loading && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
