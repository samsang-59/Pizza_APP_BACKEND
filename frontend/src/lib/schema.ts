/**
 * Form validation that mirrors the backend limits (backend/app/core/constants.py
 * and backend/app/schemas/requests.py). The backend remains the final
 * authority; its 422 responses are mapped back onto these same fields.
 *
 * Form values are kept as strings (exactly what the user typed, so nothing is
 * lost after a failed request) and parsed into numbers here.
 */
import { z } from 'zod';
import type { AircraftType, AnalysisRequest } from '../api/types';

export const LIMITS = {
  latitude: { min: -90, max: 90, maxAbsSupported: 89 },
  longitude: { min: -180, max: 180 },
  heading_degrees: { min: 0, maxExclusive: 360 },
  ground_speed_knots: { min: 0, max: 700 },
  elapsed_minutes: { min: 0, max: 1440 },
  wind_speed_knots: { min: 0, max: 200 },
  wind_direction_from_degrees: { min: 0, maxExclusive: 360 },
  fuel_remaining_percent: { min: 0, max: 100 },
  position_uncertainty_nm: { min: 0, max: 100, default: 5 },
  heading_uncertainty_degrees: { min: 0, max: 45, default: 10 },
  search_region_buffer_nm: { min: 0, max: 200, default: 10 },
  grid_size: { min: 3, max: 15, default: 5 },
  maxBaselineDistanceNm: 5000,
} as const;

export const AIRCRAFT_TYPES = ['generic_light_aircraft', 'generic_turboprop', 'generic_jet'] as const satisfies readonly AircraftType[];

export const AIRCRAFT_TYPE_LABELS: Record<AircraftType, string> = {
  generic_light_aircraft: 'Generic light aircraft',
  generic_turboprop: 'Generic turboprop',
  generic_jet: 'Generic jet',
};

const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)$/;

function parseNumber(raw: string): number | null {
  const s = raw.trim();
  if (!NUMERIC.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

interface RangeOpts {
  min: number;
  max?: number;
  maxExclusive?: number;
  integer?: boolean;
  unit?: string;
}

function rangeMessage({ min, max, maxExclusive, unit }: RangeOpts): string {
  const u = unit ? ` ${unit}` : '';
  if (maxExclusive !== undefined) return `Must be from ${min} up to (but not including) ${maxExclusive}${u}.`;
  return `Must be between ${min} and ${max}${u}.`;
}

function checkRange(n: number, opts: RangeOpts): string | null {
  if (opts.integer && !Number.isInteger(n)) return 'Must be a whole number.';
  const tooHigh = opts.maxExclusive !== undefined ? n >= opts.maxExclusive : opts.max !== undefined && n > opts.max;
  if (n < opts.min || tooHigh) return rangeMessage(opts);
  return null;
}

/** Required numeric field held as a string. */
function requiredNumber(opts: RangeOpts) {
  return z.string().transform((raw, ctx) => {
    if (raw.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required.' });
      return z.NEVER;
    }
    const n = parseNumber(raw);
    if (n === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a number.' });
      return z.NEVER;
    }
    const err = checkRange(n, opts);
    if (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
      return z.NEVER;
    }
    return n;
  });
}

/** Optional numeric field: empty string -> undefined (omitted, backend default applies). */
function optionalNumber(opts: RangeOpts) {
  return z.string().transform((raw, ctx): number | undefined => {
    if (raw.trim() === '') return undefined;
    const n = parseNumber(raw);
    if (n === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a number or leave empty for the default.' });
      return z.NEVER;
    }
    const err = checkRange(n, opts);
    if (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
      return z.NEVER;
    }
    return n;
  });
}

export const missionFormSchema = z
  .object({
    latitude: requiredNumber({ ...LIMITS.latitude, unit: 'degrees' }).superRefine((lat, ctx) => {
      if (Math.abs(lat) > LIMITS.latitude.maxAbsSupported) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Polar positions (|latitude| > ${LIMITS.latitude.maxAbsSupported}°) are not supported in this version.`,
        });
      }
    }),
    longitude: requiredNumber({ ...LIMITS.longitude, unit: 'degrees' }),
    heading_degrees: requiredNumber({ ...LIMITS.heading_degrees, unit: 'degrees' }),
    ground_speed_knots: requiredNumber({ ...LIMITS.ground_speed_knots, unit: 'kt' }),
    elapsed_minutes: requiredNumber({ ...LIMITS.elapsed_minutes, unit: 'min' }),
    wind_speed_knots: requiredNumber({ ...LIMITS.wind_speed_knots, unit: 'kt' }),
    wind_direction_from_degrees: requiredNumber({ ...LIMITS.wind_direction_from_degrees, unit: 'degrees' }),
    aircraft_type: z.string().refine((v): v is AircraftType => (AIRCRAFT_TYPES as readonly string[]).includes(v), {
      message: 'Select an aircraft category.',
    }),
    fuel_remaining_percent: requiredNumber({ ...LIMITS.fuel_remaining_percent, unit: '%' }),
    position_uncertainty_nm: optionalNumber({ ...LIMITS.position_uncertainty_nm, unit: 'nm' }),
    heading_uncertainty_degrees: optionalNumber({ ...LIMITS.heading_uncertainty_degrees, unit: 'degrees' }),
    search_region_buffer_nm: optionalNumber({ ...LIMITS.search_region_buffer_nm, unit: 'nm' }),
    grid_size: optionalNumber({ ...LIMITS.grid_size, integer: true }),
  })
  .superRefine((v, ctx) => {
    const distance = (v.ground_speed_knots * v.elapsed_minutes) / 60;
    if (distance > LIMITS.maxBaselineDistanceNm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['elapsed_minutes'],
        message: `Speed × time gives ${Math.round(distance).toLocaleString('en-US')} nm; the maximum supported baseline distance is ${LIMITS.maxBaselineDistanceNm.toLocaleString('en-US')} nm.`,
      });
    }
  });

/** What the inputs hold (strings). */
export type MissionFormValues = z.input<typeof missionFormSchema>;
/** What validation produces (numbers / undefined). */
export type MissionFormParsed = z.output<typeof missionFormSchema>;

export const EMPTY_FORM_VALUES: MissionFormValues = {
  latitude: '',
  longitude: '',
  heading_degrees: '',
  ground_speed_knots: '',
  elapsed_minutes: '',
  wind_speed_knots: '',
  wind_direction_from_degrees: '',
  aircraft_type: '',
  fuel_remaining_percent: '',
  position_uncertainty_nm: '',
  heading_uncertainty_degrees: '',
  search_region_buffer_nm: '',
  grid_size: '',
};

/** Build the exact request body: numbers only, optional fields omitted when unset. */
export function buildAnalysisPayload(v: MissionFormParsed): AnalysisRequest {
  const payload: AnalysisRequest = {
    last_known_position: { latitude: v.latitude, longitude: v.longitude },
    heading_degrees: v.heading_degrees,
    ground_speed_knots: v.ground_speed_knots,
    elapsed_minutes: v.elapsed_minutes,
    wind: { speed_knots: v.wind_speed_knots, direction_from_degrees: v.wind_direction_from_degrees },
    aircraft_type: v.aircraft_type as AircraftType,
    fuel_remaining_percent: v.fuel_remaining_percent,
  };
  if (v.position_uncertainty_nm !== undefined) payload.position_uncertainty_nm = v.position_uncertainty_nm;
  if (v.heading_uncertainty_degrees !== undefined) payload.heading_uncertainty_degrees = v.heading_uncertainty_degrees;
  if (v.search_region_buffer_nm !== undefined) payload.search_region_buffer_nm = v.search_region_buffer_nm;
  if (v.grid_size !== undefined) payload.grid_size = v.grid_size;
  return payload;
}

/** Turn an API request (e.g. the demo scenario) into form values. */
export function requestToFormValues(r: Partial<AnalysisRequest>): MissionFormValues {
  const s = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? String(n) : '');
  return {
    latitude: s(r.last_known_position?.latitude),
    longitude: s(r.last_known_position?.longitude),
    heading_degrees: s(r.heading_degrees),
    ground_speed_knots: s(r.ground_speed_knots),
    elapsed_minutes: s(r.elapsed_minutes),
    wind_speed_knots: s(r.wind?.speed_knots),
    wind_direction_from_degrees: s(r.wind?.direction_from_degrees),
    aircraft_type: r.aircraft_type ?? '',
    fuel_remaining_percent: s(r.fuel_remaining_percent),
    position_uncertainty_nm: s(r.position_uncertainty_nm),
    heading_uncertainty_degrees: s(r.heading_uncertainty_degrees),
    search_region_buffer_nm: s(r.search_region_buffer_nm),
    grid_size: s(r.grid_size),
  };
}
