import { useCallback, useEffect, useRef, useState } from "react";

import { isLoaded, refreshAll, subscribeCloud } from "@/lib/cloud-sync";

export type CloudStatus = "loading" | "ready" | "error";

export interface CloudState {
  status: CloudStatus;
  error: string | null;
  retry: () => void;
}

const RETRIES = 3;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Loads the shared cloud data into the local cache, applies it to component
 * state and keeps it in sync when other users change something.
 *
 * A failed request never clears the screen: state is only applied after a
 * successful read, and the caller gets an error status it can surface.
 */
export function useCloudData(apply: () => void): CloudState {
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const [status, setStatus] = useState<CloudStatus>(() => (isLoaded() ? "ready" : "loading"));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;

    if (isLoaded()) applyRef.current();

    const load = async (showSpinner: boolean) => {
      if (showSpinner && !isLoaded()) setStatus("loading");
      let lastErr: unknown = null;
      for (let i = 0; i < RETRIES; i++) {
        try {
          await Promise.race([
            refreshAll(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("The database took too long to respond.")), 15000),
            ),
          ]);

          if (!active) return;
          applyRef.current();
          setError(null);
          setStatus("ready");
          return;
        } catch (err) {
          lastErr = err;
          if (!active) return;
          if (i < RETRIES - 1) await wait(400 * 2 ** i);
        }
      }
      if (!active) return;
      console.error("Failed to load shared data", lastErr);
      setError(lastErr instanceof Error ? lastErr.message : "Could not reach the database.");
      // Keep whatever was already loaded on screen; never show an empty state.
      setStatus(isLoaded() ? "ready" : "error");
    };

    void load(true);
    const unsubscribe = subscribeCloud(() => void load(false));

    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);

  return { status, error, retry };
}
