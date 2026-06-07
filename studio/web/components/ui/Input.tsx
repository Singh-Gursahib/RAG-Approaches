"use client";

import { forwardRef } from "react";
import clsx from "clsx";

const base =
  "w-full rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink " +
  "placeholder:text-ink-faint transition-colors focus:border-ink/30 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-accent/30";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={clsx(base, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(base, "resize-y leading-relaxed", className)} {...rest} />;
});

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        {label}
        {hint}
      </label>
      {children}
    </div>
  );
}
