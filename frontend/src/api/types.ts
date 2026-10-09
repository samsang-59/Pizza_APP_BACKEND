/**
 * API types for the SkyTrace AI backend (schema_version 1.0.0).
 *
 * Derived from backend/docs/frontend_types.ts and verified against real
 * responses captured in src/fixtures/*.sample.json. The backend schema is the
 * source of truth: if they ever disagree, follow the backend.
 *
 * All outputs are illustrative demonstration values.
 */

// ----------------------------- Request ------------------------------------

export type AircraftType = "generic_light_aircraft" | "generic_turboprop" | "generic_jet";

export interface Position {
  /** degrees, WGS84, |lat| <= 89 */
  latitude: number;
  /** degrees, WGS84, [-180, 180] */
  longitude: number;
}

export interface Wind {
  /** knots, 0..200 */
  speed_knots: number;
  /** degrees true the wind blows FROM, [0, 360) */
  direction_from_degrees: number;
}

export interface AnalysisRequest {
  last_known_position: Position;
  /** degrees true [0, 360); treated as GROUND TRACK */
  heading_degrees: number;
  /** knots ground speed (not airspeed), 0..700 */
  ground_speed_knots: number;
  /** minutes, 0..1440; speed*minutes/60 must be <= 5000 nm */
  elapsed_minutes: number;
  wind: Wind;
  aircraft_type: AircraftType;
  /** percent 0..100 (context only) */
  fuel_remaining_percent: number;
  /** nm 0..100, default 5 */
  position_uncertainty_nm?: number;
  /** degrees 0..45, default 10 */
  heading_uncertainty_degrees?: number;
  /** integer 3..15, default 5 */
  grid_size?: number;
  /** nm 0..200, default 10 */
  search_region_buffer_nm?: number;
}

// ----------------------------- Response -----------------------------------

export interface LatLon {
  latitude: number;
  longitude: number;
}

/** GeoJSON position: [longitude, latitude] */
export type GeoJSONPosition = [number, number];

export type GeoJSONGeometry =
  | { type: "Polygon"; coordinates: GeoJSONPosition[][] }
  | { type: "MultiPolygon"; coordinates: GeoJSONPosition[][][] };

export interface Baseline {
  distance_nm: number;
  endpoint: LatLon;
  heading_degrees: number;
  interpretation: "ground track";
}

export type ScenarioType =
  | "baseline_ground_track"
  | "heading_sensitivity"
  | "heading_sensitivity_outer"
  | "wind_sensitivity_hypothetical"
  | (string & {});

export type ScenarioId =
  | "baseline"
  | "heading_minus"
  | "heading_plus"
  | "heading_minus_2x"
  | "heading_plus_2x"
  | "hypothetical_wind_drift"
  // tolerate ids added by future backend versions
  | (string & {});

export interface Scenario {
  scenario_id: ScenarioId;
  scenario_name: string;
  scenario_type: ScenarioType;
  endpoint: LatLon;
  distance_nm: number;
  heading_degrees_used: number;
  /** geodesic distance from the baseline endpoint, nm */
  offset_from_baseline_nm: number;
  included_in_region: boolean;
  description: string;
  assumptions: string[];
}

export interface Bounds {
  min_lat: number;
  /** western edge; > max_lon when crossing the antimeridian */
  min_lon: number;
  max_lat: number;
  /** eastern edge */
  max_lon: number;
}

export interface RegionProperties {
  label: "Illustrative search region";
  /** approximate (computed in the local AEQD projection) */
  area_sq_nm: number;
  area_note: string;
  bounds: Bounds;
  crosses_antimeridian: boolean;
  buffer_nm_applied: number;
  buffer_rule: string;
  included_scenarios: ScenarioId[];
  method: string;
  orientation: string;
  disclaimer: string;
}

export interface SearchRegionFeature {
  type: "Feature";
  geometry: GeoJSONGeometry;
  properties: RegionProperties;
}

export interface GridCell {
  /** "r{row}c{column}" */
  cell_id: string;
  /** 0 = northernmost */
  row: number;
  /** 0 = westernmost */
  column: number;
  centre_latitude: number;
  centre_longitude: number;
  intersects_region: boolean;
  /** [0, 1]; relative demo value, NOT a probability */
  illustrative_relative_demo_score: number;
  geometry: GeoJSONGeometry;
}

export interface Grid {
  rows: number;
  columns: number;
  ordering: string;
  score_type: "illustrative_relative_demo_score";
  score_description: string;
  sigma_nm: number;
  cell_size_nm: { width_nm: number; height_nm: number };
  /** row-major: index = row * columns + column */
  cells: GridCell[];
}

export interface FuelContext {
  remaining_percent: number;
  aircraft_type: AircraftType;
  endurance_minutes: null;
  affects_geometry: false;
  explanation: string;
}

export interface WindContext {
  speed_knots: number;
  direction_from_degrees: number;
  direction_toward_degrees: number;
  description: string;
  applied_to_baseline: false;
  hypothetical_scenario_included: boolean;
  limitations: string[];
}

export interface InputValue<T = unknown> {
  value: T;
  units: string;
}

export interface AnalysisResponse {
  schema_version: string;
  /** uuid5 of the canonical input JSON (deterministic) */
  analysis_id: string;
  status: "success";
  input_summary: Record<keyof AnalysisRequest, InputValue>;
  baseline: Baseline;
  scenarios: Scenario[];
  search_region: SearchRegionFeature;
  grid: Grid;
  fuel_context: FuelContext;
  wind_context: WindContext;
  explanation: string;
  assumptions: string[];
  warnings: string[];
  disclaimer: string;
}

// ----------------------------- Errors -------------------------------------

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PROJECTION_ERROR"
  | "GEOMETRY_ERROR"
  | "INTERNAL_ERROR"
  | "HTTP_ERROR";

export interface ErrorDetail {
  /** dotted path, e.g. "body.wind.speed_knots" */
  field?: string;
  loc?: string[];
  message?: string;
  type?: string;
  constraints?: Record<string, string | number | boolean>;
  [key: string]: unknown;
}

export interface ErrorResponse {
  status: "error";
  error: { code: ErrorCode; message: string; details: ErrorDetail[] };
}

export type AnalyzeResult = AnalysisResponse | ErrorResponse;

// ----------------------------- Other endpoints ----------------------------

export interface AircraftProfile {
  aircraft_type: AircraftType;
  display_name: string;
  description: string;
}

export interface AircraftProfilesResponse {
  note: string;
  affects_calculations: false;
  profiles: AircraftProfile[];
}

export interface MethodologyResponse {
  title: string;
  summary: string;
  steps: { name: string; detail: string }[];
  assumptions: string[];
  wind_limitations: string[];
  fuel_limitations: string;
  limitations: string[];
  disclaimer: string;
}

/** GET /api/v1/demo-scenario returns a complete AnalysisRequest. */
export type DemoScenarioResponse = Required<AnalysisRequest>;

export interface HealthResponse {
  status: string;
}

/** FastAPI default validation shape (handled defensively). */
export interface FastApiDefaultError {
  detail: string | { loc?: (string | number)[]; msg?: string; type?: string }[];
}
