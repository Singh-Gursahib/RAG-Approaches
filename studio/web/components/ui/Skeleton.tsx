import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse-soft rounded-[8px] bg-ink/[0.06]", className)} />;
}
