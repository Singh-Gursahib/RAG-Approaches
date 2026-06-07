"use client";

import { useEffect, useState } from "react";
import { getKey } from "./key";

/** Subscribe to the BYO key in sessionStorage (updates across tabs + on change). */
export function useKey() {
  const [key, setKeyState] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setKeyState(getKey());
    sync();
    window.addEventListener("rag-atlas:key-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rag-atlas:key-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { key, present: !!key };
}
