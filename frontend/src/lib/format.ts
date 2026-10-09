/** Display formatters. Missing/invalid values render as an em dash. */
export const EM_DASH = '—';

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function formatNumber(v: number | null | undefined, decimals = 1): string {
  if (!isNum(v)) return EM_DASH;
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatLat(lat: number | null | undefined, decimals = 4): string {
  if (!isNum(lat)) return EM_DASH;
  const hemi = lat > 0 ? 'N' : lat < 0 ? 'S' : '';
  return `${Math.abs(lat).toFixed(decimals)}°${hemi ? ` ${hemi}` : ''}`;
}

export function formatLon(lon: number | null | undefined, decimals = 4): string {
  if (!isNum(lon)) return EM_DASH;
  const hemi = lon > 0 ? 'E' : lon < 0 ? 'W' : '';
  return `${Math.abs(lon).toFixed(decimals)}°${hemi ? ` ${hemi}` : ''}`;
}

export function formatLatLon(lat: number | null | undefined, lon: number | null | undefined, decimals = 4): string {
  if (!isNum(lat) || !isNum(lon)) return EM_DASH;
  return `${formatLat(lat, decimals)}, ${formatLon(lon, decimals)}`;
}

export function formatNm(v: number | null | undefined, decimals = 1): string {
  return isNum(v) ? `${formatNumber(v, decimals)} nm` : EM_DASH;
}

export function formatDegrees(v: number | null | undefined, decimals = 1): string {
  return isNum(v) ? `${v.toFixed(decimals)}°` : EM_DASH;
}

export function formatMinutes(v: number | null | undefined): string {
  return isNum(v) ? `${formatNumber(v, v % 1 === 0 ? 0 : 1)} min` : EM_DASH;
}

export function formatPercent(v: number | null | undefined, decimals = 0): string {
  return isNum(v) ? `${v.toFixed(decimals)}%` : EM_DASH;
}

export function formatArea(v: number | null | undefined): string {
  return isNum(v) ? `${formatNumber(v, 0)} nm²` : EM_DASH;
}

export function formatScore(v: number | null | undefined): string {
  return isNum(v) ? v.toFixed(2) : EM_DASH;
}
