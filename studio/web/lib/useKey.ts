"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { getKey } from "./key";

let serverKeyCheck: Promise<boolean> | null = null;

/** Whether the backend has OPENROUTER_API_KEY configured (checked once per page load). */
export function serverKeyConfigured(): Promise<boolean> {
  if (!serverKeyCheck) {
    serverKeyCheck = api
      .health()
      .then((h) => !!h.server_key_configured)
      .catch(() => {
        serverKeyCheck = null;
        return false;
      });
  }
  return serverKeyCheck;
}

/**
 * Subscribe to the BYO key in sessionStorage (updates across tabs + on change).
 * `present` is true when runs can spend: a key in this tab, or a server-side key.
 */
export function useKey() {
  const [key, setKeyState] = useState<string | null>(null);
  const [serverKey, setServerKey] = useState(false);

  useEffect(() => {
    let alive = true;
    const sync = () => setKeyState(getKey());
    sync();
    serverKeyConfigured().then((v) => alive && setServerKey(v));
    window.addEventListener("rag-atlas:key-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      alive = false;
      window.removeEventListener("rag-atlas:key-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { key, browserKey: !!key, serverKey, present: !!key || serverKey };
}
