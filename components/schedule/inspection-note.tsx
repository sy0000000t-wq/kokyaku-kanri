"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store/context";
import { setInspectionNote } from "@/lib/store/mutations";
import { cn } from "@/lib/utils";

/**
 * 点検1件ごとの覚書。
 * 「次はメガー持参」「屋上の鍵を借りる」など、その月の訪問で要ることを書いておく。
 */
export function InspectionNote({
  customerId,
  customerName,
  year,
  month,
  type,
  note,
}: {
  customerId: number;
  customerName: string;
  year: number;
  month: number;
  type: "regular" | "annual";
  note: string | null;
}) {
  const { update } = useStore();
  const [value, setValue] = useState(note ?? "");
  const [editing, setEditing] = useState(false);

  // ほかの端末で書き換わったら追随する（編集中は邪魔しない）
  useEffect(() => {
    if (!editing) setValue(note ?? "");
  }, [note, editing]);

  const commit = () => {
    setEditing(false);
    if ((note ?? "") === value) return;
    update((doc) =>
      setInspectionNote(doc, { customerId, year, month, type, note: value }),
    );
  };

  if (!editing && !value) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-muted underline decoration-dotted hover:text-ink"
      >
        ＋ メモ
      </button>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "w-full rounded border border-warn/30 bg-warn-soft px-2 py-1.5 text-left text-xs",
          "whitespace-pre-wrap text-ink hover:border-warn/60",
        )}
        title="クリックで編集"
      >
        {value}
      </button>
    );
  }

  return (
    <textarea
      autoFocus
      rows={2}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setValue(note ?? "");
          setEditing(false);
        }
      }}
      placeholder="持ち物や、いつもと違う作業など"
      aria-label={`${customerName} ${month}月の点検メモ`}
      className="w-full rounded border border-line bg-surface px-2 py-1.5 text-xs"
    />
  );
}
