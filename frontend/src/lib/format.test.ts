import { describe, expect, it } from 'vitest';
import { EM_DASH, formatArea, formatDegrees, formatLat, formatLatLon, formatLon, formatMinutes, formatNm, formatPercent, formatScore } from './format';

describe('formatters', () => {
  it('formats coordinates with hemispheres', () => {
    expect(formatLat(13.8)).toBe('13.8000° N');
    expect(formatLat(-33.12345, 2)).toBe('33.12° S');
    expect(formatLon(86.5)).toBe('86.5000° E');
    expect(formatLon(-179.9, 1)).toBe('179.9° W');
    expect(formatLat(0, 1)).toBe('0.0°');
    expect(formatLatLon(10.913717, 87.561833)).toBe('10.9137° N, 87.5618° E');
  });
  it('formats nautical miles, degrees, minutes, percent, area, score', () => {
    expect(formatNm(183.333)).toBe('183.3 nm');
    expect(formatNm(1234.5, 0)).toBe('1,235 nm');
    expect(formatDegrees(160)).toBe('160.0°');
    expect(formatMinutes(50)).toBe('50 min');
    expect(formatPercent(40)).toBe('40%');
    expect(formatArea(10478.9)).toBe('10,479 nm²');
    expect(formatScore(0.9984)).toBe('1.00');
  });
  it('renders an em dash for null, undefined and non-finite values', () => {
    for (const fn of [formatLat, formatLon, formatNm, formatDegrees, formatMinutes, formatPercent, formatArea, formatScore]) {
      expect(fn(null)).toBe(EM_DASH);
      expect(fn(undefined)).toBe(EM_DASH);
      expect(fn(Number.NaN)).toBe(EM_DASH);
    }
    expect(formatLatLon(null, 5)).toBe(EM_DASH);
  });
});
