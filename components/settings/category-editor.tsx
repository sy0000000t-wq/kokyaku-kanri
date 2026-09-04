"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import type {
  CategoryCycle,
  CategoryGroup,
  CoefficientTable,
  EquipmentCategory,
} from "@/lib/store/document";
import {
  deleteCategoryCycle,
  saveCategoryCycle,
  saveEquipmentCategory,
} from "@/lib/store/mutations";
import { cn } from "@/lib/utils";

const GROUP_LABEL: Record<EquipmentCategory["categoryGroup"], string> = {
  demand: "需要設備",
  generation: "発電所等",
  other: "その他",
};

function Status({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error) {
    return (
      <p className="text-xs text-danger" role="alert">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="text-xs text-ok" role="status">
        {ok}
      </p>
    );
  }
  return null;
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
  const { update } = useStore();
  const [name, setName] = useState(category?.name ?? "");
  const [group, setGroup] = useState<CategoryGroup>(category?.categoryGroup ?? "demand");
  const [method, setMethod] = useState(category?.calculationMethod ?? "table");
  const [unit, setUnit] = useState(category?.capacityUnit ?? "kVA");
  const [tableId, setTableId] = useState(category?.coefficientTableId?.toString() ?? "");
  const [minCapacity, setMinCapacity] = useState(category?.minCapacity?.toString() ?? "");
  const [maxCapacity, setMaxCapacity] = useState(category?.maxCapacity?.toString() ?? "");
  const [note, setNote] = useState(category?.note ?? "");
  const [order, setOrder] = useState(String(category?.sortOrder ?? sortOrder));
  const [isActive, setIsActive] = useState(String(category?.isActive ?? 1));
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null);
    setError(null);

    if (!name.trim()) return setError("表示名は必須です");
    if (method === "table" && !tableId) {
      return setError("係数表方式では換算係数テーブルの指定が必要です");
    }

    update((doc) =>
      saveEquipmentCategory(doc, {
        id: category?.id ?? null,
        name: name.trim(),
        categoryGroup: group,
        capacityUnit: unit,
        calculationMethod: method,
        coefficientTableId: tableId ? Number(tableId) : null,
        minCapacity: minCapacity === "" ? null : Number(minCapacity),
        maxCapacity: maxCapacity === "" ? null : Number(maxCapacity),
        note,
        sortOrder: Number(order) || 0,
        isActive: isActive === "0" ? 0 : 1,
      }),
    );
    setOk(category ? "更新しました" : "追加しました");
  };

  return (
    <Card>
      <CardHeader
        title={category ? "区分の設定" : "新しい区分"}
        description="係数表方式は「容量から係数を引いて倍率を掛ける」、固定方式は「周期ごとの固定点数」。年次請けのように保安管理点数に入らないものは「換算係数を適用しない」を選びます"
      />
      <form onSubmit={submit}>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="表示名" required className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="グループ">
            <Select
              value={group}
              onChange={(e) => setGroup(e.target.value as CategoryGroup)}
            >
              <option value="demand">需要設備</option>
              <option value="generation">発電所等</option>
              <option value="other">その他</option>
            </Select>
          </Field>

          <Field label="点数の決め方">
            <Select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as "table" | "fixed" | "excluded")
              }
            >
              <option value="table">係数表 × 倍率</option>
              <option value="fixed">周期ごとの固定点数</option>
              <option value="excluded">換算係数を適用しない（0点）</option>
            </Select>
          </Field>

          <Field label="容量の単位">
            <Select
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
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
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
              type="number"
              step="0.1"
              value={minCapacity}
              onChange={(e) => setMinCapacity(e.target.value)}
            />
          </Field>
          <Field label="適用容量の上限">
            <Input
              type="number"
              step="0.1"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
            />
          </Field>

          <Field label="メモ" className="sm:col-span-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <Field label="表示順">
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </Field>
          <Field label="状態">
            <Select value={isActive} onChange={(e) => setIsActive(e.target.value)}>
              <option value="1">有効</option>
              <option value="0">無効</option>
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Button type="submit" size="sm">
            {category ? "更新する" : "追加する"}
          </Button>
          <Status ok={ok} error={error} />
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
          category.calculationMethod === "excluded"
            ? "この区分は換算係数を適用しないので、周期は点数に影響しません（実施月の割り出しにだけ使います）"
            : isTable
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
  const { update, updateWith } = useStore();
  const isTable = category.calculationMethod === "table";

  const [name, setName] = useState(cycle?.name ?? "");
  const [intervalMonths, setIntervalMonths] = useState(String(cycle?.intervalMonths ?? 1));
  const [value, setValue] = useState(
    (isTable ? cycle?.multiplier : cycle?.fixedPoints)?.toString() ?? "",
  );
  const [conditionNote, setConditionNote] = useState(cycle?.conditionNote ?? "");
  const [order, setOrder] = useState(String(cycle?.sortOrder ?? sortOrder ?? 0));
  const [requiresMonitor, setRequiresMonitor] = useState(
    !!cycle?.requiresInsulationMonitor,
  );
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const interval = Number(intervalMonths);
    const num = value === "" ? null : Number(value);

    if (!name.trim()) return setError("周期名は必須です");
    if (!Number.isFinite(interval) || interval < 0) {
      return setError("実施間隔は 0 以上の整数で入力してください");
    }
    if (num == null || !Number.isFinite(num)) {
      return setError(isTable ? "倍率が必要です" : "固定点数が必要です");
    }

    update((doc) =>
      saveCategoryCycle(doc, {
        id: cycle?.id ?? null,
        categoryId: category.id,
        name: name.trim(),
        intervalMonths: interval,
        multiplier: isTable ? num : null,
        fixedPoints: isTable ? null : num,
        requiresInsulationMonitor: requiresMonitor ? 1 : 0,
        conditionNote,
        sortOrder: Number(order) || 0,
      }),
    );

    if (!cycle) {
      setName("");
      setValue("");
      setConditionNote("");
    }
  };

  const remove = () => {
    setError(null);
    if (!cycle) return;
    const result = updateWith((doc) => {
      const r = deleteCategoryCycle(doc, cycle.id);
      return { doc: r.doc, result: r };
    });
    if (!result.ok) setError(result.message ?? "削除できませんでした");
  };

  return (
    <form onSubmit={submit} className="p-3">
      <div className="grid items-end gap-2 sm:grid-cols-[minmax(7rem,1.4fr)_5.5rem_6rem_minmax(6rem,1fr)_4rem_auto]">
        <Field label="周期名">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2ヶ月に1回"
          />
        </Field>
        <Field label="間隔(月)">
          <Input
            type="number"
            min="0"
            max="12"
            value={intervalMonths}
            onChange={(e) => setIntervalMonths(e.target.value)}
          />
        </Field>
        <Field label={isTable ? "倍率" : "固定点数"}>
          <Input
            type="number"
            step="0.001"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="注記">
          <Input
            value={conditionNote}
            onChange={(e) => setConditionNote(e.target.value)}
            placeholder="条件適用 など"
          />
        </Field>
        <Field label="表示順">
          <Input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-1.5 pb-0.5">
          <Button type="submit" variant="outline" size="sm">
            {cycle ? "更新" : "＋ 追加"}
          </Button>
          {cycle && (
            <Button type="button" variant="ghost" size="sm" onClick={remove}>
              削除
            </Button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={requiresMonitor}
            onChange={(e) => setRequiresMonitor(e.target.checked)}
          />
          絶縁監視装置が必須
        </label>
        {cycle?.requiresInsulationMonitor ? <Badge tone="warn">必須</Badge> : null}
        <Status error={error} />
      </div>
    </form>
  );
}
