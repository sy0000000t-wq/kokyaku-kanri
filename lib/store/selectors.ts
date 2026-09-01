import {
  calcSitePoints,
  type CategoryLike,
  type FacilityPointsInput,
  type FacilityPointsResult,
} from "@/lib/calc/coefficient";
import { calcPricing, type PricingResult } from "@/lib/calc/pricing";
import {
  generateCycleMonths,
  parseYearMonth,
  resolveFacilityStartMonth,
} from "@/lib/calc/schedule";
import { generateBillingMonths } from "@/lib/calc/billing";
import type {
  AppDocument,
  BillingCycle,
  CategoryCycle,
  CoefficientRow,
  Customer,
  CustomerFacility,
  EquipmentCategory,
  InspectionCycle,
} from "./document";

/** 文書から引きやすい形に組み直したもの。画面ごとに毎回作らず、1回作って渡す */
export type Indexes = {
  coefficientRowsByTable: Map<number, CoefficientRow[]>;
  categoryCyclesByCategory: Map<number, CategoryCycle[]>;
  facilitiesByCustomer: Map<number, CustomerFacility[]>;
  inspectionMonthsByCustomer: Map<number, number[]>;
};

export function buildIndexes(doc: AppDocument): Indexes {
  const coefficientRowsByTable = new Map<number, CoefficientRow[]>();
  for (const row of [...doc.coefficientRows].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = coefficientRowsByTable.get(row.tableId) ?? [];
    list.push(row);
    coefficientRowsByTable.set(row.tableId, list);
  }

  const categoryCyclesByCategory = new Map<number, CategoryCycle[]>();
  for (const cycle of [...doc.categoryCycles].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = categoryCyclesByCategory.get(cycle.categoryId) ?? [];
    list.push(cycle);
    categoryCyclesByCategory.set(cycle.categoryId, list);
  }

  const facilitiesByCustomer = new Map<number, CustomerFacility[]>();
  for (const f of [...doc.customerFacilities].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = facilitiesByCustomer.get(f.customerId) ?? [];
    list.push(f);
    facilitiesByCustomer.set(f.customerId, list);
  }

  const inspectionMonthsByCustomer = new Map<number, number[]>();
  for (const m of doc.customerInspectionMonths) {
    const list = inspectionMonthsByCustomer.get(m.customerId) ?? [];
    list.push(m.month);
    inspectionMonthsByCustomer.set(m.customerId, list);
  }
  for (const list of inspectionMonthsByCustomer.values()) list.sort((a, b) => a - b);

  return {
    coefficientRowsByTable,
    categoryCyclesByCategory,
    facilitiesByCustomer,
    inspectionMonthsByCustomer,
  };
}

/** 設備区分を計算関数が受け取る形にする */
export function toCategoryLike(
  category: EquipmentCategory,
  indexes: Indexes,
): CategoryLike {
  return {
    calculationMethod: category.calculationMethod,
    capacityUnit: category.capacityUnit,
    rows: category.coefficientTableId
      ? (indexes.coefficientRowsByTable.get(category.coefficientTableId) ?? [])
      : [],
    minCapacity: category.minCapacity,
    maxCapacity: category.maxCapacity,
  };
}

export type FacilityView = CustomerFacility & {
  category: EquipmentCategory | null;
  cycle: CategoryCycle | null;
  result: FacilityPointsResult;
  /**
   * この設備の点検を行う月。設備の点検開始月（未指定なら顧客の点検開始月）を
   * 起点に、設備区分の周期を足して導出する。
   * 訪問周期より長い設備（自家消費の太陽光＝6ヶ月に1回など）を、
   * どの訪問で実施するか示すために使う。
   */
  inspectionMonths: number[];
};

export type CustomerView = Customer & {
  inspectionCycle: InspectionCycle | null;
  billingCycle: BillingCycle | null;
  inspectionMonths: number[];
  billingMonths: number[];
  facilities: FacilityView[];
  points: number | null;
  pricing: PricingResult;
};

export function buildCustomerView(
  customer: Customer,
  doc: AppDocument,
  indexes: Indexes,
): CustomerView {
  const inspectionCycle =
    doc.inspectionCycles.find((c) => c.id === customer.inspectionCycleId) ?? null;
  const billingCycle =
    doc.billingCycles.find((b) => b.id === customer.billingCycleId) ?? null;

  const facilities = indexes.facilitiesByCustomer.get(customer.id) ?? [];

  const inputs: FacilityPointsInput[] = facilities.map((f) => {
    const category = doc.equipmentCategories.find((c) => c.id === f.categoryId) ?? null;
    const cycle =
      indexes.categoryCyclesByCategory
        .get(f.categoryId)
        ?.find((c) => c.id === f.categoryCycleId) ?? null;

    return {
      category: category
        ? toCategoryLike(category, indexes)
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

  const startMonthForFacilities =
    parseYearMonth(customer.contractStartDate)?.month ?? 1;
  const customerInspectionMonths = indexes.inspectionMonthsByCustomer.get(customer.id) ?? [];

  const facilityViews: FacilityView[] = facilities.map((f, i) => {
    const cycle =
      indexes.categoryCyclesByCategory
        .get(f.categoryId)
        ?.find((c) => c.id === f.categoryCycleId) ?? null;

    return {
      ...f,
      category: doc.equipmentCategories.find((c) => c.id === f.categoryId) ?? null,
      cycle,
      result: site.facilities[i],
      inspectionMonths: generateCycleMonths(
        resolveFacilityStartMonth(
          f.startMonth,
          startMonthForFacilities,
          customerInspectionMonths,
        ),
        cycle?.intervalMonths ?? 1,
      ),
    };
  });

  const pricing = calcPricing({
    monthlyFee: customer.monthlyFee,
    monthlyFeeTaxMode: customer.monthlyFeeTaxMode,
    annualFeeHandling: customer.annualFeeHandling,
    annualInspectionFee: customer.annualInspectionFee,
    annualFeeTaxMode: customer.annualFeeTaxMode,
    taxRate: doc.settings.taxRate,
    points: site.total,
    unitPriceOverride: customer.unitPriceOverride,
  });

  const startMonth = parseYearMonth(customer.contractStartDate)?.month ?? 1;
  // 請求は対象期間の最終月に行う（隔月なら2ヶ月分をまとめて2ヶ月目に請求）
  const billingMonths = generateBillingMonths(
    startMonth,
    billingCycle?.intervalMonths ?? 1,
  );

  return {
    ...customer,
    inspectionCycle,
    billingCycle,
    inspectionMonths: customerInspectionMonths,
    billingMonths,
    facilities: facilityViews,
    points: site.total,
    pricing,
  };
}

/** 全顧客のビュー。並びは顧客ID順 */
export function getCustomerViews(doc: AppDocument, indexes: Indexes): CustomerView[] {
  return [...doc.customers]
    .sort((a, b) => a.code.localeCompare(b.code, "ja"))
    .map((c) => buildCustomerView(c, doc, indexes));
}

export function getCustomerView(
  doc: AppDocument,
  indexes: Indexes,
  id: number,
): CustomerView | null {
  const customer = doc.customers.find((c) => c.id === id);
  return customer ? buildCustomerView(customer, doc, indexes) : null;
}

/** 集計フッター。対象は常に稼働中の行 */
export function summarizeCustomers(views: CustomerView[]) {
  const active = views.filter((v) => v.isActive);
  const points = active.reduce((sum, v) => sum + (v.points ?? 0), 0);
  const withUnitPrice = active.filter((v) => v.pricing.unitPrice != null);

  return {
    count: active.length,
    points: Math.round(points * 1000) / 1000,
    monthlyExcl: active.reduce((s, v) => s + v.pricing.monthlyExcl, 0),
    monthlyIncl: active.reduce((s, v) => s + v.pricing.monthlyIncl, 0),
    annualExcl: active.reduce((s, v) => s + v.pricing.annualExcl, 0),
    annualIncl: active.reduce((s, v) => s + v.pricing.annualIncl, 0),
    // 別途請求のものだけ足す（月額に含む物件は 0 として扱われる）
    annualInspectionFeeExcl: active.reduce(
      (s, v) => s + v.pricing.annualInspectionFeeExcl,
      0,
    ),
    unitPriceAvg:
      withUnitPrice.length > 0
        ? Math.round(
            withUnitPrice.reduce((s, v) => s + (v.pricing.unitPrice ?? 0), 0) /
              withUnitPrice.length,
          )
        : null,
  };
}
