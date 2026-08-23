"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteCustomer,
  recalcDistanceFor,
  saveCustomer,
  type ActionState,
} from "@/app/actions/customer";
import { Badge, Button, buttonClass, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { calcSecurityPoints } from "@/lib/calc/coefficient";
import { calcPricing } from "@/lib/calc/pricing";
import { generateCycleMonths, parseYearMonth } from "@/lib/calc/schedule";
import type {
  CustomerFormValues,
  FormMasters,
} from "@/lib/customer-form-types";
import { cn, formatKm, formatPoints, formatYen, MONTHS } from "@/lib/utils";

export type { CustomerFormValues, FormMasters };

const initialState: ActionState = { status: "idle" };

export function CustomerForm({
  masters,
  initial,
}: {
  masters: FormMasters;
  initial: CustomerFormValues;
}) {
  const router = useRouter();
  const [state, formAction, isSaving] = useActionState(saveCustomer, initialState);
  const errors = state.status === "error" ? state.errors : {};

  const [facilityTypeId, setFacilityTypeId] = useState(initial.facilityTypeId);
  const [inspectionCycleId, setInspectionCycleId] = useState(initial.inspectionCycleId);
  const [capacityKva, setCapacityKva] = useState(initial.capacityKva?.toString() ?? "");
  const [capacityKw, setCapacityKw] = useState(initial.capacityKw?.toString() ?? "");
  const [monthlyFee, setMonthlyFee] = useState(initial.monthlyFee.toString());
  const [annualFeeHandling, setAnnualFeeHandling] = useState(initial.annualFeeHandling);
  const [annualInspectionFee, setAnnualInspectionFee] = useState(
    initial.annualInspectionFee?.toString() ?? "",
  );
  const [useCoefficientOverride, setUseCoefficientOverride] = useState(
    initial.coefficientOverride != null,
  );
  const [coefficientOverride, setCoefficientOverride] = useState(
    initial.coefficientOverride?.toString() ?? "",
  );
  const [useUnitPriceOverride, setUseUnitPriceOverride] = useState(
    initial.unitPriceOverride != null,
  );
  const [unitPriceOverride, setUnitPriceOverride] = useState(
    initial.unitPriceOverride?.toString() ?? "",
  );
  const [contractStartDate, setContractStartDate] = useState(initial.contractStartDate);
  const [isActive, setIsActive] = useState(initial.isActive === 1);
  const [contractEndDate, setContractEndDate] = useState(initial.contractEndDate ?? "");
  const [months, setMonths] = useState<number[]>(initial.inspectionMonths);
  const [dirty, setDirty] = useState(false);
  // React 19 は action 実行後に未制御フィールドをリセットするため、
  // 検証エラーで入力が消えないよう全項目を制御コンポーネントにする
  const [fields, setFields] = useState({
    code: initial.code,
    name: initial.name,
    note: initial.note,
    address: initial.address,
    lat: initial.lat?.toString() ?? "",
    lng: initial.lng?.toString() ?? "",
    phone: initial.phone,
    email: initial.email,
    contactPerson: initial.contactPerson,
    annualInspectionMonth: initial.annualInspectionMonth?.toString() ?? "",
    annualInspectionDay: initial.annualInspectionDay?.toString() ?? "",
    billingCycleId: initial.billingCycleId?.toString() ?? "",
    paymentLagMonths: String(initial.paymentLagMonths),
  });
  const bind = (key: keyof typeof fields) => ({
    value: fields[key],
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => setFields((prev) => ({ ...prev, [key]: e.target.value })),
  });
  const [distance, setDistance] = useState({
    km: initial.distanceKm,
    min: initial.durationMin,
    method: initial.distanceMethod,
  });
  const [distanceMessage, setDistanceMessage] = useState<string | null>(null);
  const [recalcPending, startRecalc] = useTransition();

  const facilityType = masters.facilityTypes.find((f) => f.id === facilityTypeId);
  const cycle = masters.inspectionCycles.find((c) => c.id === inspectionCycleId);

  const showKva = facilityType?.capacityUnit === "kVA";
  const showKw =
    facilityType?.capacityUnit === "kW" || facilityType?.secondaryCoefficientTableId != null;

  // §5.4 リアルタイム計算プレビュー
  const preview = useMemo(() => {
    const primaryRows = facilityType?.coefficientTableId
      ? (masters.coefficientRows[facilityType.coefficientTableId] ?? [])
      : [];
    const secondaryRows = facilityType?.secondaryCoefficientTableId
      ? (masters.coefficientRows[facilityType.secondaryCoefficientTableId] ?? [])
      : [];
    const kva = capacityKva === "" ? null : Number(capacityKva);
    const kw = capacityKw === "" ? null : Number(capacityKw);

    const points = calcSecurityPoints({
      primaryRows,
      primaryCapacity: facilityType?.capacityUnit === "kW" ? kw : kva,
      secondaryRows,
      secondaryCapacity: kw,
      cycleMultiplier: cycle?.coefficientMultiplier ?? 1,
      override:
        useCoefficientOverride && coefficientOverride !== ""
          ? Number(coefficientOverride)
          : null,
    });

    const pricing = calcPricing({
      monthlyFee: monthlyFee === "" ? 0 : Number(monthlyFee),
      annualFeeHandling,
      annualInspectionFee: annualInspectionFee === "" ? null : Number(annualInspectionFee),
      taxRate: masters.taxRate,
      points: points.points,
      unitPriceOverride:
        useUnitPriceOverride && unitPriceOverride !== "" ? Number(unitPriceOverride) : null,
    });

    return { points, pricing };
  }, [
    facilityType,
    cycle,
    capacityKva,
    capacityKw,
    monthlyFee,
    annualFeeHandling,
    annualInspectionFee,
    useCoefficientOverride,
    coefficientOverride,
    useUnitPriceOverride,
    unitPriceOverride,
    masters,
  ]);

  /** 周期を選ぶと候補月を自動生成する（§3.7。その後の手修正が最終的な正） */
  const presetMonths = (cycleId: number, startDate: string) => {
    const c = masters.inspectionCycles.find((x) => x.id === cycleId);
    if (!c) return;
    const startMonth = parseYearMonth(startDate)?.month ?? 1;
    setMonths(generateCycleMonths(startMonth, c.intervalMonths));
  };

  // §9 未保存離脱時の確認
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (state.status === "ok") {
      setDirty(false);
      router.push("/customers");
    }
  }, [state, router]);

  const runRecalc = () => {
    if (!initial.id) return;
    setDistanceMessage(null);
    startRecalc(async () => {
      const r = await recalcDistanceFor(initial.id!);
      if (r.ok) {
        setDistance({ km: r.distanceKm, min: null, method: r.method });
        setDistanceMessage(`更新しました（${r.method === "road" ? "道路距離" : "直線距離"}）`);
      } else {
        setDistanceMessage(r.message ?? "距離を取得できませんでした");
      }
    });
  };

  const err = (key: string) =>
    errors[key] ? (
      <p className="mt-1 text-xs text-danger" role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form action={formAction} onChange={() => setDirty(true)} className="space-y-4">
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <input type="hidden" name="isActive" value={isActive ? "1" : "0"} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {/* 1. 基本情報 */}
          <Card>
            <CardHeader title="基本情報" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="顧客ID" required>
                <Input name="code" {...bind("code")} className="font-mono" />
                {err("code")}
              </Field>
              <Field label="物件名称（事業場名）" required className="sm:col-span-2">
                <Input name="name" {...bind("name")} />
                {err("name")}
              </Field>
              <Field label="施設種別" required>
                <Select
                  name="facilityTypeId"
                  value={facilityTypeId}
                  onChange={(e) => setFacilityTypeId(Number(e.target.value))}
                >
                  {masters.facilityTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
                {err("facilityTypeId")}
              </Field>
              <Field label="備考" className="sm:col-span-2">
                <Textarea name="note" {...bind("note")} rows={2} />
              </Field>
            </div>
          </Card>

          {/* 2. 設備情報 */}
          <Card>
            <CardHeader title="設備情報" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {showKva && (
                <Field label="需要設備容量（kVA）" required>
                  <Input
                    name="capacityKva"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={capacityKva}
                    onChange={(e) => setCapacityKva(e.target.value)}
                  />
                  {err("capacityKva")}
                </Field>
              )}
              {showKw && (
                <Field label="太陽光・蓄電所出力（kW）" required>
                  <Input
                    name="capacityKw"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={capacityKw}
                    onChange={(e) => setCapacityKw(e.target.value)}
                  />
                  {err("capacityKw")}
                </Field>
              )}
              <Field label="点検周期" required>
                <Select
                  name="inspectionCycleId"
                  value={inspectionCycleId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setInspectionCycleId(id);
                    presetMonths(id, contractStartDate);
                  }}
                >
                  {masters.inspectionCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                {err("inspectionCycleId")}
              </Field>
              <Field
                label="換算係数"
                hint="未チェックのときは容量と周期から自動計算します"
              >
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      name="useCoefficientOverride"
                      checked={useCoefficientOverride}
                      onChange={(e) => setUseCoefficientOverride(e.target.checked)}
                    />
                    手動で上書き
                  </label>
                  <Input
                    name="coefficientOverride"
                    type="number"
                    step="0.01"
                    min="0"
                    value={coefficientOverride}
                    onChange={(e) => setCoefficientOverride(e.target.value)}
                    disabled={!useCoefficientOverride}
                    placeholder={formatPoints(preview.points.points)}
                  />
                </div>
              </Field>
            </div>
          </Card>

          {/* 3. 料金情報 */}
          <Card>
            <CardHeader title="料金情報" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="月額（税抜・円）" required>
                <Input
                  name="monthlyFee"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                />
                {err("monthlyFee")}
              </Field>
              <Field label="年次点検費の扱い" required>
                <Select
                  name="annualFeeHandling"
                  value={annualFeeHandling}
                  onChange={(e) =>
                    setAnnualFeeHandling(e.target.value as "included" | "separate")
                  }
                >
                  <option value="included">月額に含む</option>
                  <option value="separate">別途請求</option>
                </Select>
              </Field>
              <Field label="年次点検費（税抜・円）" required={annualFeeHandling === "separate"}>
                <Input
                  name="annualInspectionFee"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  value={annualInspectionFee}
                  onChange={(e) => setAnnualInspectionFee(e.target.value)}
                  disabled={annualFeeHandling !== "separate"}
                />
                {err("annualInspectionFee")}
              </Field>
              <Field label="点数単価（円/点）" hint="未チェックのときは年額税抜 ÷（点数×12）">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      name="useUnitPriceOverride"
                      checked={useUnitPriceOverride}
                      onChange={(e) => setUseUnitPriceOverride(e.target.checked)}
                    />
                    手動で上書き
                  </label>
                  <Input
                    name="unitPriceOverride"
                    type="number"
                    step="1"
                    min="0"
                    value={unitPriceOverride}
                    onChange={(e) => setUnitPriceOverride(e.target.value)}
                    disabled={!useUnitPriceOverride}
                    placeholder={
                      preview.pricing.unitPrice != null
                        ? String(preview.pricing.unitPrice)
                        : "—"
                    }
                  />
                </div>
              </Field>
            </div>
          </Card>

          {/* 4. 所在地・連絡先 */}
          <Card>
            <CardHeader title="所在地・連絡先" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="住所" required className="sm:col-span-2">
                <Input name="address" {...bind("address")} />
                {err("address")}
              </Field>

              <details className="sm:col-span-2 rounded-md border border-line px-3 py-2">
                <summary className="cursor-pointer text-xs text-muted">
                  緯度・経度を手入力する（住所から取得できない場合）
                </summary>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label="緯度">
                    <Input name="lat" type="number" step="0.0000001" {...bind("lat")} />
                  </Field>
                  <Field label="経度">
                    <Input name="lng" type="number" step="0.0000001" {...bind("lng")} />
                  </Field>
                </div>
              </details>

              <Field label="距離" className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="tabular">{formatKm(distance.km)}</span>
                  {distance.method === "straight" && <Badge>直線</Badge>}
                  {distance.method === "road" && distance.min != null && (
                    <span className="text-muted">約 {distance.min} 分</span>
                  )}
                  {initial.id ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={runRecalc}
                      disabled={recalcPending}
                    >
                      {recalcPending ? "計算中…" : "距離を再計算"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">保存時に自動算出します</span>
                  )}
                  {distanceMessage && (
                    <span className="text-xs text-muted">{distanceMessage}</span>
                  )}
                </div>
              </Field>

              <Field label="連絡先（電話・複数可）" hint="1行に1件、または「,」区切り">
                <Textarea name="phone" {...bind("phone")} rows={2} />
              </Field>
              <Field label="メール">
                <Input name="email" type="email" {...bind("email")} />
              </Field>
              <Field label="担当者">
                <Input name="contactPerson" {...bind("contactPerson")} />
              </Field>
            </div>
          </Card>

          {/* 5. 契約・スケジュール */}
          <Card>
            <CardHeader title="契約・スケジュール" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="契約開始日" required>
                <Input
                  name="contractStartDate"
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => {
                    setContractStartDate(e.target.value);
                    presetMonths(inspectionCycleId, e.target.value);
                  }}
                />
                {err("contractStartDate")}
              </Field>
              <Field label="契約状態">
                <div className="flex h-9 items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    稼働中
                  </label>
                  {!isActive && <Badge tone="neutral">解除</Badge>}
                </div>
              </Field>
              <Field label="解除日">
                <Input
                  name="contractEndDate"
                  type="date"
                  value={contractEndDate}
                  onChange={(e) => setContractEndDate(e.target.value)}
                  disabled={isActive}
                />
                {err("contractEndDate")}
              </Field>
              <Field label="年次点検月">
                <div className="flex gap-2">
                  <Select name="annualInspectionMonth" {...bind("annualInspectionMonth")}>
                    <option value="">なし</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}月
                      </option>
                    ))}
                  </Select>
                  <Input
                    name="annualInspectionDay"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="日"
                    className="w-20"
                    {...bind("annualInspectionDay")}
                  />
                </div>
              </Field>

              <Field
                label="通常点検の実施月"
                className="sm:col-span-2"
                hint="周期を選ぶと自動でプリセットされます。実運用に合わせて個別に調整できます"
              >
                <div className="flex flex-wrap gap-1.5">
                  {MONTHS.map((m) => {
                    const checked = months.includes(m);
                    return (
                      <label
                        key={m}
                        className={cn(
                          "flex h-9 w-12 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors",
                          checked
                            ? "border-brand bg-brand-soft font-medium text-brand"
                            : "border-line bg-surface text-muted hover:bg-canvas",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="inspectionMonths"
                          value={m}
                          checked={checked}
                          onChange={(e) =>
                            setMonths((prev) =>
                              e.target.checked
                                ? [...prev, m].sort((a, b) => a - b)
                                : prev.filter((x) => x !== m),
                            )
                          }
                          className="sr-only"
                        />
                        {m}月
                      </label>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Card>

          {/* 6. 請求設定 */}
          <Card>
            <CardHeader title="請求設定" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="請求サイクル" hint="点検周期とは別に設定できます">
                <Select name="billingCycleId" {...bind("billingCycleId")}>
                  {masters.billingCycles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="入金までの月数" hint="請求月に対する入金月のずれ">
                <Input
                  name="paymentLagMonths"
                  type="number"
                  min="0"
                  max="12"
                  {...bind("paymentLagMonths")}
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* リアルタイム計算プレビュー */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader title="計算プレビュー" />
            <dl className="divide-y divide-line text-sm">
              <Row label="換算係数（基準）">
                {preview.points.isOverridden ? "—" : formatPoints(preview.points.base)}
              </Row>
              <Row label="点検周期倍率">×{preview.points.multiplier.toFixed(2)}</Row>
              <Row label="保安管理点数" strong>
                {formatPoints(preview.points.points)}
                {preview.points.isOverridden && (
                  <Badge tone="warn" className="ml-1.5">
                    上書
                  </Badge>
                )}
              </Row>
              <Row label="月額税抜">{formatYen(preview.pricing.monthlyExcl)}</Row>
              <Row label="月額税込">{formatYen(preview.pricing.monthlyIncl)}</Row>
              <Row label="年額税抜">{formatYen(preview.pricing.annualExcl)}</Row>
              <Row label="年額税込">{formatYen(preview.pricing.annualIncl)}</Row>
              <Row label="点数単価" strong>
                {preview.pricing.unitPrice != null
                  ? `${formatYen(preview.pricing.unitPrice)}/点`
                  : "—"}
              </Row>
              <Row label="距離">
                {formatKm(distance.km)}
                {distance.method && (
                  <span className="ml-1 text-xs text-muted">
                    （{distance.method === "road" ? "道路" : "直線"}）
                  </span>
                )}
              </Row>
            </dl>
            {preview.points.points == null && !preview.points.isOverridden && (
              <p className="border-t border-line px-4 py-2.5 text-xs text-warn">
                設備容量が換算係数テーブルのレンジ外です。設定画面で行を追加するか、
                換算係数を手動で上書きしてください。
              </p>
            )}
          </Card>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "保存中…" : initial.id ? "保存する" : "登録する"}
            </Button>
            <Link href="/customers" className={buttonClass("outline")}>
              キャンセル
            </Link>
            {initial.id && <DeleteButton id={initial.id} name={initial.name} />}
          </div>

          {state.status === "error" && (
            <p className="mt-2 text-xs text-danger" role="alert">
              {state.message}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("tabular text-right", strong && "font-semibold")}>{children}</dd>
    </div>
  );
}

/** §6 完全削除は二段階確認 */
function DeleteButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  if (step === 0) {
    return (
      <Button type="button" variant="ghost" onClick={() => setStep(1)}>
        削除
      </Button>
    );
  }

  return (
    <div className="w-full rounded-md border border-danger/30 bg-danger-soft p-3 text-xs">
      <p className="font-medium text-danger">
        {name} と、その点検・請求実績をすべて削除します。
      </p>
      <p className="mt-1 text-muted">
        通常は稼働トグルで「解除」してください。削除前に data/deleted/ へ JSON を退避します。
      </p>
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setStep(0)}>
          やめる
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteCustomer(id);
              router.push("/customers");
            })
          }
        >
          {pending ? "削除中…" : "完全に削除する"}
        </Button>
      </div>
    </div>
  );
}
