/**
 * アプリのデータ全体を表す1つの文書。
 * Google ドライブにはこの形の JSON を1ファイルとして置く。
 *
 * SQLite 版の JSON エクスポート（lib/data-transfer.ts）と同じ形にしてあるので、
 * 既存データはそのまま持ち込める。
 */

export const DOCUMENT_VERSION = 2;

export type DistanceMode = "auto" | "road" | "straight";
export type CapacityUnit = "kVA" | "kW" | "none";
export type CalculationMethod = "table" | "fixed";
export type CategoryGroup = "demand" | "generation" | "other";
export type AnnualFeeHandling = "included" | "separate";
export type DistanceMethod = "road" | "straight";
export type InspectionType = "regular" | "annual";

export type Settings = {
  baseAddress: string;
  baseLat: number | null;
  baseLng: number | null;
  googleMapsApiKey: string | null;
  taxRate: number;
  distanceMode: DistanceMode;
  updatedAt: string;
};

export type CoefficientTable = {
  id: number;
  name: string;
  unit: "kVA" | "kW";
  note: string;
};

export type CoefficientRow = {
  id: number;
  tableId: number;
  minCapacity: number;
  /** null は上限なし */
  maxCapacity: number | null;
  coefficient: number;
  sortOrder: number;
};

export type EquipmentCategory = {
  id: number;
  name: string;
  categoryGroup: CategoryGroup;
  capacityUnit: CapacityUnit;
  calculationMethod: CalculationMethod;
  coefficientTableId: number | null;
  minCapacity: number | null;
  maxCapacity: number | null;
  note: string;
  sortOrder: number;
  isActive: number;
};

export type CategoryCycle = {
  id: number;
  categoryId: number;
  name: string;
  intervalMonths: number;
  multiplier: number | null;
  fixedPoints: number | null;
  requiresInsulationMonitor: number;
  conditionNote: string;
  sortOrder: number;
};

export type InspectionCycle = {
  id: number;
  name: string;
  intervalMonths: number;
  sortOrder: number;
  isActive: number;
};

export type BillingCycle = {
  id: number;
  name: string;
  intervalMonths: number;
  sortOrder: number;
  isActive: number;
};

export type Customer = {
  id: number;
  code: string;
  name: string;
  inspectionCycleId: number;
  monthlyFee: number;
  annualFeeHandling: AnnualFeeHandling;
  annualInspectionFee: number | null;
  unitPriceOverride: number | null;
  address: string;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  durationMin: number | null;
  distanceMethod: DistanceMethod | null;
  distanceUpdatedAt: string | null;
  phone: string;
  email: string;
  contactPerson: string;
  contractStartDate: string;
  contractEndDate: string | null;
  annualInspectionMonth: number | null;
  annualInspectionDay: number | null;
  billingCycleId: number | null;
  paymentLagMonths: number;
  isActive: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerFacility = {
  id: number;
  customerId: number;
  categoryId: number;
  categoryCycleId: number;
  capacity: number | null;
  coefficientOverride: number | null;
  note: string;
  sortOrder: number;
};

export type CustomerInspectionMonth = {
  customerId: number;
  month: number;
};

export type InspectionRecord = {
  id: number;
  customerId: number;
  year: number;
  month: number;
  type: InspectionType;
  isDone: number;
  doneDate: string | null;
  note: string | null;
};

export type BillingRecord = {
  id: number;
  customerId: number;
  year: number;
  month: number;
  billingAmount: number;
  isBilled: number;
  billedDate: string | null;
  isPaid: number;
  paidDate: string | null;
  expectedPaymentYear: number;
  expectedPaymentMonth: number;
  note: string | null;
};

export type AppDocument = {
  version: number;
  /** 最後に保存した日時。競合時の表示に使う */
  savedAt: string;
  settings: Settings;
  coefficientTables: CoefficientTable[];
  coefficientRows: CoefficientRow[];
  equipmentCategories: EquipmentCategory[];
  categoryCycles: CategoryCycle[];
  inspectionCycles: InspectionCycle[];
  billingCycles: BillingCycle[];
  customers: Customer[];
  customerFacilities: CustomerFacility[];
  customerInspectionMonths: CustomerInspectionMonth[];
  inspectionRecords: InspectionRecord[];
  billingRecords: BillingRecord[];
};

/** 採番。DB のオートインクリメントの代わり */
export function nextId<T extends { id: number }>(rows: T[]): number {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

export const defaultSettings = (): Settings => ({
  baseAddress: "",
  baseLat: null,
  baseLng: null,
  googleMapsApiKey: null,
  taxRate: 0.1,
  distanceMode: "auto",
  updatedAt: new Date().toISOString(),
});
