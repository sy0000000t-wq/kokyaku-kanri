"use client";

import { cn } from "@/lib/utils";

/**
 * 押すと色が入る小さなトグル。
 * チェックボックスだと「点検」と「報告」のどちらを触っているのか
 * 一目で分からないので、文字そのものをボタンにして状態を色で示す。
 */
export function ToggleChip({
  label,
  active,
  tone,
  onToggle,
  ariaLabel,
  title,
  size = "sm",
}: {
  label: string;
  active: boolean;
  tone: "ok" | "brand" | "warn";
  onToggle: (next: boolean) => void;
  ariaLabel: string;
  title?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={ariaLabel}
      title={title ?? label}
      onClick={() => onToggle(!active)}
      className={cn(
        "inline-flex items-center justify-center rounded border font-medium whitespace-nowrap transition-colors",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        // 未実施は色を抜いて枠だけ、済んだら塗りつぶす
        active
          ? "border-transparent text-white"
          : "border-line bg-surface text-muted hover:bg-canvas hover:text-ink",
        active && tone === "ok" && "bg-ok",
        active && tone === "brand" && "bg-brand",
        active && tone === "warn" && "bg-warn",
      )}
    >
      {label}
    </button>
  );
}
