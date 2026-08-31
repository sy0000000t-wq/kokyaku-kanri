"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardHeader } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import {
  getAnnualFocusForYear,
  getMonthlyFocus,
  setMonthlyFocus,
} from "@/lib/store/mutations";

/**
 * その月の重点実施項目。
 * 月次は毎年その月に、年次点検は数年ごとに巡ってくる。
 */
export function FocusItems({
  year,
  month,
  hasAnnualTarget,
}: {
  year: number;
  month: number;
  /** その月に年次点検の対象があるか。無ければ年次のぶんは出さない */
  hasAnnualTarget: boolean;
}) {
  const { doc, update } = useStore();
  const saved = getMonthlyFocus(doc, month);
  const annual = getAnnualFocusForYear(doc, year);

  const [value, setValue] = useState(saved);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setValue(saved);
  }, [saved, editing]);

  const commit = () => {
    setEditing(false);
    if (saved === value) return;
    update((d) => setMonthlyFocus(d, { month, note: value }));
  };

  return (
    <Card>
      <CardHeader
        title="重点実施項目"
        description={`毎年${month}月に共通してやること。年をまたいでも同じ内容が出ます`}
        action={
          <Link
            href="/settings?tab=focus"
            className="text-xs text-brand hover:underline"
          >
            まとめて編集
          </Link>
        }
      />

      <div className="divide-y divide-line">
        <div className="p-4">
          <p className="mb-1.5 text-xs font-medium text-muted">
            毎年{month}月（月次点検）
          </p>
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
              placeholder="例）温度測定。サーモカメラを持参する"
              aria-label={`毎年${month}月の重点実施項目`}
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
                  ＋ 毎年{month}月の重点実施項目を書く
                </span>
              )}
            </button>
          )}
        </div>

        {hasAnnualTarget && (
          <div className="p-4">
            <p className="mb-1.5 text-xs font-medium text-muted">
              {year}年の年次点検
            </p>
            {annual.length === 0 ? (
              <p className="text-sm text-muted">
                今年に該当する項目はありません。
                <Link href="/settings?tab=focus" className="ml-1 text-brand underline">
                  登録する
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {annual.map((a) => (
                  <li key={a.id} className="text-sm">
                    <span className="font-medium">{a.title}</span>
                    <Badge className="ml-2">
                      {a.intervalYears === 1 ? "毎年" : `${a.intervalYears}年ごと`}
                    </Badge>
                    {a.note && (
                      <p className="mt-0.5 text-xs whitespace-pre-wrap text-muted">
                        {a.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
