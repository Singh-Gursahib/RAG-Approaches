"use client";

import { useState } from "react";
import clsx from "clsx";
import { KeyRound } from "lucide-react";
import { useKey } from "@/lib/useKey";
import { KeyModal } from "./KeyModal";

export function KeyStatusPill() {
  const { present } = useKey();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
          present
            ? "border-approach-rerank/30 bg-approach-rerank/[0.06] text-approach-rerank hover:bg-approach-rerank/[0.1]"
            : "border-accent/30 bg-accent-soft text-accent hover:bg-accent/[0.14]",
        )}
      >
        <KeyRound className="h-3.5 w-3.5" />
        {present ? "Key connected" : "Add your key"}
      </button>
      <KeyModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
