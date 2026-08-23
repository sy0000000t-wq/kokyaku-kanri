"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** §10-5 稼働状態フィルタ。既定は「稼働中のみ」で全画面共通 */
export function ScopeFilter({
  base,
  options = [
    { value: "active", label: "稼働中のみ" },
    { value: "all", label: "すべて" },
  ],
  paramKey = "active",
  defaultValue = "active",
}: {
  base: string;
  options?: { value: string; label: string }[];
  paramKey?: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? defaultValue;

  const set = (value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (value === defaultValue) sp.delete(paramKey);
    else sp.set(paramKey, value);
    router.replace(`${base}?${sp.toString()}`);
  };

  return (
    <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => set(o.value)}
          aria-pressed={current === o.value}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            current === o.value
              ? "bg-brand text-white"
              : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
