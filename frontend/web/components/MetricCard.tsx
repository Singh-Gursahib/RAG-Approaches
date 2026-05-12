import clsx from "clsx";

interface Props {
  eyebrow: string;
  value: string | number;
  unit?: string;
  caption?: string;
  trend?: "up" | "down" | "flat";
  className?: string;
}

export function MetricCard({ eyebrow, value, unit, caption, className }: Props) {
  return (
    <div className={clsx("card card-hover px-6 py-5", className)}>
      <p className="eyebrow">{eyebrow}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="numeral text-[44px] leading-none">{value}</span>
        {unit && <span className="text-base text-ink-muted font-mono">{unit}</span>}
      </div>
      {caption && <p className="mt-3 text-[13px] text-ink-muted leading-snug">{caption}</p>}
    </div>
  );
}
