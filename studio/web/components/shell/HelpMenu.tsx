"use client";

import { HelpCircle } from "lucide-react";

/** Header affordance that opens the Glossary (which links onward to the tour). */
export function HelpMenu() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("rag-atlas:open-glossary"))}
      aria-label="Help and glossary"
      className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
      title="Help & glossary"
    >
      <HelpCircle className="h-[18px] w-[18px]" />
    </button>
  );
}
