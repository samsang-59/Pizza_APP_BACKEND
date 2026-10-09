import { describe, expect, it } from 'vitest';
import demo from '../fixtures/demo-scenario.sample.json';
import type { AnalysisRequest } from '../api/types';
import { EMPTY_FORM_VALUES, buildAnalysisPayload, missionFormSchema, requestToFormValues, type MissionFormValues } from './schema';

const valid: MissionFormValues = {
  ...EMPTY_FORM_VALUES,
  latitude: '13.8',
  longitude: '86.5',
  heading_degrees: '160',
  ground_speed_knots: '220',
  elapsed_minutes: '50',
  wind_speed_knots: '18',
  wind_direction_from_degrees: '240',
  aircraft_type: 'generic_turboprop',
  fuel_remaining_percent: '40',
};

function issues(values: MissionFormValues) {
  const r = missionFormSchema.safeParse(values);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('form -> payload mapping', () => {
  it('omits unset optional fields so backend defaults apply, and emits numbers', () => {
    const parsed = missionFormSchema.parse(valid);
    const payload = buildAnalysisPayload(parsed);
    expect(payload).toEqual({
      last_known_position: { latitude: 13.8, longitude: 86.5 },
      heading_degrees: 160,
      ground_speed_knots: 220,
      elapsed_minutes: 50,
      wind: { speed_knots: 18, direction_from_degrees: 240 },
      aircraft_type: 'generic_turboprop',
      fuel_remaining_percent: 40,
    });
    expect('grid_size' in payload).toBe(false);
    expect('position_uncertainty_nm' in payload).toBe(false);
    for (const v of [payload.heading_degrees, payload.ground_speed_knots, payload.last_known_position.latitude]) {
      expect(typeof v).toBe('number');
    }
  });

  it('includes optional fields when set, as numbers (grid_size integer)', () => {
    const payload = buildAnalysisPayload(
      missionFormSchema.parse({ ...valid, grid_size: '7', position_uncertainty_nm: '2.5', heading_uncertainty_degrees: '0', search_region_buffer_nm: '12' }),
    );
    expect(payload.grid_size).toBe(7);
    expect(payload.position_uncertainty_nm).toBe(2.5);
    expect(payload.heading_uncertainty_degrees).toBe(0);
    expect(payload.search_region_buffer_nm).toBe(12);
  });

  it('round-trips the real demo scenario exactly', () => {
    const values = requestToFormValues(demo as AnalysisRequest);
    expect(buildAnalysisPayload(missionFormSchema.parse(values))).toEqual(demo);
  });
});

describe('validation rules mirror the backend', () => {
  it('requires fields and rejects non-numbers', () => {
    expect(issues({ ...valid, latitude: '' }).latitude).toBe('Required.');
    expect(issues({ ...valid, heading_degrees: 'abc' }).heading_degrees).toBe('Enter a number.');
    expect(issues({ ...valid, aircraft_type: 'boeing' }).aircraft_type).toBeDefined();
  });
  it('rejects |latitude| > 89 even though it is within [-90, 90]', () => {
    expect(issues({ ...valid, latitude: '89.5' }).latitude).toMatch(/Polar/);
    expect(issues({ ...valid, latitude: '-89.01' }).latitude).toMatch(/Polar/);
    expect(issues({ ...valid, latitude: '89' }).latitude).toBeUndefined();
    expect(issues({ ...valid, latitude: '91' }).latitude).toMatch(/between -90 and 90/);
  });
  it('treats 360 as out of range for heading and wind direction', () => {
    expect(issues({ ...valid, heading_degrees: '360' }).heading_degrees).toBeDefined();
    expect(issues({ ...valid, wind_direction_from_degrees: '360' }).wind_direction_from_degrees).toBeDefined();
    expect(issues({ ...valid, heading_degrees: '359.9' }).heading_degrees).toBeUndefined();
    expect(issues({ ...valid, heading_degrees: '-1' }).heading_degrees).toBeDefined();
  });
  it('enforces ranges for speed, time, wind, fuel and advanced fields', () => {
    expect(issues({ ...valid, ground_speed_knots: '701' }).ground_speed_knots).toBeDefined();
    expect(issues({ ...valid, elapsed_minutes: '1441' }).elapsed_minutes).toBeDefined();
    expect(issues({ ...valid, wind_speed_knots: '201' }).wind_speed_knots).toBeDefined();
    expect(issues({ ...valid, fuel_remaining_percent: '100.1' }).fuel_remaining_percent).toBeDefined();
    expect(issues({ ...valid, fuel_remaining_percent: '-1' }).fuel_remaining_percent).toBeDefined();
    expect(issues({ ...valid, grid_size: '2' }).grid_size).toBeDefined();
    expect(issues({ ...valid, grid_size: '5.5' }).grid_size).toBe('Must be a whole number.');
    expect(issues({ ...valid, heading_uncertainty_degrees: '46' }).heading_uncertainty_degrees).toBeDefined();
  });
  it('applies the 5000 nm cross-field rule on elapsed time', () => {
    const msg = issues({ ...valid, ground_speed_knots: '700', elapsed_minutes: '600' }).elapsed_minutes;
    expect(msg).toMatch(/7,000 nm/);
    expect(msg).toMatch(/5,000 nm/);
    expect(issues({ ...valid, ground_speed_knots: '500', elapsed_minutes: '600' }).elapsed_minutes).toBeUndefined();
  });
});
