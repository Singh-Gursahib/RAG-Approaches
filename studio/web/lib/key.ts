// Bring-Your-Own-Key storage.
//
// HARD RULE: the Gemini API key lives only in this browser tab's sessionStorage.
// It is sent to the backend per-request via the X-Gemini-Key header and is never
// persisted to disk server-side, never logged, and never written to localStorage
// (which would survive tab close). The full key is never rendered after entry.

const KEY_STORAGE = "rag-atlas:gemini-key";

export function getKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setKey(value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY_STORAGE, value.trim());
    window.dispatchEvent(new Event("rag-atlas:key-change"));
  } catch {
    /* sessionStorage unavailable (private mode quota) — fail silently */
  }
}

export function clearKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY_STORAGE);
    window.dispatchEvent(new Event("rag-atlas:key-change"));
  } catch {
    /* noop */
  }
}

export function hasKey(): boolean {
  return !!getKey();
}

/** Mask a key for display: keep a short prefix/suffix, redact the middle. */
export function maskKey(value: string): string {
  if (value.length <= 10) return "••••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}
