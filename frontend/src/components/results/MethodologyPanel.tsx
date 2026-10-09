import { forwardRef, useCallback, useId } from 'react';
import { BookOpen, ChevronDown, RotateCw } from 'lucide-react';
import { getMethodology } from '../../api/endpoints';
import { useApiResource } from '../../hooks/useApiResource';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';

/** Key statements that must always be visible, regardless of backend availability. */
export const METHODOLOGY_KEY_POINTS = [
  'distance_nm = ground_speed_kt × elapsed_min / 60.',
  'The baseline endpoint is a simplified projection from the supplied heading (treated as the ground track) and ground speed.',
  'Ground speed already includes wind, so wind is NOT added to the baseline.',
  'The frontend does not calculate a wind-adjusted trajectory; it only displays what the backend returns.',
  'Generic aircraft categories are demonstration labels, not aircraft performance profiles.',
  'A fuel percentage cannot give endurance or range on its own.',
  'Scenarios are illustrative heading-sensitivity cases.',
  'Grid scores are demonstration values, NOT probabilities.',
  'Not for operational rescue decisions.',
];

interface Props {
  open: boolean;
  onToggle: () => void;
}

export const MethodologyPanel = forwardRef<HTMLElement, Props>(function MethodologyPanel({ open, onToggle }, ref) {
  const bodyId = useId();
  const fetcher = useCallback((opts: { signal: AbortSignal }) => getMethodology(opts), []);
  const { data, error, isLoading, reload } = useApiResource(fetcher, open);

  return (
    <section ref={ref} id="methodology" aria-labelledby="methodology-title" className="panel scroll-mt-24 p-4 sm:p-5">
      <h2 id="methodology-title" className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
        >
          <span className="panel-title inline-flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Methodology &amp; assumptions
          </span>
          <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>

      <div id={bodyId} hidden={!open} className="mt-4 space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Key points</h3>
          <ul className="grid gap-1.5 text-sm text-muted md:grid-cols-2">
            {METHODOLOGY_KEY_POINTS.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {isLoading && !data && <LoadingSkeleton lines={4} label="Loading methodology" />}

        {data && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">{data.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{data.summary}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted/80">Source: GET /api/v1/methodology</p>
            </div>
            <ol className="grid gap-3 md:grid-cols-2">
              {data.steps.map((s, i) => (
                <li key={s.name} className="rounded-xl border border-line/10 bg-elevated/30 p-3">
                  <p className="text-xs font-semibold text-accent">
                    {i + 1}. {s.name}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{s.detail}</p>
                </li>
              ))}
            </ol>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink">Wind limitations</h4>
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {data.wind_limitations.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <h4 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wider text-ink">Fuel limitations</h4>
                <p className="text-xs text-muted">{data.fuel_limitations}</p>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink">Limitations</h4>
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {data.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted">{data.disclaimer}</p>
          </div>
        )}

        {error && !data && (
          <div className="rounded-xl border border-line/15 bg-elevated/30 p-3 text-sm text-muted">
            <p className="font-mono text-[10px] uppercase tracking-wider text-warn">Static copy — backend methodology unavailable</p>
            <p className="mt-1">
              The detailed methodology could not be loaded from the backend ({error.message}). The key points above are static copy maintained in the
              frontend and describe the same method.
            </p>
            <Button size="sm" className="mt-2" onClick={() => void reload()} icon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </section>
  );
});
