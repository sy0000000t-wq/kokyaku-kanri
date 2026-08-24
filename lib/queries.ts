import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import type {
  BillingCycle,
  CategoryCycle,
  CoefficientRow,
  CoefficientTable,
  Customer,
  CustomerFacility,
  EquipmentCategory,
  InspectionCycle,
  Settings,
} from "@/db/schema";
import {
  calcSitePoints,
  type CategoryLike,
  type FacilityPointsInput,
  type FacilityPointsResult,
} from "@/lib/calc/coefficient";
import { calcPricing, type PricingResult } from "@/lib/calc/pricing";
import { generateCycleMonths, parseYearMonth } from "@/lib/calc/schedule";

export type Masters = {
  settings: Settings;
  equipmentCategories: EquipmentCategory[];
  categoryCyclesByCategory: Map<number, CategoryCycle[]>;
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

  const categoryCycles = db
    .select()
    .from(schema.categoryCycles)
    .orderBy(asc(schema.categoryCycles.sortOrder))
    .all();

  const categoryCyclesByCategory = new Map<number, CategoryCycle[]>();
  for (const cycle of categoryCycles) {
    const list = categoryCyclesByCategory.get(cycle.categoryId) ?? [];
    list.push(cycle);
    categoryCyclesByCategory.set(cycle.categoryId, list);
  }

  return {
    settings: getSettings(),
    equipmentCategories: db
      .select()
      .from(schema.equipmentCategories)
      .orderBy(asc(schema.equipmentCategories.sortOrder))
      .all(),
    categoryCyclesByCategory,
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

/** 設備区分を計算関数が受け取る形にする */
export function toCategoryLike(
  category: EquipmentCategory,
  masters: Masters,
): CategoryLike {
  return {
    calculationMethod: category.calculationMethod,
    capacityUnit: category.capacityUnit,
    rows: category.coefficientTableId
      ? (masters.coefficientRowsByTable.get(category.coefficientTableId) ?? [])
      : [],
    minCapacity: category.minCapacity,
    maxCapacity: category.maxCapacity,
  };
}

/** 顧客の設備1行に、区分・周期・計算結果を載せたもの */
export type FacilityView = CustomerFacility & {
  category: EquipmentCategory | null;
  cycle: CategoryCycle | null;
  result: FacilityPointsResult;
};

export type CustomerView = Customer & {
  inspectionCycle: InspectionCycle | null;
  billingCycle: BillingCycle | null;
  /** customer_inspection_months の内容（最終的な正） */
  inspectionMonths: number[];
  /** 請求サイクルから導出した請求月 */
  billingMonths: number[];
  facilities: FacilityView[];
  /** 事業場の合計保安管理点数。算出できない設備があれば null */
  points: number | null;
  pricing: PricingResult;
};

/** 顧客1件にマスタと計算結果を載せる */
export function buildCustomerView(
  customer: Customer,
  masters: Masters,
  inspectionMonths: number[],
  facilities: CustomerFacility[],
): CustomerView {
  const inspectionCycle =
    masters.inspectionCycles.find((c) => c.id === customer.inspectionCycleId) ??
    null;
  const billingCycle =
    masters.billingCycles.find((b) => b.id === customer.billingCycleId) ?? null;

  const sorted = [...facilities].sort((a, b) => a.sortOrder - b.sortOrder);

  const inputs: FacilityPointsInput[] = sorted.map((f) => {
    const category =
      masters.equipmentCategories.find((c) => c.id === f.categoryId) ?? null;
    const cycle =
      masters.categoryCyclesByCategory
        .get(f.categoryId)
        ?.find((c) => c.id === f.categoryCycleId) ?? null;

    return {
      category: category
        ? toCategoryLike(category, masters)
        : { calculationMethod: "table", capacityUnit: "kVA", rows: [] },
      cycle: {
        intervalMonths: cycle?.intervalMonths ?? 1,
        multiplier: cycle?.multiplier ?? null,
        fixedPoints: cycle?.fixedPoints ?? null,
      },
      capacity: f.capacity,
      coefficientOverride: f.coefficientOverride,
    };
  });

  const site = calcSitePoints(inputs);

  const facilityViews: FacilityView[] = sorted.map((f, i) => ({
    ...f,
    category: masters.equipmentCategories.find((c) => c.id === f.categoryId) ?? null,
    cycle:
      masters.categoryCyclesByCategory
        .get(f.categoryId)
        ?.find((c) => c.id === f.categoryCycleId) ?? null,
    result: site.facilities[i],
  }));

  const pricing = calcPricing({
    monthlyFee: customer.monthlyFee,
    annualFeeHandling: customer.annualFeeHandling,
    annualInspectionFee: customer.annualInspectionFee,
    taxRate: masters.settings.taxRate,
    points: site.total,
    unitPriceOverride: customer.unitPriceOverride,
  });

  const startMonth = parseYearMonth(customer.contractStartDate)?.month ?? 1;
  const billingMonths = billingCycle
    ? generateCycleMonths(startMonth, billingCycle.intervalMonths)
    : generateCycleMonths(startMonth, 1);

  return {
    ...customer,
    inspectionCycle,
    billingCycle,
    inspectionMonths,
    billingMonths,
    facilities: facilityViews,
    points: site.total,
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

export function getFacilitiesByCustomer(): Map<number, CustomerFacility[]> {
  const rows = db
    .select()
    .from(schema.customerFacilities)
    .orderBy(asc(schema.customerFacilities.sortOrder))
    .all();
  const map = new Map<number, CustomerFacility[]>();
  for (const r of rows) {
    const list = map.get(r.customerId) ?? [];
    list.push(r);
    map.set(r.customerId, list);
  }
  return map;
}

/** 全顧客のビュー。並びは顧客ID順 */
export function getCustomerViews(): CustomerView[] {
  const masters = getMasters();
  const monthsMap = getInspectionMonthsByCustomer();
  const facilitiesMap = getFacilitiesByCustomer();
  return db
    .select()
    .from(schema.customers)
    .orderBy(asc(schema.customers.code))
    .all()
    .map((c) =>
      buildCustomerView(
        c,
        masters,
        monthsMap.get(c.id) ?? [],
        facilitiesMap.get(c.id) ?? [],
      ),
    );
}

export function getCustomerView(id: number): CustomerView | null {
  const customer = db.select().from(schema.customers).all().find((c) => c.id === id);
  if (!customer) return null;
  const masters = getMasters();
  return buildCustomerView(
    customer,
    masters,
    getInspectionMonthsByCustomer().get(id) ?? [],
    getFacilitiesByCustomer().get(id) ?? [],
  );
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
    points: Math.round(points * 1000) / 1000,
    monthlyExcl,
    annualExcl,
    annualIncl,
    unitPriceAvg,
  };
}
