import { useCallback, useEffect, useRef, useState } from 'react';
import { postAnalyze } from '../api/endpoints';
import { isAbortError, normalizeError, type AppError } from '../api/errors';
import type { AnalysisRequest, AnalysisResponse } from '../api/types';

/**
 * Monotonic request counter: only the newest request may commit its result,
 * so a slow older response can never overwrite a newer one.
 */
export function createRequestSequencer() {
  let latest = 0;
  return {
    next(): number {
      latest += 1;
      return latest;
    },
    isLatest(id: number): boolean {
      return id === latest;
    },
    get current(): number {
      return latest;
    },
  };
}

export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AnalysisState {
  status: AnalysisStatus;
  /** Latest SUCCESSFUL result (kept when a newer request fails). */
  result: AnalysisResponse | null;
  /** Request number that produced `result`. */
  resultRequestId: number | null;
  error: AppError | null;
  /** True when `result` is from an earlier request because the latest one failed. */
  isStale: boolean;
  lastPayload: AnalysisRequest | null;
}

export interface UseAnalysisOptions {
  analyze?: (payload: AnalysisRequest, opts: { signal: AbortSignal }) => Promise<AnalysisResponse>;
}

const INITIAL: AnalysisState = {
  status: 'idle',
  result: null,
  resultRequestId: null,
  error: null,
  isStale: false,
  lastPayload: null,
};

export function useAnalysis({ analyze = postAnalyze }: UseAnalysisOptions = {}) {
  const [state, setState] = useState<AnalysisState>(INITIAL);
  const sequencer = useRef(createRequestSequencer());
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightKey = useRef<string | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (payload: AnalysisRequest): Promise<AnalysisResponse | null> => {
      const key = JSON.stringify(payload);
      // Duplicate-request prevention: identical payload already in flight.
      if (inFlightKey.current === key) return null;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      inFlightKey.current = key;
      const requestId = sequencer.current.next();
      setState((s) => ({ ...s, status: 'loading', error: null, lastPayload: payload }));

      try {
        const result = await analyze(payload, { signal: controller.signal });
        if (!sequencer.current.isLatest(requestId)) return null;
        setState({ status: 'success', result, resultRequestId: requestId, error: null, isStale: false, lastPayload: payload });
        return result;
      } catch (err) {
        if (!sequencer.current.isLatest(requestId)) return null;
        if (isAbortError(err)) {
          setState((s) => ({ ...s, status: s.result ? 'success' : 'idle' }));
          return null;
        }
        const error = normalizeError(err);
        setState((s) => ({ ...s, status: 'error', error, isStale: s.result !== null }));
        return null;
      } finally {
        if (sequencer.current.isLatest(requestId)) inFlightKey.current = null;
      }
    },
    [analyze],
  );

  const retry = useCallback(() => {
    if (state.lastPayload) return run(state.lastPayload);
    return Promise.resolve(null);
  }, [run, state.lastPayload]);

  const dismissError = useCallback(() => setState((s) => ({ ...s, error: null, status: s.result ? 'success' : 'idle' })), []);

  return { ...state, isLoading: state.status === 'loading', run, retry, dismissError };
}
