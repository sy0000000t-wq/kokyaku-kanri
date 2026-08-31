"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, Field, Input, Textarea } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import type { AnnualFocus } from "@/lib/store/document";
import {
  deleteAnnualFocus,
  getMonthlyFocus,
  isAnnualFocusDue,
  saveAnnualFocus,
  setMonthlyFocus,
} from "@/lib/store/mutations";
import { MONTHS } from "@/lib/utils";

/**
 * 重点実施項目のまとめ編集。
 * 月次は毎年その月に、年次点検は数年ごとに巡ってくる。
 */
export function FocusEditor() {
  const { doc } = useStore();
  const thisYear = new Date().getFullYear();

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="月次点検の重点実施項目"
          description="毎年その月に巡ってきます。年をまたいでも同じ内容が出ます"
        />
        <div className="divide-y divide-line">
          {MONTHS.map((m) => (
            <MonthlyRow key={m} month={m} note={getMonthlyFocus(doc, m)} />
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="年次点検の重点実施項目"
          description="数年ごとに巡ってくる項目です（例：3年ごとに絶縁耐力試験）"
        />
        <div className="divide-y divide-line">
          {doc.annualFocus.map((item) => (
            <AnnualRow key={item.id} item={item} thisYear={thisYear} />
          ))}
          <AnnualRow thisYear={thisYear} />
        </div>
      </Card>
    </div>
  );
}

function MonthlyRow({ month, note }: { month: number; note: string }) {
  const { update } = useStore();
  const [value, setValue] = useState(note);
  const [dirty, setDirty] = useState(false);

  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)_5rem] items-start gap-3 px-4 py-2.5">
      <span className="pt-2 text-sm font-medium">{month}月</span>
      <Input
        value={value}
        placeholder="例）温度測定"
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (!dirty) return;
          setDirty(false);
          update((d) => setMonthlyFocus(d, { month, note: value }));
        }}
      />
      {value && <span className="pt-2 text-xs text-muted">毎年</span>}
    </div>
  );
}

function AnnualRow({
  item,
  thisYear,
}: {
  item?: AnnualFocus;
  thisYear: number;
}) {
  const { doc, update } = useStore();
  const [title, setTitle] = useState(item?.title ?? "");
  const [intervalYears, setIntervalYears] = useState(
    String(item?.intervalYears ?? 3),
  );
  const [baseYear, setBaseYear] = useState(String(item?.baseYear ?? thisYear));
  const [note, setNote] = useState(item?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("内容は必須です");

    update((d) =>
      saveAnnualFocus(d, {
        id: item?.id ?? null,
        title,
        intervalYears: Number(intervalYears) || 1,
        baseYear: Number(baseYear) || thisYear,
        note,
      }),
    );
    if (!item) {
      setTitle("");
      setNote("");
    }
  };

  // 次に巡ってくる年をいくつか出して、設定を確かめられるようにする
  const upcoming: number[] = [];
  if (item) {
    for (let y = thisYear; y < thisYear + 12 && upcoming.length < 3; y++) {
      if (isAnnualFocusDue(item, y)) upcoming.push(y);
    }
  }
  void doc;

  return (
    <form onSubmit={submit} className="p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_7rem_7rem_auto]">
        <Field label="内容" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例）絶縁耐力試験"
          />
        </Field>
        <Field label="周期（年）">
          <Input
            type="number"
            min="1"
            max="20"
            value={intervalYears}
            onChange={(e) => setIntervalYears(e.target.value)}
          />
        </Field>
        <Field label="起点の年">
          <Input
            type="number"
            min="2000"
            max="2100"
            value={baseYear}
            onChange={(e) => setBaseYear(e.target.value)}
          />
        </Field>
        <div className="flex items-end gap-1.5 pb-0.5">
          <Button type="submit" size="sm" variant="outline">
            {item ? "更新" : "＋ 追加"}
          </Button>
          {item && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => update((d) => deleteAnnualFocus(d, item.id))}
            >
              削除
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2">
        <Textarea
          rows={2}
          value={note}
          placeholder="補足（持ち物、手順など）"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {upcoming.length > 0 && (
          <span className="text-xs text-muted">
            次に該当する年：{upcoming.join("・")}年
          </span>
        )}
        {item && isAnnualFocusDue(item, thisYear) && (
          <Badge tone="warn">今年が該当</Badge>
        )}
        {error && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
