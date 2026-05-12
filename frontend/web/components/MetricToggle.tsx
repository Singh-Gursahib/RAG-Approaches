"use client";

import clsx from "clsx";

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function MetricToggle<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="inline-flex bg-ink/[0.04] rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "px-4 py-1.5 text-[13px] rounded-full transition-all",
            value === o.value
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-muted hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
