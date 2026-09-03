import {
  seedBillingCycles,
  seedCoefficientTables,
  seedEquipmentCategories,
  seedInspectionCycles,
} from "@/db/seed-data";
import type { AppDocument } from "./document";
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
        requiresInsulationMonitor: c.requiresInsulationMonitor ? 1 : 0,
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
    equipmentCategories: list("equipmentCategories"),
    categoryCycles: list("categoryCycles"),
    inspectionCycles: list("inspectionCycles"),
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
    })),
    // 設備ごとの点検開始月は後から足したので、無ければ顧客に合わせる（null）
    customerFacilities: (list("customerFacilities") as AppDocument["customerFacilities"]).map(
      (f) => ({ ...f, startMonth: f.startMonth ?? null }),
    ),
    customerInspectionMonths: list("customerInspectionMonths"),
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
