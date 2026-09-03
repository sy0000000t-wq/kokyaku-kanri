"use client";

import { useEffect, useState } from "react";
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

/**
 * 報告書の提出チェック。
 * 点検を終えても提出はあとになるので、実施済みとは別に持つ。
 */
export function ReportedCheck({
  isReported,
  compact,
  ...key
}: Key & { isReported: boolean; compact?: boolean }) {
  const { update } = useStore();

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5">
      <input
        type="checkbox"
        className="size-4 accent-[oklch(0.52_0.15_250)]"
        checked={isReported}
        onChange={(e) =>
          update((doc) =>
            setInspectionReported(doc, {
              customerId: key.customerId,
              year: key.year,
              month: key.month,
              type: key.type,
              isReported: e.target.checked,
            }),
          )
        }
        aria-label={`${key.customerName} ${key.year}年${key.month}月の${TYPE_LABEL[key.type]} 報告書提出済み`}
      />
      {!compact && <span className="text-xs">報告書提出</span>}
    </label>
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
        isRequested ? "border-ok/40 bg-ok-soft" : "border-warn/40 bg-warn-soft",
      )}
    >
      <label className="inline-flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          className="size-4 accent-[oklch(0.52_0.15_250)]"
          checked={isRequested}
          onChange={(e) =>
            update((doc) =>
              setInspectionSwitchgearRequested(doc, {
                customerId: key.customerId,
                year: key.year,
                month: key.month,
                type: key.type,
                isRequested: e.target.checked,
              }),
            )
          }
          aria-label={`${key.customerName} ${key.year}年${key.month}月の年次点検 中電PG開閉器操作 申込済み`}
        />
        <span className="text-xs">中電PGへ開閉器操作を申込済み</span>
      </label>
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

  const common = {
    customerId: key.customerId,
    year: key.year,
    month: key.month,
    type: key.type,
  };

  const commitName = () => {
    setEditing(false);
    if (helperName === value) return;
    update((doc) => setInspectionHelper(doc, { ...common, helperName: value }));
  };

  return (
    <div
      className={cn(
        "rounded border px-2 py-1.5",
        needsHelper ? "border-warn/40 bg-warn-soft" : "border-line",
      )}
    >
      <label className="inline-flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          className="size-4 accent-[oklch(0.68_0.15_65)]"
          checked={needsHelper}
          onChange={(e) => {
            setValue(e.target.checked ? value : "");
            update((doc) =>
              setInspectionHelper(doc, {
                ...common,
                needsHelper: e.target.checked,
              }),
            );
          }}
          aria-label={`${key.customerName} ${key.year}年${key.month}月の年次点検 応援を依頼する`}
        />
        <span className="text-xs">応援を依頼する</span>
      </label>

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
