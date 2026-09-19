import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { CloudState } from "@/hooks/use-cloud-data";
import { getSyncError, subscribeSyncError } from "@/lib/cloud-sync";

/** Warns when something typed on screen did not reach the database. */
function SaveError() {
  const [message, setMessage] = useState<string | null>(getSyncError());
  useEffect(() => subscribeSyncError(setMessage), []);
  if (!message) return null;
  return (
    <div className="mx-auto max-w-7xl px-4 py-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-foreground">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span>Your last change couldn&apos;t be saved to the database. {message}</span>
      </div>
    </div>
  );
}

/** Loading / error banner for the shared database. */
export function CloudStatus({ state, label = "data" }: { state: CloudState; label?: string }) {
  if (state.status === "loading") {
    return (
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-gold" />
        Loading {label}…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>Couldn&apos;t load your saved {label}. Nothing has been changed or deleted.</span>
          <button
            type="button"
            onClick={state.retry}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-gold"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-2 text-xs text-muted-foreground">
        Showing the last loaded {label} — the latest update couldn&apos;t be fetched.{" "}
        <button type="button" onClick={state.retry} className="underline hover:text-gold">
          Retry
        </button>
      </div>
    );
  }

  return <SaveError />;
}
