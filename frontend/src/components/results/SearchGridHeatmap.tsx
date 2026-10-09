import { useEffect, useMemo } from 'react';
import { Grid3x3, X } from 'lucide-react';
import type { Grid, GridCell } from '../../api/types';
import { formatLatLon, formatNm, formatScore } from '../../lib/format';
import { SCORE_LEGEND_STOPS, scoreColor, scoreTextColor } from '../../lib/scoreColor';
import { useSelection } from '../../state/SelectionContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';

export const GRID_BANNER_TEXT = 'ILLUSTRATIVE RELATIVE DEMO SCORES — NOT PROBABILITIES';

interface Props {
  grid: Grid | null;
  loading: boolean;
}

function CellDetails({ cell, label }: { cell: GridCell; label: string }) {
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
      <dt className="col-span-2 mb-1 font-sans text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dt className="text-muted">Cell</dt>
      <dd className="text-ink">
        {cell.cell_id} (row {cell.row}, col {cell.column})
      </dd>
      <dt className="text-muted">Centre</dt>
      <dd className="text-ink">{formatLatLon(cell.centre_latitude, cell.centre_longitude)}</dd>
      <dt className="text-muted">Demo score</dt>
      <dd className="text-ink">{formatScore(cell.illustrative_relative_demo_score)}</dd>
      <dt className="text-muted">Region</dt>
      <dd className="text-ink">{cell.intersects_region ? 'Intersects region' : 'Outside region'}</dd>
    </dl>
  );
}

export function SearchGridHeatmap({ grid, loading }: Props) {
  const { selectedCellId, hoveredCellId, toggleCell, selectCell, setHoveredCell } = useSelection();
  const cells = useMemo(() => grid?.cells ?? [], [grid]);
  const byId = useMemo(() => new Map(cells.map((c) => [c.cell_id, c])), [cells]);
  const active = (hoveredCellId && byId.get(hoveredCellId)) || (selectedCellId && byId.get(selectedCellId)) || null;
  const activeLabel = hoveredCellId && byId.get(hoveredCellId) ? 'Hovered / focused cell' : 'Selected cell';

  useEffect(() => {
    if (!selectedCellId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectCell(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedCellId, selectCell]);

  const hasGrid = Boolean(grid && cells.length > 0);

  return (
    <section aria-labelledby="grid-title" className="panel p-4 sm:p-5" aria-busy={loading}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="grid-title" className="panel-title">
            Search grid visualization
          </h2>
          {grid && (
            <p className="mt-1 text-sm text-muted">
              {grid.rows} × {grid.columns} cells · each ≈ {formatNm(grid.cell_size_nm.width_nm)} × {formatNm(grid.cell_size_nm.height_nm)} · row 0 = north,
              column 0 = west
            </p>
          )}
        </div>
        {selectedCellId && (
          <Button size="sm" variant="ghost" onClick={() => selectCell(null)} icon={<X className="h-3.5 w-3.5" aria-hidden="true" />}>
            Clear selection
          </Button>
        )}
      </header>

      {loading && !grid ? (
        <LoadingSkeleton className="aspect-square w-full max-w-md" label="Loading grid" />
      ) : !hasGrid || !grid ? (
        <EmptyState icon={<Grid3x3 className="h-6 w-6" />} title="Grid data unavailable" description="Run an analysis to see the demonstration grid." />
      ) : (
        <>
          <p role="note" className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-center font-mono text-[11px] font-semibold tracking-wider text-warn">
            {GRID_BANNER_TEXT}
          </p>
          <p className="mb-4 text-xs leading-relaxed text-muted">{grid.score_description}</p>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="relative overflow-x-auto pb-1">
              <div
                role="group"
                aria-label={`Demo grid, ${grid.rows} rows by ${grid.columns} columns. Row 0 is north (top), column 0 is west (left).`}
                className="mx-auto grid max-w-md gap-[3px]"
                style={{
                  gridTemplateColumns: `repeat(${grid.columns}, minmax(24px, 1fr))`,
                  minWidth: `${grid.columns * 27}px`,
                }}
              >
                {Array.from({ length: grid.rows }, (_, r) => (
                  <div key={r} className="contents">
                    {cells
                      .filter((c) => c.row === r)
                      .sort((a, b) => a.column - b.column)
                      .map((c) => {
                        const selected = selectedCellId === c.cell_id;
                        const hovered = hoveredCellId === c.cell_id;
                        const score = c.illustrative_relative_demo_score;
                        return (
                          <button
                            key={c.cell_id}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`Cell ${c.cell_id}, centre ${formatLatLon(c.centre_latitude, c.centre_longitude)}, demo score ${formatScore(score)}, ${
                              c.intersects_region ? 'intersects region' : 'outside region'
                            }`}
                            onClick={() => toggleCell(c.cell_id)}
                            onMouseEnter={() => setHoveredCell(c.cell_id)}
                            onMouseLeave={() => setHoveredCell(null)}
                            onFocus={() => setHoveredCell(c.cell_id)}
                            onBlur={() => setHoveredCell(null)}
                            className={[
                              'relative aspect-square rounded-[4px] font-mono text-[9px] transition-[box-shadow,opacity] duration-150',
                              c.intersects_region ? '' : 'opacity-40',
                              selected ? 'z-10 ring-2 ring-ink ring-offset-2 ring-offset-panel' : hovered ? 'ring-1 ring-accent' : '',
                            ].join(' ')}
                            style={{
                              gridRow: c.row + 1,
                              gridColumn: c.column + 1,
                              backgroundColor: scoreColor(score),
                              color: scoreTextColor(score),
                              backgroundImage: c.intersects_region
                                ? undefined
                                : 'repeating-linear-gradient(45deg, rgba(7,11,20,.55) 0 2px, transparent 2px 5px)',
                            }}
                          >
                            <span aria-hidden="true" className="hidden sm:inline">
                              {grid.columns <= 9 ? formatScore(score) : ''}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
              <div className="mx-auto mt-2 flex max-w-md justify-between font-mono text-[10px] text-muted" aria-hidden="true">
                <span>W</span>
                <span>N ↑ (row 0 at top)</span>
                <span>E</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Relative demo score</p>
                <div
                  className="h-2.5 rounded-full"
                  aria-hidden="true"
                  style={{ background: `linear-gradient(90deg, ${SCORE_LEGEND_STOPS.map((s) => s.color).join(',')})` }}
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
                  <span>0.00 min</span>
                  <span>1.00 max</span>
                </div>
                <p className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                  <span
                    className="inline-block h-3 w-3 rounded-sm opacity-40"
                    aria-hidden="true"
                    style={{ backgroundColor: scoreColor(0), backgroundImage: 'repeating-linear-gradient(45deg, rgba(7,11,20,.55) 0 2px, transparent 2px 5px)' }}
                  />
                  Hatched, faded cells lie outside the region.
                </p>
              </div>
              <div className="min-h-[112px] rounded-xl border border-line/10 bg-elevated/40 p-3" aria-live="polite">
                {active ? (
                  <CellDetails cell={active} label={activeLabel} />
                ) : (
                  <p className="text-xs text-muted">Hover, focus or tap a cell to see its centre, demo score and region status.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
