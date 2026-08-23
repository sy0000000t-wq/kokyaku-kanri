"use client";

import { useOptimistic, useTransition } from "react";
import { setInspectionDone } from "@/app/actions/inspection";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

/**
 * §10-6 1クリックで完結。useOptimistic で即時反映し、
 * 失敗したらロールバックしてトーストを出す。
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
  const toast = useToast();
  const [optimistic, setOptimistic] = useOptimistic(isDone);
  const [, startTransition] = useTransition();

  const typeLabel = type === "regular" ? "通常点検" : "年次点検";

  const toggle = () => {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await setInspectionDone({ customerId, year, month, type, isDone: next });
      } catch {
        // useOptimistic はトランジション終了時に自動で元へ戻る
        toast(`${customerName} の${typeLabel}を更新できませんでした`, "danger");
      }
    });
  };

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
        checked={optimistic}
        disabled={disabled}
        onChange={toggle}
        aria-label={`${customerName} ${year}年${month}月の${typeLabel} 実施済み`}
      />
      {label && <span className="text-xs">{label}</span>}
    </label>
  );
}
