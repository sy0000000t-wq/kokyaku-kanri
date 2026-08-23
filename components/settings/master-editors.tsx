"use client";

import { useActionState } from "react";
import {
  saveBillingCycle,
  saveFacilityType,
  saveInspectionCycle,
  type SettingsState,
} from "@/app/actions/settings";
import { Button, Card, CardHeader, Input, Select } from "@/components/ui";
import type {
  BillingCycle,
  CoefficientTable,
  FacilityType,
  InspectionCycle,
} from "@/db/schema";

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

const FACILITY_COLS =
  "grid-cols-[minmax(8rem,1.4fr)_5rem_minmax(8rem,1.4fr)_minmax(8rem,1.4fr)_4.5rem_5rem_7rem]";

/** 2. 施設種別マスタ */
export function FacilityTypeEditor({
  facilityTypes,
  coefficientTables,
}: {
  facilityTypes: FacilityType[];
  coefficientTables: CoefficientTable[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="施設種別マスタ"
        description="単位と適用する換算係数テーブルを指定します。無効化しても既存顧客の参照は壊れません"
      />
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <HeaderRow
            cols={FACILITY_COLS}
            labels={[
              "表示名",
              "単位",
              "換算係数テーブル",
              "合算する係数テーブル",
              "表示順",
              "状態",
              "",
            ]}
          />
          {facilityTypes.map((f) => (
            <FacilityTypeRow key={f.id} row={f} tables={coefficientTables} />
          ))}
          <FacilityTypeRow tables={coefficientTables} sortOrder={facilityTypes.length} />
        </div>
      </div>
    </Card>
  );
}

function FacilityTypeRow({
  row,
  tables,
  sortOrder,
}: {
  row?: FacilityType;
  tables: CoefficientTable[];
  sortOrder?: number;
}) {
  const [state, action, pending] = useActionState(saveFacilityType, initial);

  return (
    <form action={action} className="border-b border-line last:border-0">
      <div className={`grid ${FACILITY_COLS} items-center gap-2 px-4 py-2`}>
        <input type="hidden" name="id" value={row?.id ?? ""} />
        <Input name="name" defaultValue={row?.name ?? ""} placeholder="新しい種別" />
        <Select name="capacityUnit" defaultValue={row?.capacityUnit ?? "kVA"}>
          <option value="kVA">kVA</option>
          <option value="kW">kW</option>
        </Select>
        <Select name="coefficientTableId" defaultValue={row?.coefficientTableId ?? ""}>
          <option value="">未設定</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          name="secondaryCoefficientTableId"
          defaultValue={row?.secondaryCoefficientTableId ?? ""}
        >
          <option value="">なし</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
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

const INSPECTION_COLS =
  "grid-cols-[minmax(8rem,1.6fr)_6rem_6rem_4.5rem_5rem_7rem]";
const BILLING_COLS = "grid-cols-[minmax(8rem,1.6fr)_6rem_4.5rem_5rem_7rem]";

/** 3. 点検周期マスタ */
export function InspectionCycleEditor({ cycles }: { cycles: InspectionCycle[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="点検周期マスタ"
        description="倍率は換算係数に掛ける値です。実施間隔 0 は「実施なし」を意味します"
      />
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <HeaderRow
            cols={INSPECTION_COLS}
            labels={["表示名", "実施間隔(月)", "倍率", "表示順", "状態", ""]}
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
  const multiplier = row && "coefficientMultiplier" in row ? row.coefficientMultiplier : 1;
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
        {kind === "inspection" && (
          <Input
            name="coefficientMultiplier"
            type="number"
            step="0.001"
            min="0"
            defaultValue={multiplier}
          />
        )}
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
