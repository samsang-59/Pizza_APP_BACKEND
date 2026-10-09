import type { AnalysisResponse, LatLon, Scenario } from '../api/types';

export type MarkerKind = 'lkp' | 'baseline' | 'sensitivity' | 'outer' | 'hypothetical' | 'other';

export function scenarioKind(s: Pick<Scenario, 'scenario_type'>): MarkerKind {
  switch (s.scenario_type) {
    case 'baseline_ground_track':
      return 'baseline';
    case 'heading_sensitivity':
      return 'sensitivity';
    case 'heading_sensitivity_outer':
      return 'outer';
    case 'wind_sensitivity_hypothetical':
      return 'hypothetical';
    default:
      return 'other';
  }
}

export const KIND_LABELS: Record<MarkerKind, string> = {
  lkp: 'Last known position',
  baseline: 'Baseline endpoint',
  sensitivity: 'Heading sensitivity',
  outer: 'Outer heading sensitivity',
  hypothetical: 'Hypothetical wind sensitivity',
  other: 'Scenario',
};

export const TYPE_BADGES: Record<MarkerKind, string> = {
  lkp: 'START',
  baseline: 'BASELINE',
  sensitivity: 'SENSITIVITY',
  outer: 'OUTER SENSITIVITY',
  hypothetical: 'HYPOTHETICAL',
  other: 'SCENARIO',
};

function isLatLon(v: unknown): v is LatLon {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.latitude === 'number' && typeof o.longitude === 'number' && Number.isFinite(o.latitude) && Number.isFinite(o.longitude);
}

/** Last known position as echoed by the backend in input_summary. */
export function getLastKnownPosition(result: AnalysisResponse | null): LatLon | null {
  const v = result?.input_summary?.last_known_position?.value;
  return isLatLon(v) ? v : null;
}

export function getInputNumber(result: AnalysisResponse | null, key: keyof AnalysisResponse['input_summary']): number | null {
  const v = result?.input_summary?.[key]?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Scenarios other than the baseline (the sensitivity cases). */
export function sensitivityScenarios(result: AnalysisResponse | null): Scenario[] {
  return (result?.scenarios ?? []).filter((s) => scenarioKind(s) !== 'baseline');
}
