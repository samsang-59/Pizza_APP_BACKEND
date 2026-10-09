import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError, normalizeError, type AppError } from '../api/errors';

/** Small fetch-once helper with reload, used for profiles and methodology. */
export function useApiResource<T>(fetcher: (opts: { signal: AbortSignal }) => Promise<T>, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher({ signal: controller.signal });
      if (!controller.signal.aborted) setData(res);
    } catch (err) {
      if (!isAbortError(err) && !controller.signal.aborted) setError(normalizeError(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (enabled && data === null) void load();
  }, [enabled, data, load]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { data, error, isLoading, reload: load };
}
