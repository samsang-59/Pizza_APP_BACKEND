import axios from 'axios';

export type AppErrorKind = 'network' | 'timeout' | 'validation' | 'server' | 'unknown';

/** Form field names used by MissionParametersForm. */
export type FormFieldName =
  | 'latitude'
  | 'longitude'
  | 'heading_degrees'
  | 'ground_speed_knots'
  | 'elapsed_minutes'
  | 'wind_speed_knots'
  | 'wind_direction_from_degrees'
  | 'aircraft_type'
  | 'fuel_remaining_percent'
  | 'position_uncertainty_nm'
  | 'heading_uncertainty_degrees'
  | 'search_region_buffer_nm'
  | 'grid_size';

export interface AppError {
  kind: AppErrorKind;
  message: string;
  status?: number;
  /** Backend error code (VALIDATION_ERROR, GEOMETRY_ERROR, ...). */
  code?: string;
  /** Errors that map onto a form field. */
  fieldErrors: Partial<Record<FormFieldName, string>>;
  /** Details that could not be mapped onto a field. */
  otherDetails: string[];
  retryable: boolean;
}

const LOC_TO_FIELD: Record<string, FormFieldName> = {
  'last_known_position.latitude': 'latitude',
  'last_known_position.longitude': 'longitude',
  heading_degrees: 'heading_degrees',
  ground_speed_knots: 'ground_speed_knots',
  elapsed_minutes: 'elapsed_minutes',
  'wind.speed_knots': 'wind_speed_knots',
  'wind.direction_from_degrees': 'wind_direction_from_degrees',
  aircraft_type: 'aircraft_type',
  fuel_remaining_percent: 'fuel_remaining_percent',
  position_uncertainty_nm: 'position_uncertainty_nm',
  heading_uncertainty_degrees: 'heading_uncertainty_degrees',
  search_region_buffer_nm: 'search_region_buffer_nm',
  grid_size: 'grid_size',
};

/** Map a backend `loc` (e.g. ["body","wind","speed_knots"]) to a form field. */
export function locToFormField(loc: readonly (string | number)[] | undefined): FormFieldName | undefined {
  if (!loc || loc.length === 0) return undefined;
  const parts = loc.map(String);
  const trimmed = parts[0] === 'body' ? parts.slice(1) : parts;
  return LOC_TO_FIELD[trimmed.join('.')];
}

interface RawDetail {
  loc?: unknown;
  field?: unknown;
  message?: unknown;
  msg?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function detailMessage(d: RawDetail): string {
  if (typeof d.message === 'string') return d.message;
  if (typeof d.msg === 'string') return d.msg;
  return 'Invalid value';
}

function detailLoc(d: RawDetail): (string | number)[] | undefined {
  if (Array.isArray(d.loc)) return d.loc.filter((x): x is string | number => typeof x === 'string' || typeof x === 'number');
  if (typeof d.field === 'string') return d.field.split('.');
  return undefined;
}

function splitDetails(details: unknown[]): Pick<AppError, 'fieldErrors' | 'otherDetails'> {
  const fieldErrors: AppError['fieldErrors'] = {};
  const otherDetails: string[] = [];
  for (const raw of details) {
    if (!isRecord(raw)) {
      if (typeof raw === 'string') otherDetails.push(raw);
      continue;
    }
    const d = raw as RawDetail;
    const msg = detailMessage(d);
    const field = locToFormField(detailLoc(d));
    if (field && !fieldErrors[field]) fieldErrors[field] = msg;
    else otherDetails.push(msg);
  }
  return { fieldErrors, otherDetails };
}

/** Parse an error response body (SkyTrace envelope or FastAPI default). */
export function parseErrorBody(status: number, body: unknown): AppError {
  const kind: AppErrorKind = status === 422 || status === 400 ? 'validation' : status >= 500 ? 'server' : 'unknown';
  const base = { kind, status, retryable: kind === 'server', fieldErrors: {}, otherDetails: [] as string[] };

  if (isRecord(body) && body.status === 'error' && isRecord(body.error)) {
    const err = body.error;
    const details = Array.isArray(err.details) ? err.details : [];
    return {
      ...base,
      code: typeof err.code === 'string' ? err.code : undefined,
      message: typeof err.message === 'string' ? err.message : 'The request failed.',
      ...splitDetails(details),
    };
  }
  if (isRecord(body) && 'detail' in body) {
    const detail = body.detail;
    if (Array.isArray(detail)) {
      return { ...base, message: 'Request validation failed; see details for each invalid field.', ...splitDetails(detail) };
    }
    if (typeof detail === 'string') return { ...base, message: detail };
  }
  return {
    ...base,
    message: kind === 'server' ? 'The analysis service returned an internal error.' : `Request failed (HTTP ${status}).`,
  };
}

export function isAbortError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Normalize anything thrown by the API layer into one AppError shape. */
export function normalizeError(err: unknown): AppError {
  const empty = { fieldErrors: {}, otherDetails: [] };
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return { ...empty, kind: 'timeout', message: 'The backend took too long to respond. Please retry.', retryable: true };
    }
    if (err.response) {
      return parseErrorBody(err.response.status, err.response.data);
    }
    return {
      ...empty,
      kind: 'network',
      message: 'Cannot reach the SkyTrace backend. Check that it is running and reachable, then retry.',
      retryable: true,
    };
  }
  const message = err instanceof Error && err.message ? err.message : 'An unexpected error occurred.';
  return { ...empty, kind: 'unknown', message, retryable: true };
}
