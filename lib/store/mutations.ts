import { calcExpectedPayment } from "@/lib/calc/billing";
import { todayIso } from "@/lib/utils";
import {
  nextId,
  type AnnualAvailability,
  type AppDocument,
  type BillingCycle,
  type CategoryCycle,
  type CoefficientRow,
  type Customer,
  type CustomerFacility,
  customerCodePrefix,
  type ContractType,
  type EquipmentCategory,
  type InspectionCycle,
  type InspectionRecord,
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
  /** 点検開始月。null なら顧客の点検開始月に合わせる */
  startMonth: number | null;
  note: string;
};

export type CustomerInput = {
  id: number | null;
  code: string;
  name: string;
  inspectionCycleId: number;
  monthlyFee: number;
  monthlyFeeTaxMode: "excluded" | "included";
  contractType: ContractType;
  annualFeeHandling: "included" | "separate";
  annualInspectionFee: number | null;
  annualFeeTaxMode: "excluded" | "included";
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
  annualAvailability: AnnualAvailability;
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
  /** 請求する月。請求サイクルのプリセットを手で直せる */
  billingMonths: number[];
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
    monthlyFeeTaxMode: input.monthlyFeeTaxMode,
    contractType: input.contractType,
    annualFeeHandling: input.annualFeeHandling,
    annualInspectionFee: input.annualInspectionFee,
    annualFeeTaxMode: input.annualFeeTaxMode,
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
    annualAvailability: input.annualAvailability,
    annualAvailabilityNote: input.annualAvailabilityNote,
    priorContactRequired: input.priorContactRequired,
    priorContactNote: input.priorContactNote,
    switchgearRequestRequired: input.switchgearRequestRequired,
    switchgearRequestNote: input.switchgearRequestNote,
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
      startMonth: f.startMonth,
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
        ...monthRows(customerId, input.inspectionMonths),
      ],
      customerBillingMonths: [
        ...doc.customerBillingMonths.filter((m) => m.customerId !== customerId),
        ...monthRows(customerId, input.billingMonths),
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
    customerBillingMonths: doc.customerBillingMonths.filter(
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
    billingMonths: doc.customerBillingMonths.filter((m) => m.customerId === id),
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

/**
 * 顧客ID の候補を作る。
 *
 * 契約年月日を YYMMDD にしたものを使う（2026-03-01 なら 260301）。
 * 同じ日に複数の契約があるときは、末尾に a, b, c… を付けて重複を避ける。
 * あくまで候補で、入力欄では自由に書き換えられる。
 */
export function suggestCustomerCode(
  doc: AppDocument,
  contractStartDate: string,
  contractType: ContractType,
  excludeId: number | null = null,
): string {
  // 「その他」は決まった形がないので、自分で決めてもらう
  const prefix = customerCodePrefix(contractType);
  if (prefix === null) return "";

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(contractStartDate ?? "");
  if (!m) return "";

  const base = `${prefix}${m[1].slice(2)}${m[2]}${m[3]}`;
  const taken = new Set(
    doc.customers.filter((c) => c.id !== excludeId).map((c) => c.code),
  );
  if (!taken.has(base)) return base;

  // a, b, c… の順に空いているものを探す
  for (let i = 0; i < 26; i++) {
    const candidate = base + String.fromCharCode(97 + i);
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

/** 月の一覧を保存用の行にする。重複と範囲外を落とす */
function monthRows(customerId: number, months: number[]) {
  return [...new Set(months)]
    .filter((m) => m >= 1 && m <= 12)
    .sort((a, b) => a - b)
    .map((month) => ({ customerId, month }));
}

/* --------------------------------- 点検実績 --------------------------------- */

export type InspectionKey = {
  customerId: number;
  year: number;
  month: number;
  type: InspectionType;
};

/**
 * 顧客×年月×種別の実績レコードに部分更新をかける。
 * まだ無ければ空のレコードを作ってから当てる。
 */
function patchInspectionRecord(
  doc: AppDocument,
  key: InspectionKey,
  patch: Partial<Omit<InspectionRecord, "id" | keyof InspectionKey>>,
): AppDocument {
  const found = doc.inspectionRecords.find(
    (r) =>
      r.customerId === key.customerId &&
      r.year === key.year &&
      r.month === key.month &&
      r.type === key.type,
  );

  const records = found
    ? doc.inspectionRecords.map((r) => (r.id === found.id ? { ...r, ...patch } : r))
    : [
        ...doc.inspectionRecords,
        {
          id: nextId(doc.inspectionRecords),
          // 呼び出し側の入力をそのまま広げると、呼び出し用の引数まで記録に混ざる
          customerId: key.customerId,
          year: key.year,
          month: key.month,
          type: key.type,
          isDone: 0,
          doneDate: null,
          isReported: 0,
          reportedDate: null,
          isSwitchgearRequested: 0,
          switchgearRequestedDate: null,
          needsHelper: 0,
          helperName: "",
          note: null,
          ...patch,
        },
      ];

  return touch({ ...doc, inspectionRecords: records });
}

export function setInspectionDone(
  doc: AppDocument,
  input: InspectionKey & { isDone: boolean; doneDate?: string | null },
): AppDocument {
  return patchInspectionRecord(doc, input, {
    isDone: input.isDone ? 1 : 0,
    doneDate: input.isDone ? (input.doneDate ?? todayIso()) : null,
  });
}

/**
 * 報告書の提出チェック。点検を終えても提出はあとになるので、実施とは別に持つ。
 */
export function setInspectionReported(
  doc: AppDocument,
  input: InspectionKey & { isReported: boolean; reportedDate?: string | null },
): AppDocument {
  return patchInspectionRecord(doc, input, {
    isReported: input.isReported ? 1 : 0,
    reportedDate: input.isReported ? (input.reportedDate ?? todayIso()) : null,
  });
}

/**
 * 中電PGへの開閉器操作の申し込み。年次点検の停電に要るもので、
 * 申し込みは点検日より前に済ませるため、実施チェックとは別に持つ。
 */
export function setInspectionSwitchgearRequested(
  doc: AppDocument,
  input: InspectionKey & { isRequested: boolean; requestedDate?: string | null },
): AppDocument {
  return patchInspectionRecord(doc, input, {
    isSwitchgearRequested: input.isRequested ? 1 : 0,
    switchgearRequestedDate: input.isRequested
      ? (input.requestedDate ?? todayIso())
      : null,
  });
}

/**
 * 年次点検の応援依頼。要・不要と、頼む相手を持つ。
 * 不要に戻したときは相手も消す。
 */
export function setInspectionHelper(
  doc: AppDocument,
  input: InspectionKey & { needsHelper?: boolean; helperName?: string },
): AppDocument {
  const patch: Partial<InspectionRecord> = {};
  if (input.needsHelper !== undefined) {
    patch.needsHelper = input.needsHelper ? 1 : 0;
    if (!input.needsHelper) patch.helperName = "";
  }
  if (input.helperName !== undefined) patch.helperName = input.helperName;
  return patchInspectionRecord(doc, input, patch);
}

/* ---------------------------------- 覚書 ---------------------------------- */

/**
 * 点検1件ごとの覚書。持ち物やいつもと違う作業を、点検月に忘れないように残す。
 * 実績レコードと同じ単位（顧客×年月×種別）で持つ。
 */
export function setInspectionNote(
  doc: AppDocument,
  input: InspectionKey & { note: string },
): AppDocument {
  return patchInspectionRecord(doc, input, {
    note: input.note.trim() === "" ? null : input.note,
  });
}

/**
 * 月次の重点実施項目。毎年その月に巡ってくる（例：毎年8月は温度測定）。
 * 空にすると消える。
 */
export function setMonthlyFocus(
  doc: AppDocument,
  input: { month: number; note: string },
): AppDocument {
  const others = doc.monthlyFocus.filter((n) => n.month !== input.month);
  const note = input.note.trim();

  return touch({
    ...doc,
    monthlyFocus:
      note === "" ? others : [...others, { month: input.month, note }],
  });
}

export function getMonthlyFocus(doc: AppDocument, month: number): string {
  return doc.monthlyFocus.find((n) => n.month === month)?.note ?? "";
}

/** 年次点検の重点実施項目を追加・更新する */
export function saveAnnualFocus(
  doc: AppDocument,
  input: {
    id: number | null;
    title: string;
    intervalYears: number;
    baseYear: number;
    note: string;
  },
): AppDocument {
  const values = {
    title: input.title.trim(),
    intervalYears: Math.max(1, Math.round(input.intervalYears || 1)),
    baseYear: input.baseYear,
    note: input.note,
  };

  if (input.id) {
    return touch({
      ...doc,
      annualFocus: doc.annualFocus.map((a) =>
        a.id === input.id ? { ...a, ...values } : a,
      ),
    });
  }
  return touch({
    ...doc,
    annualFocus: [...doc.annualFocus, { id: nextId(doc.annualFocus), ...values }],
  });
}

export function deleteAnnualFocus(doc: AppDocument, id: number): AppDocument {
  return touch({ ...doc, annualFocus: doc.annualFocus.filter((a) => a.id !== id) });
}

/**
 * その年に巡ってくる年次点検の重点実施項目かどうか。
 * 起点の年と、そこから intervalYears ごとの年が対象。
 */
export function isAnnualFocusDue(
  item: { intervalYears: number; baseYear: number },
  year: number,
): boolean {
  const interval = Math.max(1, Math.round(item.intervalYears || 1));
  if (year < item.baseYear) return false;
  return (year - item.baseYear) % interval === 0;
}

/** その年に該当する年次点検の重点実施項目 */
export function getAnnualFocusForYear(doc: AppDocument, year: number) {
  return doc.annualFocus.filter((a) => isAnnualFocusDue(a, year));
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
