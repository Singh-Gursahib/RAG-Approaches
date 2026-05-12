import clsx from "clsx";

interface Props {
  number: string;
  title: string;
  children: React.ReactNode;
  variant?: "default" | "warning" | "positive";
}

const variantStyles = {
  default: "border-border",
  warning: "border-accent/40 bg-accent-subtle/30",
  positive: "border-approach-rerank/30 bg-approach-rerank/5",
};

export function Finding({ number, title, children, variant = "default" }: Props) {
  return (
    <div className={clsx("relative card p-7 transition-colors", variantStyles[variant])}>
      <p className="numeral text-[44px] text-ink-faint leading-none absolute top-5 right-6">
        {number}
      </p>
      <h3 className="font-display text-[20px] tracking-tightest text-ink pr-12 leading-[1.2]">
        {title}
      </h3>
      <div className="mt-3 text-[14px] text-ink-muted leading-relaxed">{children}</div>
    </div>
  );
}
