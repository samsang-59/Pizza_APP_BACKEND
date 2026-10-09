import { useCallback, useEffect, useRef, useState } from 'react';
import { getDemoScenario } from '../api/endpoints';
import { isAbortError, normalizeError, type AppError } from '../api/errors';
import type { DemoScenarioResponse } from '../api/types';

/** Fetches GET /api/v1/demo-scenario. No local fallback data, by design. */
export function useDemoScenario() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const load = useCallback(async (): Promise<DemoScenarioResponse | null> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await getDemoScenario({ signal: controller.signal });
      return data;
    } catch (err) {
      if (!isAbortError(err)) setError(normalizeError(err));
      return null;
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  }, []);

  return { load, isLoading, error, clearError: () => setError(null) };
}
