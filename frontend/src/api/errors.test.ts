import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import validation from '../fixtures/validation-error.sample.json';
import distance from '../fixtures/distance-error.sample.json';
import { locToFormField, normalizeError, parseErrorBody } from './errors';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function axiosResponseError(status: number, data: unknown) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, { status, statusText: '', data, headers: {}, config });
}

describe('normalizeError', () => {
  it('maps the real backend 422 envelope onto form fields', () => {
    const err = normalizeError(axiosResponseError(422, validation));
    expect(err.kind).toBe('validation');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fieldErrors).toEqual({
      latitude: 'Input should be less than or equal to 90',
      heading_degrees: 'Input should be less than 360',
      fuel_remaining_percent: 'Input should be less than or equal to 100',
    });
    expect(err.otherDetails).toEqual([]);
    expect(err.retryable).toBe(false);
  });

  it('keeps body-level details (5000 nm cross-field rule) as unmapped details', () => {
    const err = normalizeError(axiosResponseError(422, distance));
    expect(err.kind).toBe('validation');
    expect(Object.keys(err.fieldErrors)).toHaveLength(0);
    expect(err.otherDetails[0]).toMatch(/5000 nm/);
  });

  it('handles network failures (no response) as retryable', () => {
    const err = normalizeError(new AxiosError('Network Error', 'ERR_NETWORK', config));
    expect(err.kind).toBe('network');
    expect(err.retryable).toBe(true);
  });

  it('handles timeouts', () => {
    const err = normalizeError(new AxiosError('timeout of 20000ms exceeded', 'ECONNABORTED', config));
    expect(err.kind).toBe('timeout');
    expect(err.retryable).toBe(true);
  });

  it('handles 500 envelopes and unknown errors', () => {
    const err = normalizeError(
      axiosResponseError(500, { status: 'error', error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: [] } }),
    );
    expect(err.kind).toBe('server');
    expect(err.message).toBe('An internal error occurred.');
    expect(normalizeError(new Error('boom')).kind).toBe('unknown');
  });

  it("defensively parses FastAPI's default {detail: [...]} shape", () => {
    const err = parseErrorBody(422, { detail: [{ loc: ['body', 'wind', 'speed_knots'], msg: 'too high', type: 'x' }, { loc: ['query'], msg: 'odd' }] });
    expect(err.fieldErrors.wind_speed_knots).toBe('too high');
    expect(err.otherDetails).toEqual(['odd']);
    expect(parseErrorBody(404, { detail: 'Not Found' }).message).toBe('Not Found');
  });

  it('skips metadata-only details such as GEOMETRY_ERROR {geometry, pole}', () => {
    const err = parseErrorBody(422, {
      status: 'error',
      error: { code: 'GEOMETRY_ERROR', message: 'The search region reaches within 10 nm of the North Pole', details: [{ geometry: 'search region', pole: 'north' }] },
    });
    expect(err.code).toBe('GEOMETRY_ERROR');
    expect(err.otherDetails).toEqual([]);
    expect(err.message).toMatch(/North Pole/);
  });

  it('maps backend loc paths to form fields', () => {
    expect(locToFormField(['body', 'last_known_position', 'longitude'])).toBe('longitude');
    expect(locToFormField(['body', 'wind', 'direction_from_degrees'])).toBe('wind_direction_from_degrees');
    expect(locToFormField(['body'])).toBeUndefined();
  });
});
