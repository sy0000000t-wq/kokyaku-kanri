"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import { getMonthlyNote, setMonthlyNote } from "@/lib/store/mutations";
import { formatYearMonth } from "@/lib/utils";

/**
 * 月ごとの覚書。
 * 「今月の重点実施項目は温度測定」のように、その月の全物件に共通することを書く。
 */
export function MonthlyNote({ year, month }: { year: number; month: number }) {
  const { doc, update } = useStore();
  const saved = getMonthlyNote(doc, year, month);

  const [value, setValue] = useState(saved);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setValue(saved);
  }, [saved, editing]);

  const commit = () => {
    setEditing(false);
    if (saved === value) return;
    update((d) => setMonthlyNote(d, { year, month, note: value }));
  };

  return (
    <Card>
      <CardHeader
        title={`${formatYearMonth(year, month)}の重点実施項目`}
        description="この月に共通してやることを書いておきます（測定項目、持ち物など）"
      />
      <div className="p-4">
        {editing ? (
          <textarea
            autoFocus
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setValue(saved);
                setEditing(false);
              }
            }}
            placeholder="例）重点実施項目は温度測定。サーモカメラを持参する"
            aria-label={`${formatYearMonth(year, month)}の重点実施項目`}
            className="w-full rounded-md border border-line bg-surface px-2.5 py-2 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full text-left text-sm"
          >
            {value ? (
              <span className="whitespace-pre-wrap">{value}</span>
            ) : (
              <span className="text-muted underline decoration-dotted">
                ＋ この月の重点実施項目を書く
              </span>
            )}
          </button>
        )}
      </div>
    </Card>
  );
}
