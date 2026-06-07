import clsx from "clsx";

/** Small status/category pill. */
export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink/[0.05] text-ink-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-approach-rerank/10 text-approach-rerank",
    warning: "bg-approach-hyde/10 text-approach-hyde",
    danger: "bg-approach-recursive/10 text-approach-recursive",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A colored dot + label for an approach/probe. */
export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={clsx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
