import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type SelectionSource = 'list' | 'map' | 'grid';

export interface SelectionState {
  hoveredScenarioId: string | null;
  selectedScenarioId: string | null;
  /** Where the latest scenario selection came from (cards scroll into view only for map selections). */
  scenarioSelectionSource: SelectionSource | null;
  hoveredCellId: string | null;
  selectedCellId: string | null;
  setHoveredScenario: (id: string | null) => void;
  selectScenario: (id: string | null, source?: SelectionSource) => void;
  toggleScenario: (id: string, source?: SelectionSource) => void;
  setHoveredCell: (id: string | null) => void;
  selectCell: (id: string | null) => void;
  toggleCell: (id: string) => void;
  clearAll: () => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [hoveredScenarioId, setHoveredScenario] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioSelectionSource, setSource] = useState<SelectionSource | null>(null);
  const [hoveredCellId, setHoveredCell] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const selectScenario = useCallback((id: string | null, source: SelectionSource = 'list') => {
    setSelectedScenarioId(id);
    setSource(id ? source : null);
  }, []);
  const toggleScenario = useCallback(
    (id: string, source: SelectionSource = 'list') => {
      const next = selectedScenarioId === id ? null : id;
      setSelectedScenarioId(next);
      setSource(next ? source : null);
    },
    [selectedScenarioId],
  );
  const selectCell = useCallback((id: string | null) => setSelectedCellId(id), []);
  const toggleCell = useCallback((id: string) => setSelectedCellId((cur) => (cur === id ? null : id)), []);
  const clearAll = useCallback(() => {
    setHoveredScenario(null);
    setSelectedScenarioId(null);
    setSource(null);
    setHoveredCell(null);
    setSelectedCellId(null);
  }, []);

  const value = useMemo<SelectionState>(
    () => ({
      hoveredScenarioId,
      selectedScenarioId,
      scenarioSelectionSource,
      hoveredCellId,
      selectedCellId,
      setHoveredScenario,
      selectScenario,
      toggleScenario,
      setHoveredCell,
      selectCell,
      toggleCell,
      clearAll,
    }),
    [hoveredScenarioId, selectedScenarioId, scenarioSelectionSource, hoveredCellId, selectedCellId, selectScenario, toggleScenario, selectCell, toggleCell, clearAll],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionState {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used inside <SelectionProvider>');
  return ctx;
}
