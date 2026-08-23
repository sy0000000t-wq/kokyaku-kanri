"use client";

import { useMemo, useState, useTransition } from "react";
import { saveCoefficientRows } from "@/app/actions/settings";
import { Badge, Button, Card, CardHeader, Input, Select } from "@/components/ui";
import { validateCoefficientRanges } from "@/lib/calc/coefficient-range";
import type { CoefficientRow, CoefficientTable } from "@/db/schema";
import { cn } from "@/lib/utils";

type EditableRow = {
  key: string;
  minCapacity: string;
  maxCapacity: string;
  coefficient: string;
};

const toEditable = (rows: CoefficientRow[]): EditableRow[] =>
  rows.map((r) => ({
    key: `db-${r.id}`,
    minCapacity: String(r.minCapacity),
    maxCapacity: r.maxCapacity == null ? "" : String(r.maxCapacity),
    coefficient: String(r.coefficient),
  }));

/** 5. 換算係数テーブル。保存前にレンジの重複・欠落を検証する */
export function CoefficientEditor({
  tables,
  rowsByTable,
}: {
  tables: CoefficientTable[];
  rowsByTable: Record<number, CoefficientRow[]>;
}) {
  const [tableId, setTableId] = useState(tables[0]?.id ?? 0);
  const [rows, setRows] = useState<EditableRow[]>(toEditable(rowsByTable[tableId] ?? []));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectTable = (id: number) => {
    setTableId(id);
    setRows(toEditable(rowsByTable[id] ?? []));
    setMessage(null);
  };

  const parsed = useMemo(
    () =>
      rows.map((r) => ({
        minCapacity: Number(r.minCapacity),
        maxCapacity: r.maxCapacity === "" ? null : Number(r.maxCapacity),
        coefficient: Number(r.coefficient),
      })),
    [rows],
  );

  const issues = useMemo(() => validateCoefficientRanges(parsed), [parsed]);
  const hasError = issues.some((i) => i.level === "error");

  const update = (key: string, field: keyof EditableRow, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const r = await saveCoefficientRows({ tableId, rows: parsed });
      setMessage(r.ok ? "保存しました" : "エラーがあるため保存できませんでした");
    });
  };

  const table = tables.find((t) => t.id === tableId);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="換算係数テーブル"
        description="下限は「以上」、上限は「未満」。上限を空欄にすると上限なしになります"
        action={
          <Select
            className="w-56"
            value={tableId}
            onChange={(e) => selectTable(Number(e.target.value))}
            aria-label="編集するテーブル"
          >
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        }
      />

      {table?.note && (
        <p className="border-b border-line px-4 py-2 text-xs text-muted">出典：{table.note}</p>
      )}

      <div className="grid grid-cols-[1fr_1fr_1fr_3rem] gap-2 border-b border-line bg-canvas px-4 py-2 text-xs text-muted">
        <span>下限（{table?.unit ?? ""}・以上）</span>
        <span>上限（{table?.unit ?? ""}・未満）</span>
        <span>換算係数</span>
        <span />
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[1fr_1fr_1fr_3rem] items-center gap-2 border-b border-line px-4 py-1.5 last:border-0"
        >
          <Input
            type="number"
            step="0.1"
            value={row.minCapacity}
            onChange={(e) => update(row.key, "minCapacity", e.target.value)}
            aria-label="下限"
          />
          <Input
            type="number"
            step="0.1"
            value={row.maxCapacity}
            placeholder="上限なし"
            onChange={(e) => update(row.key, "maxCapacity", e.target.value)}
            aria-label="上限"
          />
          <Input
            type="number"
            step="0.01"
            value={row.coefficient}
            onChange={(e) => update(row.key, "coefficient", e.target.value)}
            aria-label="換算係数"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
            aria-label="この行を削除"
          >
            削除
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                key: `new-${Date.now()}`,
                minCapacity: "",
                maxCapacity: "",
                coefficient: "",
              },
            ])
          }
        >
          ＋ 行を追加
        </Button>
        <Button type="button" onClick={save} disabled={pending || hasError} size="sm">
          {pending ? "保存中…" : "このテーブルを保存"}
        </Button>
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1 border-t border-line px-4 py-3 text-xs">
          {issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Badge tone={issue.level === "error" ? "danger" : "warn"}>
                {issue.level === "error" ? "エラー" : "警告"}
              </Badge>
              <span className={cn(issue.level === "error" ? "text-danger" : "text-muted")}>
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
