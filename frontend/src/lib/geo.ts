/**
 * Coordinate helpers. THE single place where GeoJSON [lng, lat] is turned into
 * Leaflet [lat, lng]. Components must use these functions rather than
 * swapping coordinates inline.
 *
 * Antimeridian: the backend splits regions crossing +/-180 into a
 * MultiPolygon with longitudes in [-180, 180]. Drawn as-is, the two halves
 * would appear on opposite edges of the map. For display we "unwrap" every
 * longitude to within 180 degrees of a reference longitude (the last known
 * position), so the halves sit side by side; Leaflet accepts lng > 180.
 */
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import type { Bounds, GeoJSONGeometry, GeoJSONPosition, GridCell, LatLon } from '../api/types';

export const NM_PER_DEGREE_LAT = 60;

/** GeoJSON [lng, lat] -> Leaflet [lat, lng]. */
export function lngLatToLatLng(position: GeoJSONPosition, refLng?: number): LatLngTuple {
  const [lng, lat] = position;
  return [lat, refLng === undefined ? lng : unwrapLng(lng, refLng)];
}

/** API point {latitude, longitude} -> Leaflet [lat, lng]. */
export function latLonToLatLng(point: LatLon, refLng?: number): LatLngTuple {
  return [point.latitude, refLng === undefined ? point.longitude : unwrapLng(point.longitude, refLng)];
}

/** Shift lng by multiples of 360 so it lies within (ref - 180, ref + 180]. */
export function unwrapLng(lng: number, refLng: number): number {
  let out = lng;
  while (out - refLng > 180) out -= 360;
  while (out - refLng <= -180) out += 360;
  return out;
}

/** Polygon/MultiPolygon -> list of polygons, each a list of rings of Leaflet [lat, lng]. */
export function geometryToLatLngs(geometry: GeoJSONGeometry, refLng?: number): LatLngTuple[][][] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((rings) => rings.map((ring) => ring.map((p) => lngLatToLatLng(p, refLng))));
}

/** Return a copy of the geometry with longitudes unwrapped around refLng (still [lng, lat]). */
export function unwrapGeometry(geometry: GeoJSONGeometry, refLng: number): GeoJSONGeometry {
  const fix = (ring: GeoJSONPosition[]): GeoJSONPosition[] => ring.map(([lng, lat]) => [unwrapLng(lng, refLng), lat]);
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map(fix) };
  }
  return { type: 'MultiPolygon', coordinates: geometry.coordinates.map((poly) => poly.map(fix)) };
}

/**
 * Backend bounds -> Leaflet bounds [[south, west], [north, east]].
 * When the region crosses the antimeridian the backend reports
 * min_lon > max_lon (RFC 7946 section 5.2); the east edge is then max_lon + 360.
 * With refLng the result is shifted next to the reference longitude.
 */
export function bboxToLeafletBounds(bounds: Bounds, refLng?: number): [LatLngTuple, LatLngTuple] {
  let west = bounds.min_lon;
  let east = bounds.max_lon;
  if (west > east) east += 360;
  if (refLng !== undefined) {
    const centre = (west + east) / 2;
    const shifted = unwrapLng(centre, refLng) - centre;
    west += shifted;
    east += shifted;
  }
  return [
    [bounds.min_lat, west],
    [bounds.max_lat, east],
  ];
}

/** Degrees of latitude spanned by a north-south distance in nm. */
export function nmToLatDegrees(nm: number): number {
  return nm / NM_PER_DEGREE_LAT;
}

/** Degrees of longitude spanned by an east-west distance in nm at a latitude. */
export function nmToLngDegrees(nm: number, latitude: number): number {
  const cos = Math.cos((latitude * Math.PI) / 180);
  return nm / (NM_PER_DEGREE_LAT * Math.max(cos, 1e-6));
}

/**
 * APPROXIMATE rectangle around a grid cell centre (+/- half the cell size).
 * Used only as a fallback when a cell has no backend geometry; the backend's
 * own cell polygons are exact in its local projection.
 */
export function cellToBounds(
  cell: Pick<GridCell, 'centre_latitude' | 'centre_longitude'>,
  cellSize: { width_nm: number; height_nm: number },
  refLng?: number,
): [LatLngTuple, LatLngTuple] {
  const dLat = nmToLatDegrees(cellSize.height_nm) / 2;
  const dLng = nmToLngDegrees(cellSize.width_nm, cell.centre_latitude) / 2;
  const lng = refLng === undefined ? cell.centre_longitude : unwrapLng(cell.centre_longitude, refLng);
  const south = Math.max(-90, cell.centre_latitude - dLat);
  const north = Math.min(90, cell.centre_latitude + dLat);
  return [
    [south, lng - dLng],
    [north, lng + dLng],
  ];
}

/** Bounds covering a list of Leaflet points (for fitting markers). */
export function pointsToBounds(points: LatLngTuple[]): LatLngBoundsExpression | null {
  if (points.length === 0) return null;
  let s = Infinity;
  let w = Infinity;
  let n = -Infinity;
  let e = -Infinity;
  for (const [lat, lng] of points) {
    s = Math.min(s, lat);
    n = Math.max(n, lat);
    w = Math.min(w, lng);
    e = Math.max(e, lng);
  }
  return [
    [s, w],
    [n, e],
  ];
}
