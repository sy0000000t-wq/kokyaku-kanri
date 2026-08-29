"use client";

import { useStore } from "@/lib/store/context";
import { saveSettings } from "@/lib/store/mutations";
import { cn } from "@/lib/utils";

/**
 * 金額を税抜で見るか税込で見るかの切替。
 * 顧客マスタと請求画面で共通に効く。
 */
export function TaxToggle() {
  const { doc, update } = useStore();
  const showIncluded = doc.settings.showTaxIncluded;

  return (
    <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {[
        { incl: false, label: "税抜" },
        { incl: true, label: "税込" },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() =>
            update((d) => saveSettings(d, { showTaxIncluded: o.incl }))
          }
          aria-pressed={showIncluded === o.incl}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            showIncluded === o.incl
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
