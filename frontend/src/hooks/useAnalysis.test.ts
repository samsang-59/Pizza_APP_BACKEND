import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import analyze from '../fixtures/analyze.sample.json';
import type { AnalysisRequest, AnalysisResponse } from '../api/types';
import { createRequestSequencer, useAnalysis } from './useAnalysis';

const sample = analyze as unknown as AnalysisResponse;
const payload = (heading: number) => ({ heading_degrees: heading }) as unknown as AnalysisRequest;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createRequestSequencer', () => {
  it('only the newest request is latest', () => {
    const seq = createRequestSequencer();
    const a = seq.next();
    const b = seq.next();
    expect(seq.isLatest(a)).toBe(false);
    expect(seq.isLatest(b)).toBe(true);
  });
});

describe('useAnalysis request ordering', () => {
  it('an older response can never overwrite a newer one', async () => {
    const first = deferred<AnalysisResponse>();
    const second = deferred<AnalysisResponse>();
    const calls = [first, second];
    let i = 0;
    const { result } = renderHook(() => useAnalysis({ analyze: () => calls[i++]!.promise }));

    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.run(payload(1));
    });
    act(() => {
      p2 = result.current.run(payload(2));
    });
    const newer = { ...sample, analysis_id: 'newer' };
    const older = { ...sample, analysis_id: 'older' };
    await act(async () => {
      second.resolve(newer);
      await p2;
    });
    expect(result.current.result?.analysis_id).toBe('newer');
    await act(async () => {
      first.resolve(older);
      await p1;
    });
    expect(result.current.result?.analysis_id).toBe('newer');
    expect(result.current.status).toBe('success');
  });

  it('aborts the in-flight request when a new one starts', async () => {
    const signals: AbortSignal[] = [];
    const { result } = renderHook(() =>
      useAnalysis({
        analyze: (_p, { signal }) => {
          signals.push(signal);
          return new Promise<AnalysisResponse>(() => undefined);
        },
      }),
    );
    act(() => void result.current.run(payload(1)));
    act(() => void result.current.run(payload(2)));
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
  });

  it('ignores a duplicate identical request while one is in flight', () => {
    let count = 0;
    const { result } = renderHook(() =>
      useAnalysis({
        analyze: () => {
          count += 1;
          return new Promise<AnalysisResponse>(() => undefined);
        },
      }),
    );
    act(() => void result.current.run(payload(1)));
    act(() => void result.current.run(payload(1)));
    expect(count).toBe(1);
  });

  it('keeps the previous result and marks it stale when a newer request fails', async () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    let call = 0;
    const { result } = renderHook(() =>
      useAnalysis({
        analyze: () => (call++ === 0 ? Promise.resolve(sample) : Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))),
      }),
    );
    await act(async () => {
      await result.current.run(payload(1));
    });
    await act(async () => {
      await result.current.run(payload(2));
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.result?.analysis_id).toBe(sample.analysis_id);
    expect(result.current.isStale).toBe(true);
    expect(result.current.error?.kind).toBe('network');
    expect(result.current.lastPayload).toEqual(payload(2));
  });
});
