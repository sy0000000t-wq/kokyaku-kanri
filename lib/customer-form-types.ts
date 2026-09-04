import type { CoefficientRowLike } from "@/lib/calc/coefficient";
import { generateCycleMonths } from "@/lib/calc/schedule";
import { todayIso } from "@/lib/utils";

export type FormCategoryCycle = {
  id: number;
  name: string;
  intervalMonths: number;
  multiplier: number | null;
  fixedPoints: number | null;
  requiresInsulationMonitor: boolean;
  conditionNote: string;
};

export type FormCategory = {
  id: number;
  name: string;
  categoryGroup: "demand" | "generation" | "other";
  capacityUnit: "kVA" | "kW" | "none";
  calculationMethod: "table" | "fixed" | "excluded";
  coefficientTableId: number | null;
  minCapacity: number | null;
  maxCapacity: number | null;
  note: string;
  cycles: FormCategoryCycle[];
};

/** 顧客フォームがクライアント側で計算するのに必要なマスタ */
export type FormMasters = {
  categories: FormCategory[];
  inspectionCycles: { id: number; name: string; intervalMonths: number }[];
  billingCycles: { id: number; name: string; intervalMonths: number }[];
  coefficientRows: Record<number, CoefficientRowLike[]>;
  taxRate: number;
};

/** フォーム上の設備1行 */
export type FacilityFormValue = {
  /** 画面上の一意キー（新規行は負値ではなく uid 文字列で持つ） */
  uid: string;
  id: number | null;
  categoryId: number;
  categoryCycleId: number;
  capacity: string;
  /** 換算係数の指定方法 */
  coefficientMode: "auto" | "select" | "manual";
  coefficientOverride: string;
  /** この設備の点検開始月。"" なら顧客の点検開始月に合わせる */
  startMonth: string;
  note: string;
};

export type CustomerFormValues = {
  id: number | null;
  code: string;
  name: string;
  inspectionCycleId: number;
  monthlyFee: number;
  monthlyFeeTaxMode: "excluded" | "included";
  annualFeeHandling: "included" | "separate";
  annualInspectionFee: number | null;
  annualFeeTaxMode: "excluded" | "included";
  unitPriceOverride: number | null;
  address: string;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  durationMin: number | null;
  distanceMethod: "road" | "straight" | null;
  phone: string;
  email: string;
  contactPerson: string;
  contractStartDate: string;
  contractEndDate: string | null;
  annualInspectionMonth: number | null;
  annualInspectionDay: number | null;
  annualAvailability: "unspecified" | "weekday" | "holiday" | "any";
  annualAvailabilityNote: string;
  priorContactRequired: number;
  priorContactNote: string;
  switchgearRequestRequired: number;
  switchgearRequestNote: string;
  billingCycleId: number | null;
  paymentLagMonths: number;
  isActive: number;
  note: string;
  inspectionMonths: number[];
  facilities: FacilityFormValue[];
};

let uidCounter = 0;
export function nextUid(): string {
  uidCounter += 1;
  return `f${Date.now().toString(36)}-${uidCounter}`;
}

/** 設備行の初期値。既定は最初の設備区分とその最初の周期 */
export function emptyFacility(masters: FormMasters): FacilityFormValue {
  const category = masters.categories[0];
  return {
    uid: nextUid(),
    id: null,
    categoryId: category?.id ?? 0,
    categoryCycleId: category?.cycles[0]?.id ?? 0,
    capacity: "",
    coefficientMode: "auto",
    coefficientOverride: "",
    startMonth: "",
    note: "",
  };
}

/** 新規登録時の初期値。サーバーコンポーネントから呼ぶのでクライアント境界には置かない */
export function emptyCustomer(
  masters: FormMasters,
  code: string,
  now = new Date(),
): CustomerFormValues {
  const cycle = masters.inspectionCycles[0];

  return {
    id: null,
    code,
    name: "",
    inspectionCycleId: cycle?.id ?? 0,
    monthlyFee: 0,
    monthlyFeeTaxMode: "excluded",
    annualFeeHandling: "included",
    annualInspectionFee: null,
    annualFeeTaxMode: "excluded",
    unitPriceOverride: null,
    address: "",
    lat: null,
    lng: null,
    distanceKm: null,
    durationMin: null,
    distanceMethod: null,
    phone: "",
    email: "",
    contactPerson: "",
    contractStartDate: todayIso(now),
    contractEndDate: null,
    annualInspectionMonth: null,
    annualInspectionDay: null,
    annualAvailability: "unspecified",
    annualAvailabilityNote: "",
    priorContactRequired: 0,
    priorContactNote: "",
    switchgearRequestRequired: 0,
    switchgearRequestNote: "",
    billingCycleId: masters.billingCycles[0]?.id ?? null,
    paymentLagMonths: 1,
    isActive: 1,
    note: "",
    inspectionMonths: generateCycleMonths(
      now.getMonth() + 1,
      cycle?.intervalMonths ?? 1,
    ),
    facilities: [emptyFacility(masters)],
  };
}
