import clsx from "clsx";
import { APPROACH_COLOR, APPROACH_LABEL, APPROACH_FAMILY } from "@/lib/colors";
import type { ApproachKey } from "@/lib/types";

interface Props {
  approach: ApproachKey;
  size?: "sm" | "md";
  showFamily?: boolean;
}

export function ApproachChip({ approach, size = "md", showFamily = false }: Props) {
  const color = APPROACH_COLOR[approach];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface",
        size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"
      )}
    >
      <span
        className={clsx("rounded-full", size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2")}
        style={{ backgroundColor: color }}
      />
      <span className="font-medium text-ink">{APPROACH_LABEL[approach]}</span>
      {showFamily && (
        <span className="text-[10px] uppercase tracking-widest text-ink-faint font-mono">
          {APPROACH_FAMILY[approach]}
        </span>
      )}
    </span>
  );
}
