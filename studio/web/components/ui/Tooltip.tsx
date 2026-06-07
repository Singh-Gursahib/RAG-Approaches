"use client";

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";
import clsx from "clsx";

/** Lightweight hover/focus tooltip (CSS-positioned, no portal). */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={clsx(
            "absolute left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-[10px] bg-ink px-3 py-2",
            "text-[12px] leading-snug text-canvas shadow-lift animate-fade-in",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** A small "?" affordance that reveals contextual help on hover/focus. */
export function HelpPopover({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        aria-label="More information"
        className="inline-grid h-4 w-4 place-items-center rounded-full text-ink-faint hover:text-ink"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}
