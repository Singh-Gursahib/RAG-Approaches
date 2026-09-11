"use client";

import clsx from "clsx";

/** Labeled range slider with a live value readout. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  hint,
  disabled = false,
  onChange,
}: {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: React.ReactNode;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          {label}
          {hint}
        </span>
        <span className="tnum font-mono text-[13px] text-ink-muted">
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range w-full disabled:opacity-60"
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, rgba(26,26,26,0.10) ${pct}%, rgba(26,26,26,0.10) 100%)`,
        }}
        aria-label={typeof label === "string" ? label : undefined}
      />
    </div>
  );
}

/** Accessible on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill transition-colors",
        checked ? "bg-ink" : "bg-ink/[0.15]",
      )}
    >
      <span
        className={clsx(
          "inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Segmented toggle (e.g., EM / F1). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-pill border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-pill px-3 py-1 text-[12.5px] font-medium transition-colors",
            value === o.value ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
