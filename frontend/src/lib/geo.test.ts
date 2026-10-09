import { describe, expect, it } from 'vitest';
import analyze from '../fixtures/analyze.sample.json';
import type { AnalysisResponse, GeoJSONGeometry } from '../api/types';
import {
  bboxToLeafletBounds,
  cellToBounds,
  geometryToLatLngs,
  latLonToLatLng,
  lngLatToLatLng,
  nmToLatDegrees,
  nmToLngDegrees,
  unwrapGeometry,
  unwrapLng,
} from './geo';

const sample = analyze as unknown as AnalysisResponse;

describe('lngLatToLatLng / latLonToLatLng', () => {
  it('swaps GeoJSON [lng, lat] into Leaflet [lat, lng]', () => {
    expect(lngLatToLatLng([86.5, 13.8])).toEqual([13.8, 86.5]);
  });
  it('reads named API points without ambiguity', () => {
    expect(latLonToLatLng({ latitude: -12.5, longitude: 45 })).toEqual([-12.5, 45]);
  });
  it('real sample region coordinates land near the Bay of Bengal demo (not mirrored)', () => {
    const polys = geometryToLatLngs(sample.search_region.geometry);
    for (const ring of polys[0]!) {
      for (const [lat, lng] of ring) {
        expect(lat).toBeGreaterThan(9);
        expect(lat).toBeLessThan(15);
        expect(lng).toBeGreaterThan(85);
        expect(lng).toBeLessThan(90);
      }
    }
  });
});

describe('unwrapLng (antimeridian)', () => {
  it('keeps longitudes within 180 degrees of the reference', () => {
    expect(unwrapLng(-179.5, 179.5)).toBeCloseTo(180.5);
    expect(unwrapLng(179.5, -179.5)).toBeCloseTo(-180.5);
    expect(unwrapLng(10, 0)).toBe(10);
  });
  it('makes an antimeridian MultiPolygon contiguous for display', () => {
    const geom: GeoJSONGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[179, -10], [180, -10], [180, -9], [179, -9], [179, -10]]],
        [[[-180, -10], [-179, -10], [-179, -9], [-180, -9], [-180, -10]]],
      ],
    };
    const out = unwrapGeometry(geom, 179.7);
    expect(out.type).toBe('MultiPolygon');
    const lngs = (out.coordinates as number[][][][]).flat(2).map((p) => p[0]!);
    expect(Math.min(...lngs)).toBe(179);
    expect(Math.max(...lngs)).toBe(181);
    const latlngs = geometryToLatLngs(geom, 179.7);
    expect(latlngs[1]![0]![1]).toEqual([-10, 181]);
  });
});

describe('bboxToLeafletBounds', () => {
  it('converts normal bounds to [[south, west], [north, east]]', () => {
    expect(bboxToLeafletBounds({ min_lat: 10, min_lon: 86, max_lat: 14, max_lon: 88 })).toEqual([
      [10, 86],
      [14, 88],
    ]);
  });
  it('handles RFC 7946 antimeridian bounds (min_lon > max_lon)', () => {
    const [[s, w], [n, e]] = bboxToLeafletBounds({ min_lat: -11, min_lon: 178, max_lat: -9, max_lon: -177 });
    expect([s, n]).toEqual([-11, -9]);
    expect(w).toBe(178);
    expect(e).toBe(183);
  });
  it('shifts next to a reference longitude', () => {
    const [[, w], [, e]] = bboxToLeafletBounds({ min_lat: -11, min_lon: 178, max_lat: -9, max_lon: -177 }, -179);
    expect(w).toBe(-182);
    expect(e).toBe(-177);
  });
  it('works on the real sample bounds', () => {
    const b = sample.search_region.properties.bounds;
    const [[s, w], [n, e]] = bboxToLeafletBounds(b);
    expect(s).toBe(b.min_lat);
    expect(n).toBe(b.max_lat);
    expect(w).toBeLessThan(e);
  });
});

describe('cellToBounds', () => {
  it('builds an approximate rectangle from centre +/- half cell size', () => {
    const [[s, w], [n, e]] = cellToBounds({ centre_latitude: 0, centre_longitude: 10 }, { width_nm: 60, height_nm: 60 });
    expect(n - s).toBeCloseTo(1);
    expect(e - w).toBeCloseTo(1);
    expect((s + n) / 2).toBeCloseTo(0);
    expect((w + e) / 2).toBeCloseTo(10);
  });
  it('widens longitude span with latitude (1 / cos lat)', () => {
    expect(nmToLatDegrees(60)).toBe(1);
    expect(nmToLngDegrees(60, 60)).toBeCloseTo(2);
    const [[, w], [, e]] = cellToBounds({ centre_latitude: 60, centre_longitude: 0 }, { width_nm: 60, height_nm: 60 });
    expect(e - w).toBeCloseTo(2);
  });
  it('unwraps cells near the antimeridian', () => {
    const [[, w], [, e]] = cellToBounds({ centre_latitude: 0, centre_longitude: -179.9 }, { width_nm: 30, height_nm: 30 }, 179.8);
    expect(w).toBeGreaterThan(179.8);
    expect(e).toBeGreaterThan(180);
  });
  it('matches the backend cell geometry approximately for the real sample', () => {
    const cell = sample.grid.cells[24]!;
    const [[s, w], [n, e]] = cellToBounds(cell, sample.grid.cell_size_nm);
    const ring = geometryToLatLngs(cell.geometry)[0]![0]!;
    const lats = ring.map((p) => p[0]);
    const lngs = ring.map((p) => p[1]);
    expect(s).toBeCloseTo(Math.min(...lats), 1);
    expect(n).toBeCloseTo(Math.max(...lats), 1);
    expect(w).toBeCloseTo(Math.min(...lngs), 1);
    expect(e).toBeCloseTo(Math.max(...lngs), 1);
  });
});
