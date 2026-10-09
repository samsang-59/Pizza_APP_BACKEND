import { legendSvg } from './markerIcons';
import { SCORE_LEGEND_STOPS } from '../../lib/scoreColor';
import type { MarkerKind } from '../../lib/analysis';

const ITEMS: { kind: MarkerKind; label: string; note?: string }[] = [
  { kind: 'lkp', label: 'Last known position' },
  { kind: 'baseline', label: 'Baseline endpoint', note: 'straight-line ground track' },
  { kind: 'sensitivity', label: 'Heading sensitivity (h ± u)' },
  { kind: 'outer', label: 'Outer sensitivity (h ± 2u)' },
  { kind: 'hypothetical', label: 'HYPOTHETICAL wind case', note: 'dashed ghost marker; not in region' },
];

export function MapLegend({ showGrid }: { showGrid: boolean }) {
  return (
    <div className="panel w-60 max-w-[calc(100vw-3rem)] p-3 text-xs" role="group" aria-label="Map legend">
      <p className="panel-title mb-2">Legend</p>
      <ul className="space-y-1.5">
        {ITEMS.map((it) => (
          <li key={it.kind} className="flex items-center gap-2">
            <span className="inline-flex h-[22px] w-[22px] shrink-0" dangerouslySetInnerHTML={{ __html: legendSvg(it.kind) }} />
            <span>
              {it.label}
              {it.note && <span className="block text-[10px] text-muted">{it.note}</span>}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="21" y2="5" stroke="#42D9FF" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          <span>
            Baseline vector
            <span className="block text-[10px] text-muted">projected, not a flight path</span>
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-[22px] rounded-sm border border-accent bg-accent/15" aria-hidden="true" />
          <span>Illustrative search region</span>
        </li>
      </ul>
      {showGrid && (
        <div className="mt-3 border-t border-line/10 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Grid: relative demo score</p>
          <div
            className="mt-1 h-2 rounded-full"
            aria-hidden="true"
            style={{ background: `linear-gradient(90deg, ${SCORE_LEGEND_STOPS.map((s) => s.color).join(',')})` }}
          />
          <div className="mt-0.5 flex justify-between font-mono text-[10px] text-muted">
            <span>0 (min)</span>
            <span>1 (max)</span>
          </div>
          <p className="mt-1 text-[10px] text-muted">Demonstration values — NOT probabilities. Dashed, faint cells lie outside the region.</p>
        </div>
      )}
    </div>
  );
}
