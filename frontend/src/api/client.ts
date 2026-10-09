import axios from 'axios';

const DEFAULT_BASE_URL = 'http://localhost:8000';

/** Base URL of the FastAPI backend, from VITE_API_BASE_URL (no secrets here). */
export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || DEFAULT_BASE_URL
).replace(/\/+$/, '');

export const REQUEST_TIMEOUT_MS = 20_000;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});
