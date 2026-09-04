"use client";

import { ToggleChip } from "@/components/schedule/toggle-chip";
import { useStore } from "@/lib/store/context";
import { setInspectionDone } from "@/lib/store/mutations";

/**
 * 点検の実施トグル。1クリックで確定する。
 * 文書はその場で書き換わり、保存は少し待ってからまとめて行われる。
 */
export function InspectionCheck({
  customerId,
  customerName,
  year,
  month,
  type,
  isDone,
  label = "点検",
  size,
}: {
  customerId: number;
  customerName: string;
  year: number;
  month: number;
  type: "regular" | "annual";
  isDone: boolean;
  label?: string;
  size?: "sm" | "md";
}) {
  const { update } = useStore();
  const typeLabel = type === "regular" ? "通常点検" : "年次点検";

  return (
    <ToggleChip
      label={label}
      active={isDone}
      tone="ok"
      size={size}
      ariaLabel={`${customerName} ${year}年${month}月の${typeLabel} 実施済み`}
      title={`${typeLabel}を実施した`}
      onToggle={(next) =>
        update((doc) =>
          setInspectionDone(doc, { customerId, year, month, type, isDone: next }),
        )
      }
    />
  );
}
