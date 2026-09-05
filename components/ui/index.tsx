import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui 相当の最小プリミティブ群（Tailwind のみで構成） */

export type ButtonVariant = "default" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

/** <a> や <Link> にボタンの見た目を当てたいときに使う */
export function buttonClass(
  variant: ButtonVariant = "default",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
    // 幅が足りないときは1文字ずつ折り返さず、行ごと折り返させる
    "whitespace-nowrap",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
    variant === "default" && "bg-brand text-white hover:opacity-90",
    variant === "outline" &&
      "border border-line bg-surface text-ink hover:bg-canvas",
    variant === "ghost" && "text-muted hover:bg-canvas hover:text-ink",
    variant === "danger" &&
      "border border-danger/30 bg-danger-soft text-danger hover:bg-danger hover:text-white",
    className,
  );
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function Input({
  className,
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-brand",
        "disabled:bg-canvas disabled:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-line bg-surface px-2.5 py-2 text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-brand",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-line bg-surface px-2 text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-brand",
        "disabled:bg-canvas disabled:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn("mb-1 block text-xs font-medium text-muted", className)}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-danger">*</span>}
    </label>
  );
}

export function Field({
  label,
  required,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label required={required} htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  description,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "brand" | "ok" | "warn" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tone === "neutral" && "bg-canvas text-muted",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "danger" && "bg-danger-soft text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted">{children}</div>
  );
}

/** 進捗バー（色だけに依存しないよう数値も併記する前提） */
export function Progress({
  value,
  max,
  tone = "brand",
}: {
  value: number;
  max: number;
  tone?: "brand" | "ok" | "warn";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-canvas"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          tone === "brand" && "bg-brand",
          tone === "ok" && "bg-ok",
          tone === "warn" && "bg-warn",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
