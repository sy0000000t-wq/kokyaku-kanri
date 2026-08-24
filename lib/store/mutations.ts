import { calcExpectedPayment } from "@/lib/calc/billing";
import { todayIso } from "@/lib/utils";
import {
  nextId,
  type AppDocument,
  type BillingCycle,
  type CategoryCycle,
  type CoefficientRow,
  type Customer,
  type CustomerFacility,
  type EquipmentCategory,
  type InspectionCycle,
  type InspectionType,
  type Settings,
} from "./document";

/**
 * 文書の更新はすべてここに集める。
 * 元の文書は書き換えず、新しい文書を返す（Undo や競合検出を素直にするため）。
 */

const touch = (doc: AppDocument): AppDocument => ({
  ...doc,
  savedAt: new Date().toISOString(),
});

/* ---------------------------------- 顧客 ---------------------------------- */

export type FacilityInput = {
  id: number | null;
  categoryId: number;
  categoryCycleId: number;
  capacity: number | null;
  coefficientOverride: number | null;
  note: string;
};

export type CustomerInput = {
  id: number | null;
  code: string;
  name: string;
  inspectionCycleId: number;
  monthlyFee: number;
  annualFeeHandling: "included" | "separate";
  annualInspectionFee: number | null;
  unitPriceOverride: number | null;
  address: string;
  lat: number | null;
  lng: number | null;
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
  facilities: FacilityInput[];
};

export function saveCustomer(
  doc: AppDocument,
  input: CustomerInput,
): { doc: AppDocument; customerId: number } {
  const now = new Date().toISOString();
  const existing = input.id ? doc.customers.find((c) => c.id === input.id) : undefined;

  // 住所を変えたのに古い座標が残っていると、別の場所の距離が出てしまう。
  // 座標を手入力し直していない限り、住所変更時はキャッシュを捨てて取り直す。
  const addressChanged = existing != null && existing.address !== input.address;
  const coordsUntouched =
    existing != null && input.lat === existing.lat && input.lng === existing.lng;
  const dropCoords = addressChanged && coordsUntouched;

  const customerId = existing?.id ?? nextId(doc.customers);

  const base: Customer = {
    id: customerId,
    code: input.code,
    name: input.name,
    inspectionCycleId: input.inspectionCycleId,
    monthlyFee: input.monthlyFee,
    annualFeeHandling: input.annualFeeHandling,
    annualInspectionFee: input.annualInspectionFee,
    unitPriceOverride: input.unitPriceOverride,
    address: input.address,
    lat: dropCoords ? null : input.lat,
    lng: dropCoords ? null : input.lng,
    distanceKm: dropCoords ? null : (existing?.distanceKm ?? null),
    durationMin: dropCoords ? null : (existing?.durationMin ?? null),
    distanceMethod: dropCoords ? null : (existing?.distanceMethod ?? null),
    distanceUpdatedAt: dropCoords ? null : (existing?.distanceUpdatedAt ?? null),
    phone: input.phone,
    email: input.email,
    contactPerson: input.contactPerson,
    contractStartDate: input.contractStartDate,
    contractEndDate: input.contractEndDate,
    annualInspectionMonth: input.annualInspectionMonth,
    annualInspectionDay: input.annualInspectionDay,
    billingCycleId: input.billingCycleId,
    paymentLagMonths: input.paymentLagMonths,
    isActive: input.isActive,
    note: input.note,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const customers = existing
    ? doc.customers.map((c) => (c.id === customerId ? base : c))
    : [...doc.customers, base];

  // 設備と点検月は毎回入れ替える（行の増減があるため）
  let facilityId = nextId(doc.customerFacilities) - 1;
  const facilities: CustomerFacility[] = input.facilities.map((f, i) => {
    facilityId += 1;
    return {
      id: f.id ?? facilityId,
      customerId,
      categoryId: f.categoryId,
      categoryCycleId: f.categoryCycleId,
      capacity: f.capacity,
      coefficientOverride: f.coefficientOverride,
      note: f.note,
      sortOrder: i,
    };
  });

  return {
    customerId,
    doc: touch({
      ...doc,
      customers,
      customerFacilities: [
        ...doc.customerFacilities.filter((f) => f.customerId !== customerId),
        ...facilities,
      ],
      customerInspectionMonths: [
        ...doc.customerInspectionMonths.filter((m) => m.customerId !== customerId),
        ...[...new Set(input.inspectionMonths)]
          .filter((m) => m >= 1 && m <= 12)
          .map((month) => ({ customerId, month })),
      ],
    }),
  };
}

/** 稼働トグル。解除日を入れて is_active=0 にする（データは削除しない） */
export function setCustomerActive(
  doc: AppDocument,
  input: { id: number; isActive: boolean; contractEndDate?: string | null },
): AppDocument {
  return touch({
    ...doc,
    customers: doc.customers.map((c) =>
      c.id === input.id
        ? {
            ...c,
            isActive: input.isActive ? 1 : 0,
            contractEndDate: input.isActive
              ? null
              : (input.contractEndDate ?? todayIso()),
            updatedAt: new Date().toISOString(),
          }
        : c,
    ),
  });
}

/** 完全削除。関連する実績もまとめて消す */
export function deleteCustomer(doc: AppDocument, id: number): AppDocument {
  return touch({
    ...doc,
    customers: doc.customers.filter((c) => c.id !== id),
    customerFacilities: doc.customerFacilities.filter((f) => f.customerId !== id),
    customerInspectionMonths: doc.customerInspectionMonths.filter(
      (m) => m.customerId !== id,
    ),
    inspectionRecords: doc.inspectionRecords.filter((r) => r.customerId !== id),
    billingRecords: doc.billingRecords.filter((r) => r.customerId !== id),
  });
}

/** 削除前の退避用に、その顧客に関わるデータだけ抜き出す */
export function extractCustomer(doc: AppDocument, id: number) {
  return {
    exportedAt: new Date().toISOString(),
    customer: doc.customers.find((c) => c.id === id) ?? null,
    facilities: doc.customerFacilities.filter((f) => f.customerId === id),
    inspectionMonths: doc.customerInspectionMonths.filter((m) => m.customerId === id),
    inspectionRecords: doc.inspectionRecords.filter((r) => r.customerId === id),
    billingRecords: doc.billingRecords.filter((r) => r.customerId === id),
  };
}

export function updateDistance(
  doc: AppDocument,
  input: {
    id: number;
    lat: number;
    lng: number;
    distanceKm: number;
    durationMin: number | null;
    method: "road" | "straight";
  },
): AppDocument {
  return touch({
    ...doc,
    customers: doc.customers.map((c) =>
      c.id === input.id
        ? {
            ...c,
            lat: input.lat,
            lng: input.lng,
            distanceKm: input.distanceKm,
            durationMin: input.durationMin,
            distanceMethod: input.method,
            distanceUpdatedAt: new Date().toISOString(),
          }
        : c,
    ),
  });
}

/** 顧客ID の自動採番（T01 形式） */
export function nextCustomerCode(doc: AppDocument): string {
  const max = doc.customers.reduce((acc, c) => {
    const m = /^T(\d+)$/.exec(c.code);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `T${String(max + 1).padStart(2, "0")}`;
}

/* --------------------------------- 点検実績 --------------------------------- */

export function setInspectionDone(
  doc: AppDocument,
  input: {
    customerId: number;
    year: number;
    month: number;
    type: InspectionType;
    isDone: boolean;
    doneDate?: string | null;
  },
): AppDocument {
  const doneDate = input.isDone ? (input.doneDate ?? todayIso()) : null;
  const found = doc.inspectionRecords.find(
    (r) =>
      r.customerId === input.customerId &&
      r.year === input.year &&
      r.month === input.month &&
      r.type === input.type,
  );

  const records = found
    ? doc.inspectionRecords.map((r) =>
        r.id === found.id ? { ...r, isDone: input.isDone ? 1 : 0, doneDate } : r,
      )
    : [
        ...doc.inspectionRecords,
        {
          id: nextId(doc.inspectionRecords),
          customerId: input.customerId,
          year: input.year,
          month: input.month,
          type: input.type,
          isDone: input.isDone ? 1 : 0,
          doneDate,
          note: null,
        },
      ];

  return touch({ ...doc, inspectionRecords: records });
}

/* ------------------------------- 請求・入金実績 ------------------------------- */

type BillingKey = { customerId: number; year: number; month: number };

function ensureBillingRecord(
  doc: AppDocument,
  key: BillingKey,
  defaults: { amount: number; paymentLagMonths: number },
): { doc: AppDocument; id: number } {
  const found = doc.billingRecords.find(
    (r) =>
      r.customerId === key.customerId &&
      r.year === key.year &&
      r.month === key.month,
  );
  if (found) return { doc, id: found.id };

  const expected = calcExpectedPayment(
    { year: key.year, month: key.month },
    defaults.paymentLagMonths,
  );
  const id = nextId(doc.billingRecords);

  return {
    id,
    doc: {
      ...doc,
      billingRecords: [
        ...doc.billingRecords,
        {
          id,
          ...key,
          billingAmount: defaults.amount,
          isBilled: 0,
          billedDate: null,
          isPaid: 0,
          paidDate: null,
          expectedPaymentYear: expected.year,
          expectedPaymentMonth: expected.month,
          note: null,
        },
      ],
    },
  };
}

export function setBilled(
  doc: AppDocument,
  input: BillingKey & {
    isBilled: boolean;
    defaultAmount: number;
    paymentLagMonths: number;
  },
): AppDocument {
  const { doc: withRecord, id } = ensureBillingRecord(doc, input, {
    amount: input.defaultAmount,
    paymentLagMonths: input.paymentLagMonths,
  });

  return touch({
    ...withRecord,
    billingRecords: withRecord.billingRecords.map((r) =>
      r.id === id
        ? {
            ...r,
            isBilled: input.isBilled ? 1 : 0,
            billedDate: input.isBilled ? todayIso() : null,
          }
        : r,
    ),
  });
}

export function setPaid(
  doc: AppDocument,
  input: BillingKey & {
    isPaid: boolean;
    defaultAmount: number;
    paymentLagMonths: number;
  },
): AppDocument {
  const { doc: withRecord, id } = ensureBillingRecord(doc, input, {
    amount: input.defaultAmount,
    paymentLagMonths: input.paymentLagMonths,
  });

  return touch({
    ...withRecord,
    billingRecords: withRecord.billingRecords.map((r) =>
      r.id === id
        ? {
            ...r,
            isPaid: input.isPaid ? 1 : 0,
            paidDate: input.isPaid ? todayIso() : null,
          }
        : r,
    ),
  });
}

export function setBillingAmount(
  doc: AppDocument,
  input: BillingKey & { amount: number; paymentLagMonths: number },
): AppDocument {
  const { doc: withRecord, id } = ensureBillingRecord(doc, input, {
    amount: input.amount,
    paymentLagMonths: input.paymentLagMonths,
  });

  return touch({
    ...withRecord,
    billingRecords: withRecord.billingRecords.map((r) =>
      r.id === id
        ? { ...r, billingAmount: Math.max(0, Math.round(input.amount)) }
        : r,
    ),
  });
}

/* ---------------------------------- 設定 ---------------------------------- */

export function saveSettings(
  doc: AppDocument,
  input: Partial<Omit<Settings, "updatedAt">>,
): AppDocument {
  return touch({
    ...doc,
    settings: { ...doc.settings, ...input, updatedAt: new Date().toISOString() },
  });
}

/* --------------------------------- マスタ --------------------------------- */

export function saveEquipmentCategory(
  doc: AppDocument,
  input: Omit<EquipmentCategory, "id"> & { id: number | null },
): AppDocument {
  if (input.id) {
    return touch({
      ...doc,
      equipmentCategories: doc.equipmentCategories.map((c) =>
        c.id === input.id ? { ...c, ...input, id: input.id } : c,
      ),
    });
  }
  return touch({
    ...doc,
    equipmentCategories: [
      ...doc.equipmentCategories,
      { ...input, id: nextId(doc.equipmentCategories) },
    ],
  });
}

export function saveCategoryCycle(
  doc: AppDocument,
  input: Omit<CategoryCycle, "id"> & { id: number | null },
): AppDocument {
  if (input.id) {
    return touch({
      ...doc,
      categoryCycles: doc.categoryCycles.map((c) =>
        c.id === input.id ? { ...c, ...input, id: input.id } : c,
      ),
    });
  }
  return touch({
    ...doc,
    categoryCycles: [...doc.categoryCycles, { ...input, id: nextId(doc.categoryCycles) }],
  });
}

/** 使われていない周期だけ削除できる */
export function deleteCategoryCycle(
  doc: AppDocument,
  id: number,
): { doc: AppDocument; ok: boolean; message?: string } {
  if (doc.customerFacilities.some((f) => f.categoryCycleId === id)) {
    return {
      doc,
      ok: false,
      message: "この周期を使っている設備があるため削除できません",
    };
  }
  return {
    ok: true,
    doc: touch({
      ...doc,
      categoryCycles: doc.categoryCycles.filter((c) => c.id !== id),
    }),
  };
}

export function saveInspectionCycle(
  doc: AppDocument,
  input: Omit<InspectionCycle, "id"> & { id: number | null },
): AppDocument {
  if (input.id) {
    return touch({
      ...doc,
      inspectionCycles: doc.inspectionCycles.map((c) =>
        c.id === input.id ? { ...c, ...input, id: input.id } : c,
      ),
    });
  }
  return touch({
    ...doc,
    inspectionCycles: [
      ...doc.inspectionCycles,
      { ...input, id: nextId(doc.inspectionCycles) },
    ],
  });
}

export function saveBillingCycle(
  doc: AppDocument,
  input: Omit<BillingCycle, "id"> & { id: number | null },
): AppDocument {
  if (input.id) {
    return touch({
      ...doc,
      billingCycles: doc.billingCycles.map((c) =>
        c.id === input.id ? { ...c, ...input, id: input.id } : c,
      ),
    });
  }
  return touch({
    ...doc,
    billingCycles: [...doc.billingCycles, { ...input, id: nextId(doc.billingCycles) }],
  });
}

/** 換算係数テーブルの行を丸ごと入れ替える */
export function saveCoefficientRows(
  doc: AppDocument,
  tableId: number,
  rows: { minCapacity: number; maxCapacity: number | null; coefficient: number }[],
): AppDocument {
  const others = doc.coefficientRows.filter((r) => r.tableId !== tableId);
  let id = nextId(others) - 1;

  const sorted = [...rows]
    .sort((a, b) => a.minCapacity - b.minCapacity)
    .map((r, i) => {
      id += 1;
      return { id, tableId, ...r, sortOrder: i };
    });

  return touch({ ...doc, coefficientRows: [...others, ...sorted] as CoefficientRow[] });
}
