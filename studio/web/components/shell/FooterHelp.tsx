"use client";

import { BookOpen, Compass } from "lucide-react";

export function FooterHelp() {
  return (
    <nav aria-label="Help" className="flex items-center gap-5 text-[13px]">
      <button
        onClick={() => window.dispatchEvent(new Event("rag-atlas:open-glossary"))}
        className="inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-ink"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Glossary
      </button>
      <button
        onClick={() => window.dispatchEvent(new Event("rag-atlas:start-tour"))}
        className="inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-ink"
      >
        <Compass className="h-3.5 w-3.5" />
        Take the tour
      </button>
    </nav>
  );
}
