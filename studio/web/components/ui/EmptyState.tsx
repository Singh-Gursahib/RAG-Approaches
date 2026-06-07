import clsx from "clsx";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-[14px] bg-ink/[0.04] text-ink-faint">
          {icon}
        </div>
      )}
      <p className="font-display text-[22px] tracking-tightest text-ink">{title}</p>
      {body && <p className="mt-2 max-w-[42ch] text-[14px] leading-relaxed text-ink-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
