"use client";

import { Badge, Button, Input, Select } from "@/components/ui";
import { calcFacilityPoints } from "@/lib/calc/coefficient";
import {
  generateCycleMonths,
  monthsWithoutVisit,
  resolveFacilityStartMonth,
} from "@/lib/calc/schedule";
import type {
  FacilityFormValue,
  FormCategory,
  FormMasters,
} from "@/lib/customer-form-types";
import { emptyFacility } from "@/lib/customer-form-types";
import { cn, formatPoints } from "@/lib/utils";

const GROUP_LABEL: Record<FormCategory["categoryGroup"], string> = {
  demand: "需要設備",
  generation: "発電所等",
  other: "その他",
};

/** 設備区分と周期から、その行の点数を計算する */
export function facilityResult(row: FacilityFormValue, masters: FormMasters) {
  const category = masters.categories.find((c) => c.id === row.categoryId);
  const cycle = category?.cycles.find((c) => c.id === row.categoryCycleId);

  const rows = category?.coefficientTableId
    ? (masters.coefficientRows[category.coefficientTableId] ?? [])
    : [];

  const override =
    row.coefficientMode !== "auto" && row.coefficientOverride !== ""
      ? Number(row.coefficientOverride)
      : null;

  return {
    category,
    cycle,
    coefficientRows: rows,
    result: calcFacilityPoints({
      category: {
        calculationMethod: category?.calculationMethod ?? "table",
        capacityUnit: category?.capacityUnit ?? "kVA",
        rows,
        minCapacity: category?.minCapacity ?? null,
        maxCapacity: category?.maxCapacity ?? null,
      },
      cycle: {
        intervalMonths: cycle?.intervalMonths ?? 1,
        multiplier: cycle?.multiplier ?? null,
        fixedPoints: cycle?.fixedPoints ?? null,
      },
      capacity: row.capacity === "" ? null : Number(row.capacity),
      coefficientOverride: override,
    }),
  };
}

/**
 * 事業場に設置されている設備の一覧。
 * 換算値算出フロー図のとおり、設備ごとに区分と周期を選び、点数を合算する。
 */
export function FacilityRows({
  masters,
  facilities,
  inspectionMonths,
  contractStartMonth,
  onChange,
}: {
  masters: FormMasters;
  facilities: FacilityFormValue[];
  /** 顧客の通常点検の実施月。設備の点検開始月はこの中から選ぶ */
  inspectionMonths: number[];
  contractStartMonth: number;
  onChange: (next: FacilityFormValue[]) => void;
}) {
  const update = (uid: string, patch: Partial<FacilityFormValue>) =>
    onChange(facilities.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));

  const changeCategory = (row: FacilityFormValue, categoryId: number) => {
    const category = masters.categories.find((c) => c.id === categoryId);
    update(row.uid, {
      categoryId,
      // 区分を変えると選べる周期も変わるので先頭に戻す
      categoryCycleId: category?.cycles[0]?.id ?? 0,
      coefficientMode: "auto",
      coefficientOverride: "",
      startMonth: "",
      capacity: category?.capacityUnit === "none" ? "" : row.capacity,
    });
  };

  return (
    <div className="space-y-3">
      {facilities.map((row, index) => {
        const { category, cycle, coefficientRows, result } = facilityResult(
          row,
          masters,
        );
        // 換算係数の対象外。容量も係数も点数に効かないので出さない
        const isExcluded = category?.calculationMethod === "excluded";
        const needsCapacity = category?.capacityUnit !== "none" && !isExcluded;
        const isTable = category?.calculationMethod === "table";

        // 毎月の設備は訪問のたびに点検するので、開始月をずらす意味がない
        const interval = cycle?.intervalMonths ?? 1;
        const canShiftStart = interval > 1;
        const defaultStart = resolveFacilityStartMonth(
          null,
          contractStartMonth,
          inspectionMonths,
        );
        const startMonth = resolveFacilityStartMonth(
          row.startMonth === "" ? null : Number(row.startMonth),
          contractStartMonth,
          inspectionMonths,
        );
        const facilityMonths = generateCycleMonths(startMonth, interval);
        const offVisit = monthsWithoutVisit(facilityMonths, inspectionMonths);
        // 訪問月から選ぶ。訪問月が未設定なら 1〜12 月から選ぶ
        const startOptions = [
          ...new Set(
            (inspectionMonths.length > 0
              ? inspectionMonths
              : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
            ).concat(row.startMonth === "" ? [] : [Number(row.startMonth)]),
          ),
        ].sort((a, b) => a - b);

        return (
          <div
            key={row.uid}
            className="rounded-md border border-line bg-canvas/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">
                設備 {index + 1}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "tabular text-sm font-semibold",
                    isExcluded && "text-xs font-normal text-muted",
                  )}
                >
                  {isExcluded ? "換算係数の対象外" : `${formatPoints(result.points)} 点`}
                </span>
                {facilities.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange(facilities.filter((f) => f.uid !== row.uid))
                    }
                    aria-label={`設備 ${index + 1} を削除`}
                  >
                    削除
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">設備区分</label>
                <Select
                  value={row.categoryId}
                  onChange={(e) => changeCategory(row, Number(e.target.value))}
                >
                  {(["demand", "generation", "other"] as const).map((group) => {
                    const items = masters.categories.filter(
                      (c) => c.categoryGroup === group,
                    );
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={group} label={GROUP_LABEL[group]}>
                        {items.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </Select>
              </div>

              {needsCapacity && (
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    設備容量（{category?.capacityUnit}）
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={row.capacity}
                    onChange={(e) => update(row.uid, { capacity: e.target.value })}
                  />
                  {result.capacityOutOfRange && (
                    <p className="mt-1 text-xs text-warn">
                      この区分の適用範囲（
                      {category?.minCapacity != null && `${category.minCapacity}以上`}
                      {category?.maxCapacity != null && `${category.maxCapacity}以下`}
                      ）から外れています
                    </p>
                  )}
                </div>
              )}

              <div className={cn(!needsCapacity && "sm:col-span-2")}>
                <label className="mb-1 block text-xs text-muted">点検周期</label>
                <Select
                  value={row.categoryCycleId}
                  onChange={(e) =>
                    update(row.uid, { categoryCycleId: Number(e.target.value) })
                  }
                >
                  {category?.cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.fixedPoints != null
                        ? `（${c.fixedPoints} 点固定）`
                        : c.multiplier != null
                          ? `（×${c.multiplier}）`
                          : ""}
                    </option>
                  ))}
                </Select>
                <div className="mt-1 flex flex-wrap gap-1">
                  {cycle?.requiresInsulationMonitor && (
                    <Badge tone="warn">絶縁監視装置 必須</Badge>
                  )}
                  {cycle?.conditionNote && <Badge>{cycle.conditionNote}</Badge>}
                </div>
              </div>

              {canShiftStart && (
                <div className="sm:col-span-2 rounded-md border border-line bg-surface p-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        点検開始月
                      </label>
                      <Select
                        value={row.startMonth}
                        onChange={(e) =>
                          update(row.uid, { startMonth: e.target.value })
                        }
                        aria-label={`設備 ${index + 1} の点検開始月`}
                      >
                        <option value="">
                          点検開始月に合わせる（{defaultStart}月）
                        </option>
                        {startOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}月から
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        この設備の点検月
                      </label>
                      <p className="tabular flex h-9 items-center text-sm font-medium">
                        {facilityMonths.length > 0
                          ? `${facilityMonths.join("・")}月`
                          : "実施なし"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    訪問より周期が長い設備の実施月をずらせます。例）隔月訪問で6ヶ月周期の太陽光を9月に実施したなら「9月から」で 9・3月になります
                  </p>
                  {offVisit.length > 0 && (
                    <p className="mt-1 text-xs text-warn">
                      {offVisit.join("・")}月は通常点検の実施月ではありません。実施月を見直すか、この設備の開始月を変えてください。
                    </p>
                  )}
                </div>
              )}

              {isTable && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-muted">換算係数</label>
                    <Select
                      value={row.coefficientMode}
                      onChange={(e) =>
                        update(row.uid, {
                          coefficientMode: e.target
                            .value as FacilityFormValue["coefficientMode"],
                          coefficientOverride: "",
                        })
                      }
                    >
                      <option value="auto">容量から自動判定</option>
                      <option value="select">係数表から選ぶ</option>
                      <option value="manual">数値を直接入力</option>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-muted">
                      {row.coefficientMode === "auto"
                        ? "自動判定された係数"
                        : "適用する係数"}
                    </label>
                    {row.coefficientMode === "select" ? (
                      <Select
                        value={row.coefficientOverride}
                        onChange={(e) =>
                          update(row.uid, { coefficientOverride: e.target.value })
                        }
                      >
                        <option value="">選択してください</option>
                        {coefficientRows.map((r) => (
                          <option key={r.minCapacity} value={r.coefficient}>
                            {r.minCapacity}
                            {r.maxCapacity == null
                              ? "以上"
                              : `以上 ${r.maxCapacity}未満`}
                            {` … ${r.coefficient}`}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={
                          row.coefficientMode === "auto"
                            ? (result.base ?? "")
                            : row.coefficientOverride
                        }
                        disabled={row.coefficientMode === "auto"}
                        onChange={(e) =>
                          update(row.uid, { coefficientOverride: e.target.value })
                        }
                      />
                    )}
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">設備メモ</label>
                <Input
                  value={row.note}
                  placeholder="非常用予備発電機の有無、絶縁監視装置の型式など"
                  onChange={(e) => update(row.uid, { note: e.target.value })}
                />
              </div>
            </div>

            {isExcluded && (
              <p className="mt-2 text-xs text-muted">
                この区分は換算係数を適用しません。保安管理点数には算入しません（0点）。
              </p>
            )}
            {category?.note && (
              <p className="mt-2 text-xs text-muted">{category.note}</p>
            )}
            {!isExcluded && result.points == null && (
              <p className="mt-2 text-xs text-warn">
                {isTable
                  ? "容量が係数表のレンジ外です。係数表から選ぶか、数値を直接入力してください。"
                  : "この周期に点数が設定されていません。設定 → 設備区分で確認してください。"}
              </p>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...facilities, emptyFacility(masters)])}
      >
        ＋ 設備を追加
      </Button>
    </div>
  );
}
