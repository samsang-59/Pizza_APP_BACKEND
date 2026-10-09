import { useCallback, useEffect, useRef, useState } from 'react';
import { getHealth } from '../api/endpoints';

export type BackendStatus = 'checking' | 'connected' | 'unreachable';

export const HEALTH_POLL_MS = 30_000;

/** Polls GET /health every 30 s, on window focus, and on manual retry. */
export function useBackendHealth(pollMs: number = HEALTH_POLL_MS) {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('checking');
    try {
      const res = await getHealth({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setStatus(res.status === 'ok' ? 'connected' : 'unreachable');
    } catch {
      if (controller.signal.aborted) return;
      setStatus('unreachable');
    } finally {
      if (!controller.signal.aborted) setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), pollMs);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      controllerRef.current?.abort();
    };
  }, [check, pollMs]);

  return { status, lastChecked, retry: check };
}
