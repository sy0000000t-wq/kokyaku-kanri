"use client";

import { useState } from "react";
import { Button, Card, CardHeader, Input, Select } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import type { BillingCycle, InspectionCycle } from "@/lib/store/document";
import { saveBillingCycle, saveInspectionCycle } from "@/lib/store/mutations";

/** 見出し行と入力行で同じグリッド定義を使い、列を揃える */
function HeaderRow({ cols, labels }: { cols: string; labels: string[] }) {
  return (
    <div
      className={`grid ${cols} gap-2 border-b border-line bg-canvas px-4 py-2 text-xs text-muted`}
    >
      {labels.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}

const INSPECTION_COLS = "grid-cols-[minmax(8rem,1.6fr)_6rem_4.5rem_5rem_7rem]";
const BILLING_COLS = "grid-cols-[minmax(8rem,1.6fr)_6rem_4.5rem_5rem_7rem]";

/** 3. 点検周期マスタ */
export function InspectionCycleEditor({ cycles }: { cycles: InspectionCycle[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="点検周期マスタ（訪問周期）"
        description="現場を訪問する周期です。点検月のプリセットに使います。換算係数の倍率は設備区分タブで設定します"
      />
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <HeaderRow
            cols={INSPECTION_COLS}
            labels={["表示名", "実施間隔(月)", "表示順", "状態", ""]}
          />
          {cycles.map((c) => (
            <CycleRow key={c.id} row={c} kind="inspection" />
          ))}
          <CycleRow kind="inspection" sortOrder={cycles.length} />
        </div>
      </div>
    </Card>
  );
}

/** 4. 請求サイクルマスタ */
export function BillingCycleEditor({ cycles }: { cycles: BillingCycle[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="請求サイクルマスタ"
        description="点検が隔月でも請求は毎月、といった組み合わせに対応します"
      />
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <HeaderRow
            cols={BILLING_COLS}
            labels={["表示名", "実施間隔(月)", "表示順", "状態", ""]}
          />
          {cycles.map((c) => (
            <CycleRow key={c.id} row={c} kind="billing" />
          ))}
          <CycleRow kind="billing" sortOrder={cycles.length} />
        </div>
      </div>
    </Card>
  );
}

function CycleRow({
  row,
  kind,
  sortOrder,
}: {
  row?: InspectionCycle | BillingCycle;
  kind: "inspection" | "billing";
  sortOrder?: number;
}) {
  const { update } = useStore();
  const [name, setName] = useState(row?.name ?? "");
  const [intervalMonths, setIntervalMonths] = useState(
    String(row?.intervalMonths ?? 1),
  );
  const [order, setOrder] = useState(String(row?.sortOrder ?? sortOrder ?? 0));
  const [isActive, setIsActive] = useState(String(row?.isActive ?? 1));
  const [error, setError] = useState<string | null>(null);

  const cols = kind === "inspection" ? INSPECTION_COLS : BILLING_COLS;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const interval = Number(intervalMonths);
    if (!name.trim()) return setError("表示名は必須です");
    if (!Number.isFinite(interval) || interval < 0) {
      return setError("実施間隔は 0 以上の整数で入力してください");
    }

    const values = {
      id: row?.id ?? null,
      name: name.trim(),
      intervalMonths: interval,
      sortOrder: Number(order) || 0,
      isActive: isActive === "0" ? 0 : 1,
    };

    update((doc) =>
      kind === "inspection"
        ? saveInspectionCycle(doc, values)
        : saveBillingCycle(doc, values),
    );

    if (!row) {
      setName("");
      setIntervalMonths("1");
    }
  };

  return (
    <form onSubmit={submit} className="border-b border-line last:border-0">
      <div className={`grid ${cols} items-center gap-2 px-4 py-2`}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新しい周期"
        />
        <Input
          type="number"
          min="0"
          max="12"
          value={intervalMonths}
          onChange={(e) => setIntervalMonths(e.target.value)}
        />
        <Input
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        />
        <Select value={isActive} onChange={(e) => setIsActive(e.target.value)}>
          <option value="1">有効</option>
          <option value="0">無効</option>
        </Select>
        <Button type="submit" size="sm" variant="outline">
          {row ? "更新" : "＋ 追加"}
        </Button>
      </div>
      {error && (
        <p className="px-4 pb-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
