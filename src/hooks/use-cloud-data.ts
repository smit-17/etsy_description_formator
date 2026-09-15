import { useEffect, useRef } from "react";

import { isLoaded, refreshAll, subscribeCloud } from "@/lib/cloud-sync";

/**
 * Loads the shared cloud data into the local cache, applies it to component
 * state and keeps it in sync when other users change something.
 */
export function useCloudData(apply: () => void) {
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    let active = true;

    if (isLoaded()) applyRef.current();

    const load = async () => {
      try {
        await refreshAll();
      } catch (err) {
        console.error("Failed to load shared data", err);
        return;
      }
      if (active) applyRef.current();
    };

    void load();
    const unsubscribe = subscribeCloud(() => void load());

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
}
