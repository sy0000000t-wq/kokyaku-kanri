import {
  seedBillingCycles,
  seedCoefficientTables,
  seedEquipmentCategories,
  seedInspectionCycles,
} from "@/db/seed-data";
import { generateBillingMonths } from "@/lib/calc/billing";
import { parseYearMonth } from "@/lib/calc/schedule";
import type { AppDocument } from "./document";

/** 年次点検だけを請ける契約を表す設備区分の名前 */
const ANNUAL_SUBCONTRACT_NAME = "年次請け";
import {
  DOCUMENT_VERSION,
  NOT_SAVED,
  defaultSettings,
  type CategoryCycle,
  type CoefficientRow,
  type CoefficientTable,
  type EquipmentCategory,
} from "./document";

/** マスタだけ入った、顧客ゼロの初期文書を作る */
export function createInitialDocument(): AppDocument {
  const coefficientTables: CoefficientTable[] = [];
  const coefficientRows: CoefficientRow[] = [];
  let tableId = 0;
  let rowId = 0;

  for (const table of seedCoefficientTables) {
    tableId += 1;
    coefficientTables.push({
      id: tableId,
      name: table.name,
      unit: table.unit,
      note: table.note,
    });
    table.rows.forEach((r, i) => {
      rowId += 1;
      coefficientRows.push({
        id: rowId,
        tableId,
        minCapacity: r.minCapacity,
        maxCapacity: r.maxCapacity,
        coefficient: r.coefficient,
        sortOrder: i,
      });
    });
  }

  const tableIdByName = new Map(coefficientTables.map((t) => [t.name, t.id]));

  const equipmentCategories: EquipmentCategory[] = [];
  const categoryCycles: CategoryCycle[] = [];
  let categoryId = 0;
  let cycleId = 0;

  for (const [index, category] of seedEquipmentCategories.entries()) {
    categoryId += 1;
    equipmentCategories.push({
      id: categoryId,
      name: category.name,
      categoryGroup: category.categoryGroup,
      capacityUnit: category.capacityUnit,
      calculationMethod: category.calculationMethod,
      coefficientTableId: category.table
        ? (tableIdByName.get(category.table) ?? null)
        : null,
      minCapacity: category.minCapacity ?? null,
      maxCapacity: category.maxCapacity ?? null,
      note: category.note ?? "",
      sortOrder: index,
      isActive: 1,
    });

    category.cycles.forEach((c, i) => {
      cycleId += 1;
      categoryCycles.push({
        id: cycleId,
        categoryId,
        name: c.name,
        intervalMonths: c.intervalMonths,
        multiplier: c.multiplier ?? null,
        fixedPoints: c.fixedPoints ?? null,
        conditionNote: c.conditionNote ?? "",
        sortOrder: i,
      });
    });
  }

  return {
    version: DOCUMENT_VERSION,
    savedAt: NOT_SAVED,
    settings: defaultSettings(),
    coefficientTables,
    coefficientRows,
    equipmentCategories,
    categoryCycles,
    inspectionCycles: seedInspectionCycles.map((c, i) => ({
      id: i + 1,
      name: c.name,
      intervalMonths: c.intervalMonths,
      sortOrder: i,
      isActive: 1,
    })),
    billingCycles: seedBillingCycles.map((c, i) => ({
      id: i + 1,
      name: c.name,
      intervalMonths: c.intervalMonths,
      sortOrder: i,
      isActive: 1,
    })),
    customers: [],
    customerFacilities: [],
    customerInspectionMonths: [],
    customerBillingMonths: [],
    inspectionRecords: [],
    billingRecords: [],
    monthlyFocus: [],
    annualFocus: [],
  };
}

/**
 * 読み込んだ JSON を検証して文書にする。
 * SQLite 版のエクスポート（version 1）もそのまま受け入れる。
 */
export function parseDocument(raw: unknown): AppDocument {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("データの形式が正しくありません");
  }
  const d = raw as Partial<AppDocument> & Record<string, unknown>;

  const required = ["customers", "equipmentCategories", "coefficientRows"] as const;
  for (const key of required) {
    if (!Array.isArray(d[key])) {
      throw new Error(`データに ${key} が含まれていません`);
    }
  }

  const base = createInitialDocument();
  const list = <K extends keyof AppDocument>(key: K): AppDocument[K] =>
    (Array.isArray(d[key]) ? d[key] : base[key]) as AppDocument[K];

  // settings は SQLite 版では配列だった
  const rawSettings = Array.isArray(d.settings) ? d.settings[0] : d.settings;

  return {
    version: DOCUMENT_VERSION,
    savedAt: typeof d.savedAt === "string" ? d.savedAt : new Date().toISOString(),
    // 設定も項目を増やしているので、既定値の上に読み込んだ値を重ねる
    settings: { ...base.settings, ...(rawSettings as object | undefined) },
    coefficientTables: list("coefficientTables"),
    coefficientRows: list("coefficientRows"),
    ...withAnnualSubcontract(
      list("equipmentCategories") as AppDocument["equipmentCategories"],
      // 「絶縁監視装置が必須」はやめたので、古いデータからは落とす
      (list("categoryCycles") as AppDocument["categoryCycles"]).map(
        ({ ...c }) => {
          delete (c as { requiresInsulationMonitor?: number })
            .requiresInsulationMonitor;
          return c;
        },
      ),
    ),
    // 「年次点検のみ」は後から足した周期なので、無ければ補う
    inspectionCycles: withAnnualOnlyCycle(
      list("inspectionCycles") as AppDocument["inspectionCycles"],
    ),
    billingCycles: list("billingCycles"),
    // 項目を後から増やしているので、古いデータには既定値を補う
    customers: (list("customers") as AppDocument["customers"]).map((c) => ({
      ...c,
      // 以前は月額と年次点検費でひとつの設定だった。無ければ税抜として扱う
      monthlyFeeTaxMode:
        c.monthlyFeeTaxMode ??
        (c as { feeTaxMode?: "excluded" | "included" }).feeTaxMode ??
        "excluded",
      annualFeeTaxMode:
        c.annualFeeTaxMode ??
        (c as { feeTaxMode?: "excluded" | "included" }).feeTaxMode ??
        "excluded",
      annualAvailability: c.annualAvailability ?? "unspecified",
      annualAvailabilityNote: c.annualAvailabilityNote ?? "",
      priorContactRequired: c.priorContactRequired ?? 0,
      priorContactNote: c.priorContactNote ?? "",
      switchgearRequestRequired: c.switchgearRequestRequired ?? 0,
      switchgearRequestNote: c.switchgearRequestNote ?? "",
      // これまでは期間ぶんをまとめる前提だったので、既定はそのまま
      billingCoverage: c.billingCoverage ?? "period",
    })),
    // 設備ごとの点検開始月は後から足したので、無ければ顧客に合わせる（null）
    customerFacilities: (list("customerFacilities") as AppDocument["customerFacilities"]).map(
      (f) => ({ ...f, startMonth: f.startMonth ?? null }),
    ),
    customerInspectionMonths: list("customerInspectionMonths"),
    // 請求月は後から持つようにしたので、無ければ請求サイクルから起こす
    customerBillingMonths: Array.isArray(d.customerBillingMonths)
      ? (d.customerBillingMonths as AppDocument["customerBillingMonths"])
      : billingMonthsFromCycle(
          list("customers") as AppDocument["customers"],
          list("billingCycles") as AppDocument["billingCycles"],
        ),
    // 報告書提出と応援依頼は後から足したので、既定値を補う
    inspectionRecords: (list("inspectionRecords") as AppDocument["inspectionRecords"]).map(
      (r) => ({
        ...r,
        isReported: r.isReported ?? 0,
        reportedDate: r.reportedDate ?? null,
        isSwitchgearRequested: r.isSwitchgearRequested ?? 0,
        switchgearRequestedDate: r.switchgearRequestedDate ?? null,
        needsHelper: r.needsHelper ?? 0,
        helperName: r.helperName ?? "",
      }),
    ),
    billingRecords: list("billingRecords"),
    // 以前は年月ごとの覚書だった。月次の重点実施項目として引き継ぐ
    monthlyFocus: Array.isArray(d.monthlyFocus)
      ? (d.monthlyFocus as AppDocument["monthlyFocus"])
      : ((d.monthlyNotes as { month: number; note: string }[] | undefined) ?? [])
          .filter((n) => n && n.note)
          .map((n) => ({ month: n.month, note: n.note })),
    annualFocus: list("annualFocus"),
  };
}

/** 通常点検のない契約（年次点検のみ）を選べるようにする */
function withAnnualOnlyCycle(
  cycles: AppDocument["inspectionCycles"],
): AppDocument["inspectionCycles"] {
  if (cycles.some((c) => c.intervalMonths === 0)) return cycles;
  return [
    ...cycles,
    {
      id: Math.max(0, ...cycles.map((c) => c.id)) + 1,
      name: "年次点検のみ",
      intervalMonths: 0,
      sortOrder: Math.max(0, ...cycles.map((c) => c.sortOrder)) + 1,
      isActive: 1,
    },
  ];
}

/**
 * 年次点検だけを請ける仕事は保安管理業務ではないので、換算係数を当てない。
 * 手で作ってある場合はそれを活かし、点数の決め方だけ「適用しない」に寄せる。
 */
function withAnnualSubcontract(
  categories: AppDocument["equipmentCategories"],
  cycles: AppDocument["categoryCycles"],
): {
  equipmentCategories: AppDocument["equipmentCategories"];
  categoryCycles: AppDocument["categoryCycles"];
} {
  const found = categories.find((c) => c.name === ANNUAL_SUBCONTRACT_NAME);

  const category = found ?? {
    id: Math.max(0, ...categories.map((c) => c.id)) + 1,
    name: ANNUAL_SUBCONTRACT_NAME,
    categoryGroup: "other" as const,
    capacityUnit: "none" as const,
    calculationMethod: "excluded" as const,
    coefficientTableId: null,
    minCapacity: null,
    maxCapacity: null,
    note: "年次点検だけを請ける契約。換算係数を適用せず、保安管理点数にも算入しません",
    sortOrder: Math.max(0, ...categories.map((c) => c.sortOrder)) + 1,
    isActive: 1,
  };

  const nextCategories = found
    ? categories.map((c) =>
        c.id === category.id ? { ...c, calculationMethod: "excluded" as const } : c,
      )
    : [...categories, category];

  // 設備行には周期の指定が要るので、1つも無ければ足す
  const hasCycle = cycles.some((c) => c.categoryId === category.id);
  const nextCycles = hasCycle
    ? cycles
    : [
        ...cycles,
        {
          id: Math.max(0, ...cycles.map((c) => c.id)) + 1,
          categoryId: category.id,
          name: "年1回",
          intervalMonths: 12,
          multiplier: null,
          fixedPoints: null,
          conditionNote: "",
          sortOrder: 0,
        },
      ];

  return { equipmentCategories: nextCategories, categoryCycles: nextCycles };
}

/**
 * 請求月を持っていない古いデータのために、
 * 契約開始月と請求サイクルから、これまでと同じ請求月を起こす。
 */
function billingMonthsFromCycle(
  customers: AppDocument["customers"],
  billingCycles: AppDocument["billingCycles"],
): AppDocument["customerBillingMonths"] {
  return customers.flatMap((c) => {
    const cycle = billingCycles.find((b) => b.id === c.billingCycleId);
    const startMonth = parseYearMonth(c.contractStartDate)?.month ?? 1;
    return generateBillingMonths(startMonth, cycle?.intervalMonths ?? 1).map(
      (month) => ({ customerId: c.id, month }),
    );
  });
}
