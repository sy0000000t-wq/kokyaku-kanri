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
import { roundPoints } from "@/lib/calc/round";
import {
  FacilityRows,
  facilityResult,
} from "@/components/customers/facility-rows";
import { calcPricing } from "@/lib/calc/pricing";
import { generateCycleMonths, parseYearMonth } from "@/lib/calc/schedule";
import type {
  CustomerFormValues,
  FacilityFormValue,
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

  const [facilities, setFacilities] = useState<FacilityFormValue[]>(
    initial.facilities,
  );
  const [inspectionCycleId, setInspectionCycleId] = useState(initial.inspectionCycleId);
  const [monthlyFee, setMonthlyFee] = useState(initial.monthlyFee.toString());
  const [annualFeeHandling, setAnnualFeeHandling] = useState(initial.annualFeeHandling);
  const [annualInspectionFee, setAnnualInspectionFee] = useState(
    initial.annualInspectionFee?.toString() ?? "",
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

  const cycle = masters.inspectionCycles.find((c) => c.id === inspectionCycleId);

  // 設備ごとに点数を出して合算する（換算値算出フロー図 参考例1・2）
  const preview = useMemo(() => {
    // facilityResult が容量と手動指定を反映済みなので、行の結果をそのまま足す
    const perFacility = facilities.map((f) => facilityResult(f, masters));
    const values = perFacility.map((p) => p.result.points);
    const total =
      values.length === 0 || values.some((v) => v == null)
        ? null
        : roundPoints(values.reduce<number>((a, b) => a + (b ?? 0), 0));

    const pricing = calcPricing({
      monthlyFee: monthlyFee === "" ? 0 : Number(monthlyFee),
      annualFeeHandling,
      annualInspectionFee: annualInspectionFee === "" ? null : Number(annualInspectionFee),
      taxRate: masters.taxRate,
      points: total,
      unitPriceOverride:
        useUnitPriceOverride && unitPriceOverride !== "" ? Number(unitPriceOverride) : null,
    });

    return { perFacility, total, pricing };
  }, [
    facilities,
    monthlyFee,
    annualFeeHandling,
    annualInspectionFee,
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
      {/* 設備は行数が可変なので JSON でまとめて送る */}
      <input
        type="hidden"
        name="facilities"
        value={JSON.stringify(
          facilities.map((f) => ({
            id: f.id,
            categoryId: f.categoryId,
            categoryCycleId: f.categoryCycleId,
            capacity: f.capacity,
            coefficientOverride:
              f.coefficientMode === "auto" ? "" : f.coefficientOverride,
            note: f.note,
          })),
        )}
      />

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
              <Field label="備考" className="sm:col-span-2">
                <Textarea name="note" {...bind("note")} rows={2} />
              </Field>
            </div>
          </Card>

          {/* 2. 設備情報 */}
          <Card>
            <CardHeader
              title="設備情報"
              description="事業場にある設備ごとに区分と周期を選びます。点数は設備ごとに出して合算します"
            />
            <div className="space-y-4 p-4">
              <FacilityRows
                masters={masters}
                facilities={facilities}
                onChange={(next) => {
                  setFacilities(next);
                  setDirty(true);
                }}
              />
              {err("facilities") && (
                <p className="text-xs text-danger" role="alert">
                  {errors.facilities}
                </p>
              )}

              <Field
                label="訪問周期"
                required
                hint="現場に行く周期です。点検月のプリセットに使います（点数計算には影響しません）"
              >
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
              {preview.perFacility.map((f, i) => (
                <Row
                  key={facilities[i].uid}
                  label={f.category?.name ?? `設備 ${i + 1}`}
                >
                  <span className="text-xs text-muted">
                    {f.result.multiplier != null && f.result.base != null
                      ? `${f.result.base} × ${f.result.multiplier} =`
                      : `${f.cycle?.name ?? ""} =`}
                  </span>
                  <span className="ml-1.5">{formatPoints(f.result.points)}</span>
                  {f.result.isOverridden && (
                    <Badge tone="warn" className="ml-1.5">
                      手動
                    </Badge>
                  )}
                </Row>
              ))}
              <Row label="保安管理点数 合計" strong>
                {formatPoints(preview.total)}
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
            {preview.total == null && (
              <p className="border-t border-line px-4 py-2.5 text-xs text-warn">
                点数を算出できない設備があります。設備情報の警告を確認してください。
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
