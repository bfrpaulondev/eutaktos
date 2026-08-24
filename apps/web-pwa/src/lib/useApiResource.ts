import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpError, httpErrorKind, isAbortError, type HttpErrorKind } from './httpError';

/**
 * Resource state discriminated union.
 *
 * Components switch on `state.status`:
 * - `loading`   → initial fetch in progress, no data yet.
 * - `refreshing` → re-fetch in progress, previous data kept (stale-while-revalidate).
 * - `ready`     → data available, no error.
 * - `error`     → fetch failed; `kind` guides recovery UX.
 */
export type ResourceState<T> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'refreshing'; data: T }>
  | Readonly<{ status: 'ready'; data: T }>
  | Readonly<{ status: 'error'; kind: HttpErrorKind; message: string }>;

export interface UseApiResourceOptions<T> {
  /** Fetcher function. Should throw HttpError on non-2xx; AbortError on cancel. */
  fetcher: (signal: AbortSignal) => Promise<T>;
  /** Whether to fetch automatically on mount. Default: true. */
  fetchOnMount?: boolean;
  /** Initial data to show before first fetch resolves (stale seed). */
  initialData?: T;
}

export interface UseApiResourceResult<T> {
  state: ResourceState<T>;
  data: T | undefined;
  error: HttpError | undefined;
  retry: () => void;
  setData: (next: T | ((prev: T | undefined) => T)) => void;
}

/**
 * useApiResource — standard hook for fetching read-only API resources.
 *
 * Guarantees:
 * 1. AbortController per in-flight request, aborted on unmount or retry.
 * 2. Race-condition protection via `requestVersionRef`: a late response from
 *    an older request never overwrites a newer one.
 * 3. No setState after unmount.
 * 4. Stale-while-revalidate: on retry/refresh, previous `data` is kept and
 *    `status: 'refreshing'` is exposed so the UI can show a non-blocking
 *    indicator instead of a full-screen spinner.
 * 5. Network errors (offline, DNS, CORS, abort) are mapped to kind 'network'
 *    but abort-triggered ones are silently swallowed (no error shown).
 */
export function useApiResource<T>(options: UseApiResourceOptions<T>): UseApiResourceResult<T> {
  const { fetcher, fetchOnMount = true, initialData } = options;
  const [state, setState] = useState<ResourceState<T>>(
    initialData !== undefined
      ? { status: 'ready', data: initialData }
      : { status: 'loading' }
  );
  const requestVersionRef = useRef(0);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const version = ++requestVersionRef.current;

    setState(prev => (prev.status === 'ready' || prev.status === 'refreshing' ? { status: 'refreshing', data: prev.data } : { status: 'loading' }));

    try {
      const data = await fetcher(controller.signal);
      if (controller.signal.aborted) return;
      if (version !== requestVersionRef.current) return;
      if (!mountedRef.current) return;
      setState({ status: 'ready', data });
    } catch (error) {
      if (isAbortError(error)) return;
      if (controller.signal.aborted) return;
      if (version !== requestVersionRef.current) return;
      if (!mountedRef.current) return;
      const kind = httpErrorKind(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState({ status: 'error', kind, message });
    }
  }, [fetcher]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const setData = useCallback((next: T | ((prev: T | undefined) => T)) => {
    setState(prev => {
      const prevData = prev.status === 'ready' || prev.status === 'refreshing' ? prev.data : undefined;
      const data = typeof next === 'function' ? (next as (p: T | undefined) => T)(prevData) : next;
      return { status: 'ready', data };
    });
  }, []);

  useEffect(() => {
    if (fetchOnMount) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = state.status === 'ready' || state.status === 'refreshing' ? state.data : undefined;
  const error = state.status === 'error'
    ? (() => {
        // Reconstruct a minimal HttpError for consumers that read .status
        const e = new HttpError(
          state.kind === 'auth' ? 401
          : state.kind === 'forbidden' ? 403
          : state.kind === 'not-found' ? 404
          : state.kind === 'conflict' ? 409
          : state.kind === 'server' ? 503
          : state.kind === 'client' ? 400
          : 0,
          state.message
        );
        return e;
      })()
    : undefined;

  return { state, data, error, retry, setData };
}

/**
 * Helper for components that just need a boolean "is this recoverable with retry?"
 * Returns false for 401 (auth), 403 (forbidden), 404 (not-found), 4xx (client).
 */
export function isRetryableKind(kind: HttpErrorKind): boolean {
  return kind === 'server' || kind === 'network';
}
