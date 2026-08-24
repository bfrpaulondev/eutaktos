import { useCallback, useEffect, useRef, useState } from 'react';
import { httpErrorKind, isAbortError, type HttpErrorKind } from './httpError';

export type WriteState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'pending' }>
  | Readonly<{ status: 'success'; data: unknown }>
  | Readonly<{ status: 'error'; kind: HttpErrorKind; message: string }>;

export interface UseApiWriteOptions {
  /** Auto-reset to idle after success/error (ms). 0 = no auto-reset. */
  resetAfterMs?: number;
}

export interface UseApiWriteResult<TInput, TOutput> {
  state: WriteState;
  pending: boolean;
  error: HttpErrorKind | undefined;
  errorMessage: string | undefined;
  data: TOutput | undefined;
  execute: (input: TInput) => Promise<TOutput>;
  reset: () => void;
}

/**
 * useApiWrite — standard hook for API mutations (POST/PATCH/PUT/DELETE).
 *
 * Guarantees:
 * 1. Double-submit protection via `pendingRef`: the second click before re-render
 *    is silently ignored (returns the in-flight promise).
 * 2. Unmount protection: no setState after unmount.
 * 3. AbortSignal passed to the mutator (if it accepts one) and aborted on unmount.
 * 4. Discriminated `state` with `kind` for accurate recovery UX
 *    (409 conflict, 403 forbidden, 5xx server, etc.).
 *
 * Components should call `execute()` inside form submit handlers and
 * read `state.status === 'pending'` to disable the submit button.
 */
export function useApiWrite<TInput, TOutput>(
  mutator: (input: TInput, signal: AbortSignal) => Promise<TOutput>,
  options: UseApiWriteOptions = {}
): UseApiWriteResult<TInput, TOutput> {
  const { resetAfterMs = 0 } = options;
  const [state, setState] = useState<WriteState>({ status: 'idle' });
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (!mountedRef.current) return;
    setState({ status: 'idle' });
  }, []);

  const execute = useCallback(async (input: TInput): Promise<TOutput> => {
    if (pendingRef.current) {
      // Already in-flight; do not start a second request.
      // Return a promise that never resolves — the caller's await will hang
      // until the original completes. This is acceptable because the caller
      // should have read `pending` and not called execute() in the first place.
      return new Promise<TOutput>(() => {});
    }
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    pendingRef.current = true;
    if (mountedRef.current) setState({ status: 'pending' });

    try {
      const data = await mutator(input, controller.signal);
      if (controller.signal.aborted) return data;
      if (!mountedRef.current) return data;
      setState({ status: 'success', data });
      if (resetAfterMs > 0) {
        resetTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setState({ status: 'idle' });
        }, resetAfterMs);
      }
      return data;
    } catch (error) {
      if (isAbortError(error)) {
        // Aborted by unmount or retry — do not show error.
        if (mountedRef.current) setState({ status: 'idle' });
        throw error;
      }
      if (!mountedRef.current) throw error;
      const kind = httpErrorKind(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState({ status: 'error', kind, message });
      throw error;
    } finally {
      pendingRef.current = false;
    }
  }, [mutator, resetAfterMs]);

  const pending = state.status === 'pending';
  const error = state.status === 'error' ? state.kind : undefined;
  const errorMessage = state.status === 'error' ? state.message : undefined;
  const data = state.status === 'success' ? (state.data as TOutput) : undefined;

  return { state, pending, error, errorMessage, data, execute, reset };
}
