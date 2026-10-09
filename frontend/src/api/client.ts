import axios from 'axios';

const DEFAULT_BASE_URL = 'http://localhost:8000';

/**
 * Resolve the backend base URL from VITE_API_BASE_URL.
 *  - unset / empty  -> http://localhost:8000 (separate backend, e.g. `npm run dev`)
 *  - "/"            -> "" (same origin: the backend serves this built app)
 *  - anything else  -> used as-is, without trailing slashes
 */
export function resolveApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_BASE_URL;
  return value.replace(/\/+$/, '');
}

/** Base URL of the FastAPI backend ("" = same origin). No secrets here. */
export const API_BASE_URL: string = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);

export const REQUEST_TIMEOUT_MS = 20_000;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});
