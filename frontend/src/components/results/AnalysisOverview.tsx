import { forwardRef } from 'react';
import { AlertTriangle, Copy, History } from 'lucide-react';
import type { AnalysisResponse } from '../../api/types';
import { getInputNumber, sensitivityScenarios } from '../../lib/analysis';
import { EM_DASH, formatArea, formatLatLon, formatMinutes, formatNumber, formatPercent } from '../../lib/format';
import { useToast } from '../ui/Toast/ToastProvider';
import { TelemetryCard } from './TelemetryCard';

interface Props {
  result: AnalysisResponse | null;
  loading: boolean;
  isStale: boolean;
}

const TOP_WARNINGS = 3;

export const AnalysisOverview = forwardRef<HTMLHeadingElement, Props>(function AnalysisOverview({ result, loading, isStale }, headingRef) {
  const toast = useToast();
  const showSkeleton = loading && !result;
  const end = result?.baseline.endpoint;
  const warnings = result?.warnings ?? [];

  const copyId = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.analysis_id);
      toast.notify('Analysis ID copied to clipboard.', 'success');
    } catch {
      toast.notify('Could not access the clipboard. Select the ID and copy it manually.', 'error');
    }
  };

  return (
    <section aria-labelledby="overview-title" className="panel p-4" aria-busy={loading}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id="overview-title" ref={headingRef} tabIndex={-1} className="panel-title focus:outline-none">
          Analysis overview
        </h2>
        <span className="chip border-accent/30 text-accent">{result ? 'Illustrative' : 'Awaiting input'}</span>
      </header>

      {isStale && result && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-warn/35 bg-warn/10 px-2.5 py-2 text-xs text-ink">
          <History className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
          Showing previous result — latest request failed
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <TelemetryCard
          label="Baseline distance"
          loading={showSkeleton}
          value={result ? formatNumber(result.baseline.distance_nm, 1) : EM_DASH}
          unit={result ? 'nm' : undefined}
          hint="Ground speed × elapsed time ÷ 60, along the supplied heading treated as ground track. Returned by the backend."
        />
        <TelemetryCard
          label="Elapsed time"
          loading={showSkeleton}
          value={result ? formatMinutes(getInputNumber(result, 'elapsed_minutes')) : EM_DASH}
          hint="Echoed from the request (input summary)."
        />
        <div className="col-span-2">
          <TelemetryCard
            label="Baseline endpoint"
            loading={showSkeleton}
            value={end ? <span className="text-base">{formatLatLon(end.latitude, end.longitude)}</span> : EM_DASH}
            hint="Straight-line projection of the baseline. An illustrative reference point, not a located aircraft."
          />
        </div>
        <TelemetryCard
          label="Sensitivity cases"
          loading={showSkeleton}
          value={result ? String(sensitivityScenarios(result).length) : EM_DASH}
          hint="Number of scenarios besides the baseline (heading ± u, outer ± 2u, and an optional hypothetical wind case)."
        />
        <TelemetryCard
          label="Fuel remaining"
          loading={showSkeleton}
          value={result ? formatPercent(result.fuel_context.remaining_percent) : EM_DASH}
          sub={result ? 'Endurance: Not computed' : undefined}
          hint="Reported fuel percentage. Endurance is not computed: a percentage alone cannot determine endurance or range without capacity, fuel flow, reserves and aircraft data."
        />
        <TelemetryCard
          label="Region area"
          loading={showSkeleton}
          value={result ? formatArea(result.search_region.properties.area_sq_nm) : EM_DASH}
          sub={result ? 'approx.' : undefined}
          hint="Approximate area computed by the backend in its local projection (not equal-area)."
        />
        <TelemetryCard
          label="Region status"
          loading={showSkeleton}
          value={result ? <span className="text-sm">Illustrative</span> : EM_DASH}
          hint="The region is an illustrative sketch — not an operational search boundary."
        />
      </div>

      {result && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line/10 pt-3 font-mono text-[10px] text-muted">
          <span>ID</span>
          <span className="max-w-[12rem] truncate text-ink/80" title={result.analysis_id}>
            {result.analysis_id}
          </span>
          <button
            type="button"
            onClick={() => void copyId()}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-1.5 text-accent hover:bg-elevated"
            aria-label="Copy analysis ID"
          >
            <Copy className="h-3 w-3" aria-hidden="true" /> Copy
          </button>
          <span className="ml-auto">schema v{result.schema_version}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-3 border-t border-line/10 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warn">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Key warnings
          </p>
          <ul className="space-y-1 text-xs text-muted">
            {warnings.slice(0, TOP_WARNINGS).map((w, i) => (
              <li key={i} className="leading-snug">
                {w}
              </li>
            ))}
          </ul>
          <a href="#warnings-panel" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
            View all {warnings.length} warnings
          </a>
        </div>
      )}
    </section>
  );
});
