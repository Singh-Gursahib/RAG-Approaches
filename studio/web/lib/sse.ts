// SSE-over-POST streaming client + a React hook.
//
// Native EventSource can't send headers (we need X-Gemini-Key) or POST bodies,
// so we stream with fetch + a ReadableStream reader and parse `event:`/`data:`
// frames ourselves.

import { useCallback, useRef, useState } from "react";
import { getKey } from "./key";
import { ApiError } from "./api";
import type { SSEvent } from "./types";

export async function streamSSE(
  path: string,
  body: unknown,
  opts: {
    onEvent: (e: SSEvent) => void;
    withKey?: boolean;
    signal?: AbortSignal;
  },
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (opts.withKey) {
    const key = getKey();
    if (key) headers["X-Gemini-Key"] = key;
  }

  let resp: Response;
  try {
    resp = await fetch(`/api${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    throw new ApiError(0, "Could not reach the RAG Atlas backend. Is it running?", e);
  }

  if (!resp.ok || !resp.body) {
    let detail: unknown = null;
    try {
      detail = await resp.json();
    } catch {
      /* ignore */
    }
    const message =
      (detail &&
        ((detail as any).detail?.message ||
          (detail as any).detail ||
          (detail as any).message)) ||
      `Stream failed (${resp.status})`;
    throw new ApiError(resp.status, String(message), detail);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    // SSE frames are separated by a blank line.
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const evt = parseFrame(frame);
      if (evt) opts.onEvent(evt);
    }
  }
}

function parseFrame(frame: string): SSEvent | null {
  let event = "message";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    const payload = JSON.parse(data) as SSEvent;
    payload.event = payload.event || event;
    return payload;
  } catch {
    return null;
  }
}

/** React hook to drive an SSE stream with abort + running state. */
export function useStream() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (
      path: string,
      body: unknown,
      onEvent: (e: SSEvent) => void,
      withKey = true,
    ) => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setError(null);
      setRunning(true);
      try {
        await streamSSE(path, body, { onEvent, withKey, signal: ctrl.signal });
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          setError(e instanceof ApiError ? e.message : String(e));
        }
      } finally {
        if (ctrlRef.current === ctrl) {
          setRunning(false);
          ctrlRef.current = null;
        }
      }
    },
    [],
  );

  const stop = useCallback(() => {
    ctrlRef.current?.abort();
    setRunning(false);
  }, []);

  return { running, error, start, stop, setError };
}
