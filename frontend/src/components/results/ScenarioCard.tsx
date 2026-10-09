import { forwardRef, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Scenario } from '../../api/types';
import { TYPE_BADGES, scenarioKind } from '../../lib/analysis';
import { formatDegrees, formatLatLon, formatNm } from '../../lib/format';
import { legendSvg } from '../map/markerIcons';

interface Props {
  scenario: Scenario;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

const BADGE_STYLES: Record<string, string> = {
  baseline: 'border-accent/40 text-accent',
  sensitivity: 'border-accent2/40 text-accent2',
  outer: 'border-accent2/30 text-accent2',
  hypothetical: 'border-warn/50 border-dashed text-warn',
  other: 'border-line/30 text-muted',
};

export const ScenarioCard = forwardRef<HTMLElement, Props>(function ScenarioCard({ scenario, selected, hovered, onSelect, onHover }, ref) {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const kind = scenarioKind(scenario);
  const assumptionsId = useId();
  const hypothetical = kind === 'hypothetical';

  return (
    <article
      ref={ref}
      data-scenario-id={scenario.scenario_id}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={[
        'interactive-card relative flex h-full min-w-[260px] flex-col rounded-xl border bg-elevated/50 p-3 md:min-w-0',
        selected ? 'border-accent shadow-glow' : hovered ? 'border-accent/40' : 'border-line/10',
        hypothetical ? 'border-dashed' : '',
      ].join(' ')}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        className="-m-1 rounded-lg p-1 text-left"
      >
        <span className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-[22px] w-[22px] shrink-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: legendSvg(kind) }} />
          <span className="min-w-0 flex-1">
            <span className={`chip ${BADGE_STYLES[kind]}`}>{TYPE_BADGES[kind]}</span>
            <span className="mt-1 block text-sm font-semibold leading-snug text-ink">{scenario.scenario_name}</span>
          </span>
        </span>
        <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
          <dt className="text-muted">Endpoint</dt>
          <dd className="text-ink">{formatLatLon(scenario.endpoint.latitude, scenario.endpoint.longitude)}</dd>
          <dt className="text-muted">Distance</dt>
          <dd className="text-ink">{formatNm(scenario.distance_nm)}</dd>
          <dt className="text-muted">Heading used</dt>
          <dd className="text-ink">{formatDegrees(scenario.heading_degrees_used)}</dd>
          <dt className="text-muted">Offset vs baseline</dt>
          <dd className="text-ink">{formatNm(scenario.offset_from_baseline_nm)}</dd>
          <dt className="text-muted">In region</dt>
          <dd className="text-ink">{scenario.included_in_region ? 'Yes' : 'No (context only)'}</dd>
        </dl>
        <span className="sr-only">{selected ? 'Selected. Press to unselect.' : 'Press to select and highlight on the map.'}</span>
      </button>
      <p className="mt-2 text-xs leading-relaxed text-muted">{scenario.description}</p>
      {scenario.assumptions.length > 0 && (
        <div className="mt-auto pt-2">
          <button
            type="button"
            aria-expanded={showAssumptions}
            aria-controls={assumptionsId}
            onClick={() => setShowAssumptions((s) => !s)}
            className="inline-flex min-h-[36px] items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Assumptions ({scenario.assumptions.length})
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAssumptions ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          <ul id={assumptionsId} hidden={!showAssumptions} className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted">
            {scenario.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
});
