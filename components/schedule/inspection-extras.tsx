"use client";

import { useEffect, useState } from "react";
import { ToggleChip } from "@/components/schedule/toggle-chip";
import { useStore } from "@/lib/store/context";
import {
  setInspectionHelper,
  setInspectionReported,
  setInspectionSwitchgearRequested,
} from "@/lib/store/mutations";
import { cn } from "@/lib/utils";

type Key = {
  customerId: number;
  customerName: string;
  year: number;
  month: number;
  type: "regular" | "annual";
};

const TYPE_LABEL = { regular: "通常点検", annual: "年次点検" } as const;

const keyOf = (k: Key) => ({
  customerId: k.customerId,
  year: k.year,
  month: k.month,
  type: k.type,
});

/**
 * 報告書の提出トグル。
 * 点検を終えても提出はあとになるので、実施済みとは別に持つ。
 */
export function ReportedCheck({
  isReported,
  label = "報告",
  size,
  ...key
}: Key & { isReported: boolean; label?: string; size?: "sm" | "md" }) {
  const { update } = useStore();

  return (
    <ToggleChip
      label={label}
      active={isReported}
      tone="brand"
      size={size}
      ariaLabel={`${key.customerName} ${key.year}年${key.month}月の${TYPE_LABEL[key.type]} 報告書提出済み`}
      title="報告書を提出した"
      onToggle={(next) =>
        update((doc) =>
          setInspectionReported(doc, { ...keyOf(key), isReported: next }),
        )
      }
    />
  );
}

/**
 * 中電PGへの開閉器操作の申し込み。
 * 停電を伴う年次点検では点検日より前に出すので、実施チェックとは別に持つ。
 * 申し込みが要る物件（顧客マスタで指定）にだけ出す。
 */
export function SwitchgearRequestCheck({
  isRequested,
  note,
  ...key
}: Key & { isRequested: boolean; note: string }) {
  const { update } = useStore();

  return (
    <div
      className={cn(
        "rounded border px-2 py-1.5",
        isRequested ? "border-line" : "border-warn/40 bg-warn-soft",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs">中電PGの開閉器操作</span>
        <ToggleChip
          label="申込"
          active={isRequested}
          tone="brand"
          ariaLabel={`${key.customerName} ${key.year}年${key.month}月の年次点検 中電PG開閉器操作 申込済み`}
          title="中電PGへ開閉器操作を申し込んだ"
          onToggle={(next) =>
            update((doc) =>
              setInspectionSwitchgearRequested(doc, {
                ...keyOf(key),
                isRequested: next,
              }),
            )
          }
        />
      </div>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

/**
 * 年次点検の応援依頼。要・不要と、頼む相手を書く。
 * ひとりでは回せない規模の年次点検を、誰に頼むところまで決めたか残しておく。
 */
export function HelperFields({
  needsHelper,
  helperName,
  ...key
}: Key & { needsHelper: boolean; helperName: string }) {
  const { update } = useStore();
  const [value, setValue] = useState(helperName);
  const [editing, setEditing] = useState(false);

  // ほかの端末で書き換わったら追随する（編集中は邪魔しない）
  useEffect(() => {
    if (!editing) setValue(helperName);
  }, [helperName, editing]);

  const commitName = () => {
    setEditing(false);
    if (helperName === value) return;
    update((doc) =>
      setInspectionHelper(doc, { ...keyOf(key), helperName: value }),
    );
  };

  return (
    <div
      className={cn(
        "rounded border px-2 py-1.5",
        needsHelper ? "border-warn/40 bg-warn-soft" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs">年次点検の応援</span>
        <ToggleChip
          label="依頼"
          active={needsHelper}
          tone="warn"
          ariaLabel={`${key.customerName} ${key.year}年${key.month}月の年次点検 応援を依頼する`}
          title="応援を依頼する"
          onToggle={(next) => {
            if (!next) setValue("");
            update((doc) =>
              setInspectionHelper(doc, { ...keyOf(key), needsHelper: next }),
            );
          }}
        />
      </div>

      {needsHelper && (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setValue(helperName);
              setEditing(false);
            }
          }}
          placeholder="応援者（複数なら「〇〇、△△」）"
          aria-label={`${key.customerName} ${key.year}年${key.month}月の年次点検 応援者`}
          className="mt-1.5 w-full rounded border border-line bg-surface px-2 py-1 text-xs"
        />
      )}
    </div>
  );
}
