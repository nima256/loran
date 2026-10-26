"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";

/**
 * Runs an async action with a pending state and duplicate-submit protection.
 *
 * The protection is a ref, not the `pending` state: two clicks in the same
 * frame both read the old state value, so a state-based guard lets the second
 * one through. That is exactly how duplicate orders happen on an impatient
 * double-click.
 *
 * Errors are captured rather than thrown, so a failed action always restores
 * the button instead of leaving it stuck in a spinner.
 *
 *   const save = useAction(async (data) => api.post("/…", data), {
 *     onSuccess: () => toast({ tone: "success", title: "ذخیره شد" }),
 *   });
 *
 *   <Button loading={save.pending} disabled={save.pending} onClick={() => save.run(data)}>
 */

export interface UseActionOptions<T> {
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (message: string, error: unknown) => void;
  /** Cleared on the next run. Set false to keep the last error visible. */
  resetErrorOnRun?: boolean;
}

export interface ActionState<Args extends unknown[], T> {
  run: (...args: Args) => Promise<T | undefined>;
  pending: boolean;
  error: string | null;
  /** The last successful result, for rendering without a second state. */
  data: T | null;
  reset: () => void;
}

export function useAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
  options: UseActionOptions<T> = {}
): ActionState<Args, T> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  // A ref, because two clicks in one frame would both see `pending === false`.
  const inFlight = useRef(false);
  // Guards against setting state after the component has gone away — a modal
  // that closes while its save is still in flight, for instance.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setPending(true);
      if (options.resetErrorOnRun !== false) setError(null);

      try {
        const result = await action(...args);
        if (mounted.current) setData(result);
        await options.onSuccess?.(result);
        return result;
      } catch (caught) {
        const message = errorMessage(caught);
        if (mounted.current) setError(message);
        options.onError?.(message, caught);
        return undefined;
      } finally {
        inFlight.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [action, options]
  );

  const reset = useCallback(() => {
    setError(null);
    setData(null);
  }, []);

  return { run, pending, error, data, reset };
}
