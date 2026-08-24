"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteCategoryCycle,
  saveCategoryCycle,
  saveEquipmentCategory,
  type SettingsState,
} from "@/app/actions/settings";
import { Badge, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import type {
  CategoryCycle,
  CoefficientTable,
  EquipmentCategory,
} from "@/db/schema";
import { cn } from "@/lib/utils";

const initial: SettingsState = { status: "idle" };

const GROUP_LABEL: Record<EquipmentCategory["categoryGroup"], string> = {
  demand: "需要設備",
  generation: "発電所等",
  other: "その他",
};

function Status({ state }: { state: SettingsState }) {
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

/**
 * 設備区分マスタ。換算値算出フロー図の分岐そのものを編集する。
 * 区分を選び、その区分で選べる周期と補正（倍率／固定点数）を編集する。
 */
export function CategoryEditor({
  categories,
  cyclesByCategory,
  coefficientTables,
}: {
  categories: EquipmentCategory[];
  cyclesByCategory: Record<number, CategoryCycle[]>;
  coefficientTables: CoefficientTable[];
}) {
  const [selectedId, setSelectedId] = useState(categories[0]?.id ?? 0);
  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const cycles = cyclesByCategory[selectedId] ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="h-fit overflow-hidden">
        <CardHeader title="設備区分" />
        <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
          {(["demand", "generation", "other"] as const).map((group) => {
            const items = categories.filter((c) => c.categoryGroup === group);
            if (items.length === 0) return null;
            return (
              <li key={group}>
                <p className="bg-canvas px-3 py-1.5 text-[11px] font-medium text-muted">
                  {GROUP_LABEL[group]}
                </p>
                <ul>
                  {items.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs hover:bg-canvas",
                          c.id === selectedId && "bg-brand-soft font-medium text-brand",
                          !c.isActive && "text-muted line-through",
                        )}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedId(0)}
            className="w-full"
          >
            ＋ 区分を追加
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <CategoryForm
          key={selected?.id ?? "new"}
          category={selected}
          coefficientTables={coefficientTables}
          sortOrder={categories.length}
        />

        {selected && (
          <CycleList
            category={selected}
            cycles={cycles}
          />
        )}
      </div>
    </div>
  );
}

function CategoryForm({
  category,
  coefficientTables,
  sortOrder,
}: {
  category: EquipmentCategory | null;
  coefficientTables: CoefficientTable[];
  sortOrder: number;
}) {
  const [state, action, pending] = useActionState(saveEquipmentCategory, initial);
  const [method, setMethod] = useState(category?.calculationMethod ?? "table");
  const [unit, setUnit] = useState(category?.capacityUnit ?? "kVA");

  return (
    <Card>
      <CardHeader
        title={category ? "区分の設定" : "新しい区分"}
        description="係数表方式は「容量から係数を引いて倍率を掛ける」、固定方式は「周期ごとの固定点数」です"
      />
      <form action={action}>
        <input type="hidden" name="id" value={category?.id ?? ""} />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="表示名" required className="sm:col-span-2">
            <Input name="name" defaultValue={category?.name ?? ""} />
          </Field>

          <Field label="グループ">
            <Select
              name="categoryGroup"
              defaultValue={category?.categoryGroup ?? "demand"}
            >
              <option value="demand">需要設備</option>
              <option value="generation">発電所等</option>
              <option value="other">その他</option>
            </Select>
          </Field>

          <Field label="点数の決め方">
            <Select
              name="calculationMethod"
              value={method}
              onChange={(e) => setMethod(e.target.value as "table" | "fixed")}
            >
              <option value="table">係数表 × 倍率</option>
              <option value="fixed">周期ごとの固定点数</option>
            </Select>
          </Field>

          <Field label="容量の単位">
            <Select
              name="capacityUnit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as "kVA" | "kW" | "none")}
            >
              <option value="kVA">kVA</option>
              <option value="kW">kW</option>
              <option value="none">容量を使わない</option>
            </Select>
          </Field>

          <Field
            label="換算係数テーブル"
            required={method === "table"}
            hint={method === "fixed" ? "固定方式では使いません" : undefined}
          >
            <Select
              name="coefficientTableId"
              defaultValue={category?.coefficientTableId ?? ""}
              disabled={method === "fixed"}
            >
              <option value="">未設定</option>
              {coefficientTables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="適用容量の下限" hint="範囲外のとき入力画面で警告します">
            <Input
              name="minCapacity"
              type="number"
              step="0.1"
              defaultValue={category?.minCapacity ?? ""}
            />
          </Field>
          <Field label="適用容量の上限">
            <Input
              name="maxCapacity"
              type="number"
              step="0.1"
              defaultValue={category?.maxCapacity ?? ""}
            />
          </Field>

          <Field label="メモ" className="sm:col-span-2">
            <Input name="note" defaultValue={category?.note ?? ""} />
          </Field>

          <Field label="表示順">
            <Input
              name="sortOrder"
              type="number"
              defaultValue={category?.sortOrder ?? sortOrder}
            />
          </Field>
          <Field label="状態">
            <Select name="isActive" defaultValue={category?.isActive ?? 1}>
              <option value="1">有効</option>
              <option value="0">無効</option>
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "保存中…" : category ? "更新する" : "追加する"}
          </Button>
          <Status state={state} />
        </div>
      </form>
    </Card>
  );
}

function CycleList({
  category,
  cycles,
}: {
  category: EquipmentCategory;
  cycles: CategoryCycle[];
}) {
  const isTable = category.calculationMethod === "table";

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={`${category.name} の点検周期`}
        description={
          isTable
            ? "倍率は換算係数に掛ける値です（例：2ヶ月に1回 → 0.6）"
            : "固定点数は容量によらずそのまま点数になります（例：3ヶ月に1回 → 0.2点）"
        }
      />
      <div className="divide-y divide-line">
        {cycles.map((cycle) => (
          <CycleForm key={cycle.id} category={category} cycle={cycle} />
        ))}
        <CycleForm category={category} sortOrder={cycles.length} />
      </div>
    </Card>
  );
}

function CycleForm({
  category,
  cycle,
  sortOrder,
}: {
  category: EquipmentCategory;
  cycle?: CategoryCycle;
  sortOrder?: number;
}) {
  const [state, action, pending] = useActionState(saveCategoryCycle, initial);
  const [deletePending, startDelete] = useTransition();
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const isTable = category.calculationMethod === "table";

  return (
    <form action={action} className="p-3">
      <input type="hidden" name="id" value={cycle?.id ?? ""} />
      <input type="hidden" name="categoryId" value={category.id} />

      <div className="grid items-end gap-2 sm:grid-cols-[minmax(7rem,1.4fr)_5.5rem_6rem_minmax(6rem,1fr)_4rem_auto]">
        <Field label="周期名">
          <Input name="name" defaultValue={cycle?.name ?? ""} placeholder="2ヶ月に1回" />
        </Field>
        <Field label="間隔(月)">
          <Input
            name="intervalMonths"
            type="number"
            min="0"
            max="12"
            defaultValue={cycle?.intervalMonths ?? 1}
          />
        </Field>
        {isTable ? (
          <Field label="倍率">
            <Input
              name="multiplier"
              type="number"
              step="0.001"
              min="0"
              defaultValue={cycle?.multiplier ?? ""}
            />
          </Field>
        ) : (
          <Field label="固定点数">
            <Input
              name="fixedPoints"
              type="number"
              step="0.001"
              min="0"
              defaultValue={cycle?.fixedPoints ?? ""}
            />
          </Field>
        )}
        <Field label="注記">
          <Input
            name="conditionNote"
            defaultValue={cycle?.conditionNote ?? ""}
            placeholder="条件適用 など"
          />
        </Field>
        <Field label="表示順">
          <Input
            name="sortOrder"
            type="number"
            defaultValue={cycle?.sortOrder ?? sortOrder ?? 0}
          />
        </Field>
        <div className="flex items-center gap-1.5 pb-0.5">
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {cycle ? "更新" : "＋ 追加"}
          </Button>
          {cycle && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deletePending}
              onClick={() =>
                startDelete(async () => {
                  const r = await deleteCategoryCycle(cycle.id);
                  if (!r.ok) setDeleteMessage(r.message);
                })
              }
            >
              削除
            </Button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            name="requiresInsulationMonitor"
            defaultChecked={!!cycle?.requiresInsulationMonitor}
          />
          絶縁監視装置が必須
        </label>
        {cycle?.requiresInsulationMonitor ? <Badge tone="warn">必須</Badge> : null}
        <Status state={state} />
        {deleteMessage && <p className="text-xs text-danger">{deleteMessage}</p>}
      </div>
    </form>
  );
}
