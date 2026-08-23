import type { CoefficientRowLike } from "@/lib/calc/coefficient";
import { generateCycleMonths } from "@/lib/calc/schedule";
import { todayIso } from "@/lib/utils";

/** 顧客フォームがクライアント側で計算するのに必要なマスタ */
export type FormMasters = {
  facilityTypes: {
    id: number;
    name: string;
    capacityUnit: "kVA" | "kW";
    coefficientTableId: number | null;
    secondaryCoefficientTableId: number | null;
  }[];
  inspectionCycles: {
    id: number;
    name: string;
    intervalMonths: number;
    coefficientMultiplier: number;
  }[];
  billingCycles: { id: number; name: string; intervalMonths: number }[];
  coefficientRows: Record<number, CoefficientRowLike[]>;
  taxRate: number;
};

export type CustomerFormValues = {
  id: number | null;
  code: string;
  name: string;
  facilityTypeId: number;
  capacityKva: number | null;
  capacityKw: number | null;
  inspectionCycleId: number;
  coefficientOverride: number | null;
  monthlyFee: number;
  annualFeeHandling: "included" | "separate";
  annualInspectionFee: number | null;
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
  billingCycleId: number | null;
  paymentLagMonths: number;
  isActive: number;
  note: string;
  inspectionMonths: number[];
};

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
    facilityTypeId: masters.facilityTypes[0]?.id ?? 0,
    capacityKva: null,
    capacityKw: null,
    inspectionCycleId: cycle?.id ?? 0,
    coefficientOverride: null,
    monthlyFee: 0,
    annualFeeHandling: "included",
    annualInspectionFee: null,
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
    billingCycleId: masters.billingCycles[0]?.id ?? null,
    paymentLagMonths: 1,
    isActive: 1,
    note: "",
    inspectionMonths: generateCycleMonths(
      now.getMonth() + 1,
      cycle?.intervalMonths ?? 1,
    ),
  };
}
