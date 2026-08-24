"use client";

import { useActionState } from "react";
import {
  saveBillingCycle,
  saveInspectionCycle,
  type SettingsState,
} from "@/app/actions/settings";
import { Button, Card, CardHeader, Input, Select } from "@/components/ui";
import type { BillingCycle, InspectionCycle } from "@/db/schema";

const initial: SettingsState = { status: "idle" };

function StatusText({ state }: { state: SettingsState }) {
  if (state.status === "idle") return null;
  return (
    <p
      className={state.status === "ok" ? "text-xs text-ok" : "text-xs text-danger"}
      role="status"
    >
      {state.message}
    </p>
  );
}

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
  const [state, action, pending] = useActionState(
    kind === "inspection" ? saveInspectionCycle : saveBillingCycle,
    initial,
  );
  const cols = kind === "inspection" ? INSPECTION_COLS : BILLING_COLS;

  return (
    <form action={action} className="border-b border-line last:border-0">
      <div className={`grid ${cols} items-center gap-2 px-4 py-2`}>
        <input type="hidden" name="id" value={row?.id ?? ""} />
        <Input name="name" defaultValue={row?.name ?? ""} placeholder="新しい周期" />
        <Input
          name="intervalMonths"
          type="number"
          min="0"
          max="12"
          defaultValue={row?.intervalMonths ?? 1}
        />
        <Input name="sortOrder" type="number" defaultValue={row?.sortOrder ?? sortOrder ?? 0} />
        <Select name="isActive" defaultValue={row?.isActive ?? 1}>
          <option value="1">有効</option>
          <option value="0">無効</option>
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {row ? "更新" : "＋ 追加"}
        </Button>
      </div>
      <div className="px-4 pb-1.5">
        <StatusText state={state} />
      </div>
    </form>
  );
}
