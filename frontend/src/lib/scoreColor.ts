/**
 * Restrained single-hue (cyan) ramp for illustrative relative demo scores.
 * Lightness and opacity both increase with the score so the ramp still reads
 * without colour vision; values are relative demo values, NOT probabilities.
 */
const LOW = { r: 18, g: 44, b: 66 }; // deep blue-slate
const HIGH = { r: 66, g: 217, b: 255 }; // accent cyan

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function scoreColor(score: number): string {
  const t = clamp01(score);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(LOW.r, HIGH.r)}, ${mix(LOW.g, HIGH.g)}, ${mix(LOW.b, HIGH.b)})`;
}

/** Fill opacity for map/grid cells; cells outside the region are faint. */
export function scoreOpacity(score: number, intersectsRegion: boolean): number {
  if (!intersectsRegion) return 0.06;
  return 0.12 + 0.5 * clamp01(score);
}

/** Text colour that stays readable on top of scoreColor(score). */
export function scoreTextColor(score: number): string {
  return clamp01(score) > 0.55 ? '#070B14' : '#F4F7FB';
}

export const SCORE_LEGEND_STOPS = [0, 0.25, 0.5, 0.75, 1].map((s) => ({ score: s, color: scoreColor(s) }));
