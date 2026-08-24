"use client";

import { useStore } from "@/lib/store/context";
import { setInspectionDone } from "@/lib/store/mutations";
import { cn } from "@/lib/utils";

/**
 * 点検の実施チェック。1クリックで確定する。
 * 文書はその場で書き換わり、保存は少し待ってからまとめて行われる。
 */
export function InspectionCheck({
  customerId,
  customerName,
  year,
  month,
  type,
  isDone,
  disabled,
  label,
}: {
  customerId: number;
  customerName: string;
  year: number;
  month: number;
  type: "regular" | "annual";
  isDone: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const { update } = useStore();
  const typeLabel = type === "regular" ? "通常点検" : "年次点検";

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <input
        type="checkbox"
        className="size-4 accent-[oklch(0.55_0.14_155)]"
        checked={isDone}
        disabled={disabled}
        onChange={(e) =>
          update((doc) =>
            setInspectionDone(doc, {
              customerId,
              year,
              month,
              type,
              isDone: e.target.checked,
            }),
          )
        }
        aria-label={`${customerName} ${year}年${month}月の${typeLabel} 実施済み`}
      />
      {label && <span className="text-xs">{label}</span>}
    </label>
  );
}
