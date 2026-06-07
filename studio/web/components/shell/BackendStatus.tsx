"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "ok"; health: HealthResponse }
  | { kind: "down" };

/**
 * Live backend connectivity pill. Polls /health on mount. This is the Phase-1
 * proof that the Next.js app and the FastAPI server are wired end-to-end.
 */
export function BackendStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .health(ctrl.signal)
      .then((health) => setState({ kind: "ok", health }))
      .catch(() => setState({ kind: "down" }));
    return () => ctrl.abort();
  }, []);

  const dotColor =
    state.kind === "ok"
      ? "bg-approach-rerank"
      : state.kind === "down"
        ? "bg-approach-recursive"
        : "bg-ink-faint";

  const label =
    state.kind === "ok"
      ? "Backend connected"
      : state.kind === "down"
        ? "Backend offline"
        : "Connecting…";

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-pill border border-line bg-surface/70 text-ink-muted",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]",
      )}
      title={
        state.kind === "ok"
          ? `ragureap ${state.health.ragureap_version} · ${state.health.model_default}`
          : undefined
      }
    >
      <span className="relative flex h-2 w-2">
        {state.kind === "loading" && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-ink-faint opacity-60 animate-ping" />
        )}
        <span className={clsx("relative inline-flex h-2 w-2 rounded-full", dotColor)} />
      </span>
      <span className="font-mono tracking-tight">{label}</span>
      {state.kind === "ok" && !compact && (
        <span className="font-mono text-ink-faint">· {state.health.model_default}</span>
      )}
    </div>
  );
}
