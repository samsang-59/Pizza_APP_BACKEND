import { useEffect, useRef } from 'react';
import { GitBranch, X } from 'lucide-react';
import type { Scenario } from '../../api/types';
import { useSelection } from '../../state/SelectionContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { ScenarioCard } from './ScenarioCard';

interface Props {
  scenarios: Scenario[] | null;
  loading: boolean;
}

export function ScenarioExplorer({ scenarios, loading }: Props) {
  const { selectedScenarioId, hoveredScenarioId, scenarioSelectionSource, toggleScenario, selectScenario, setHoveredScenario } = useSelection();
  const cardRefs = useRef(new Map<string, HTMLElement>());

  // Marker -> card: bring the matching card into view without hijacking the page.
  useEffect(() => {
    if (!selectedScenarioId || scenarioSelectionSource !== 'map') return;
    cardRefs.current.get(selectedScenarioId)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selectedScenarioId, scenarioSelectionSource]);

  useEffect(() => {
    if (!selectedScenarioId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectScenario(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedScenarioId, selectScenario]);

  return (
    <section aria-labelledby="scenarios-title" className="panel p-4 sm:p-5" aria-busy={loading}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="scenarios-title" className="panel-title">
            Scenario explorer
          </h2>
          <p className="mt-1 text-sm text-muted">Heading-sensitivity cases — not verified flight paths.</p>
        </div>
        {selectedScenarioId && (
          <Button size="sm" variant="ghost" onClick={() => selectScenario(null)} icon={<X className="h-3.5 w-3.5" aria-hidden="true" />}>
            Clear selection
          </Button>
        )}
      </header>
      {loading && !scenarios ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading scenarios">
          {[0, 1, 2].map((i) => (
            <LoadingSkeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !scenarios || scenarios.length === 0 ? (
        <EmptyState icon={<GitBranch className="h-6 w-6" />} title="No scenarios yet" description="Run an analysis to list the baseline and heading-sensitivity cases." />
      ) : (
        <div
          className="relative -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3"
          role="list"
          aria-label="Scenarios"
        >
          {scenarios.map((s) => (
            <div role="listitem" key={s.scenario_id} className="snap-start">
              <ScenarioCard
                ref={(el) => {
                  if (el) cardRefs.current.set(s.scenario_id, el);
                  else cardRefs.current.delete(s.scenario_id);
                }}
                scenario={s}
                selected={selectedScenarioId === s.scenario_id}
                hovered={hoveredScenarioId === s.scenario_id}
                onSelect={() => toggleScenario(s.scenario_id, 'list')}
                onHover={(h) => setHoveredScenario(h ? s.scenario_id : null)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
