import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import type {
  BillingCycle,
  CoefficientRow,
  CoefficientTable,
  Customer,
  FacilityType,
  InspectionCycle,
  Settings,
} from "@/db/schema";
import { calcSecurityPoints } from "@/lib/calc/coefficient";
import { calcPricing, type PricingResult } from "@/lib/calc/pricing";
import { generateCycleMonths, parseYearMonth } from "@/lib/calc/schedule";

export type Masters = {
  settings: Settings;
  facilityTypes: FacilityType[];
  inspectionCycles: InspectionCycle[];
  billingCycles: BillingCycle[];
  coefficientTables: CoefficientTable[];
  coefficientRowsByTable: Map<number, CoefficientRow[]>;
};

export function getSettings(): Settings {
  const found = db.select().from(schema.settings).get();
  if (found) return found;
  // マイグレーション未実行でも画面が落ちないようにする
  return {
    id: 1,
    baseAddress: "",
    baseLat: null,
    baseLng: null,
    googleMapsApiKey: null,
    taxRate: 0.1,
    distanceMode: "auto",
    updatedAt: new Date().toISOString(),
  };
}

export function getMasters(): Masters {
  const coefficientRows = db
    .select()
    .from(schema.coefficientRows)
    .orderBy(asc(schema.coefficientRows.sortOrder))
    .all();

  const coefficientRowsByTable = new Map<number, CoefficientRow[]>();
  for (const row of coefficientRows) {
    const list = coefficientRowsByTable.get(row.tableId) ?? [];
    list.push(row);
    coefficientRowsByTable.set(row.tableId, list);
  }

  return {
    settings: getSettings(),
    facilityTypes: db
      .select()
      .from(schema.facilityTypes)
      .orderBy(asc(schema.facilityTypes.sortOrder))
      .all(),
    inspectionCycles: db
      .select()
      .from(schema.inspectionCycles)
      .orderBy(asc(schema.inspectionCycles.sortOrder))
      .all(),
    billingCycles: db
      .select()
      .from(schema.billingCycles)
      .orderBy(asc(schema.billingCycles.sortOrder))
      .all(),
    coefficientTables: db.select().from(schema.coefficientTables).all(),
    coefficientRowsByTable,
  };
}

export type CustomerView = Customer & {
  facilityType: FacilityType | null;
  inspectionCycle: InspectionCycle | null;
  billingCycle: BillingCycle | null;
  /** customer_inspection_months の内容（最終的な正） */
  inspectionMonths: number[];
  /** 請求サイクルから導出した請求月 */
  billingMonths: number[];
  /** 周期倍率を掛ける前の基準換算係数 */
  baseCoefficient: number | null;
  cycleMultiplier: number;
  points: number | null;
  isPointsOverridden: boolean;
  pricing: PricingResult;
};

/** 顧客1件にマスタと計算結果を載せる（§4.1 / §4.2） */
export function buildCustomerView(
  customer: Customer,
  masters: Masters,
  inspectionMonths: number[],
): CustomerView {
  const facilityType =
    masters.facilityTypes.find((f) => f.id === customer.facilityTypeId) ?? null;
  const inspectionCycle =
    masters.inspectionCycles.find((c) => c.id === customer.inspectionCycleId) ??
    null;
  const billingCycle =
    masters.billingCycles.find((b) => b.id === customer.billingCycleId) ?? null;

  const primaryRows = facilityType?.coefficientTableId
    ? (masters.coefficientRowsByTable.get(facilityType.coefficientTableId) ?? [])
    : [];
  const secondaryRows = facilityType?.secondaryCoefficientTableId
    ? (masters.coefficientRowsByTable.get(
        facilityType.secondaryCoefficientTableId,
      ) ?? [])
    : [];

  // 単位が kW の種別は kW 側の容量を主容量として使う
  const primaryCapacity =
    facilityType?.capacityUnit === "kW" ? customer.capacityKw : customer.capacityKva;

  const points = calcSecurityPoints({
    primaryRows,
    primaryCapacity: primaryCapacity ?? null,
    secondaryRows,
    secondaryCapacity: customer.capacityKw ?? null,
    cycleMultiplier: inspectionCycle?.coefficientMultiplier ?? 1,
    override: customer.coefficientOverride,
  });

  const pricing = calcPricing({
    monthlyFee: customer.monthlyFee,
    annualFeeHandling: customer.annualFeeHandling,
    annualInspectionFee: customer.annualInspectionFee,
    taxRate: masters.settings.taxRate,
    points: points.points,
    unitPriceOverride: customer.unitPriceOverride,
  });

  const startMonth = parseYearMonth(customer.contractStartDate)?.month ?? 1;
  const billingMonths = billingCycle
    ? generateCycleMonths(startMonth, billingCycle.intervalMonths)
    : generateCycleMonths(startMonth, 1);

  return {
    ...customer,
    facilityType,
    inspectionCycle,
    billingCycle,
    inspectionMonths,
    billingMonths,
    baseCoefficient: points.base,
    cycleMultiplier: points.multiplier,
    points: points.points,
    isPointsOverridden: points.isOverridden,
    pricing,
  };
}

export function getInspectionMonthsByCustomer(): Map<number, number[]> {
  const rows = db.select().from(schema.customerInspectionMonths).all();
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const list = map.get(r.customerId) ?? [];
    list.push(r.month);
    map.set(r.customerId, list);
  }
  for (const list of map.values()) list.sort((a, b) => a - b);
  return map;
}

/** 全顧客のビュー。並びは顧客ID順 */
export function getCustomerViews(): CustomerView[] {
  const masters = getMasters();
  const monthsMap = getInspectionMonthsByCustomer();
  return db
    .select()
    .from(schema.customers)
    .orderBy(asc(schema.customers.code))
    .all()
    .map((c) => buildCustomerView(c, masters, monthsMap.get(c.id) ?? []));
}

export function getCustomerView(id: number): CustomerView | null {
  const customer = db.select().from(schema.customers).all().find((c) => c.id === id);
  if (!customer) return null;
  const masters = getMasters();
  const months = getInspectionMonthsByCustomer().get(id) ?? [];
  return buildCustomerView(customer, masters, months);
}

/** §5.3 集計フッター。対象は常に稼働中の行 */
export function summarizeCustomers(views: CustomerView[]) {
  const active = views.filter((v) => v.isActive);
  const points = active.reduce((sum, v) => sum + (v.points ?? 0), 0);
  const monthlyExcl = active.reduce((sum, v) => sum + v.pricing.monthlyExcl, 0);
  const annualExcl = active.reduce((sum, v) => sum + v.pricing.annualExcl, 0);
  const annualIncl = active.reduce((sum, v) => sum + v.pricing.annualIncl, 0);
  const withUnitPrice = active.filter((v) => v.pricing.unitPrice != null);
  const unitPriceAvg =
    withUnitPrice.length > 0
      ? Math.round(
          withUnitPrice.reduce((s, v) => s + (v.pricing.unitPrice ?? 0), 0) /
            withUnitPrice.length,
        )
      : null;

  return {
    count: active.length,
    points: Math.round(points * 100) / 100,
    monthlyExcl,
    annualExcl,
    annualIncl,
    unitPriceAvg,
  };
}
