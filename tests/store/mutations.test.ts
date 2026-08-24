import { describe, expect, it } from "vitest";
import { createInitialDocument } from "@/lib/store/seed";
import { buildIndexes, getCustomerViews } from "@/lib/store/selectors";
import {
  deleteCategoryCycle,
  deleteCustomer,
  extractCustomer,
  nextCustomerCode,
  saveCoefficientRows,
  saveCustomer,
  setBilled,
  setBillingAmount,
  setCustomerActive,
  setInspectionDone,
  setPaid,
  updateDistance,
  type CustomerInput,
} from "@/lib/store/mutations";
import { validateCustomer } from "@/lib/store/validation";
import type { AppDocument } from "@/lib/store/document";

function categoryCycle(doc: AppDocument, categoryName: string, cycleName: string) {
  const category = doc.equipmentCategories.find((c) => c.name === categoryName)!;
  const cycle = doc.categoryCycles.find(
    (c) => c.categoryId === category.id && c.name === cycleName,
  )!;
  return { categoryId: category.id, categoryCycleId: cycle.id };
}

function input(doc: AppDocument, overrides: Partial<CustomerInput> = {}): CustomerInput {
  const { categoryId, categoryCycleId } = categoryCycle(
    doc,
    "需要設備（高圧・100kVA超過）",
    "2ヶ月に1回",
  );
  return {
    id: null,
    code: "T01",
    name: "テスト事業場",
    inspectionCycleId: doc.inspectionCycles[1].id,
    monthlyFee: 17500,
    annualFeeHandling: "included",
    annualInspectionFee: null,
    unitPriceOverride: null,
    address: "愛知県豊田市",
    lat: null,
    lng: null,
    phone: "000-0000-0000",
    email: "",
    contactPerson: "山田",
    contractStartDate: "2026-03-01",
    contractEndDate: null,
    annualInspectionMonth: 3,
    annualInspectionDay: null,
    billingCycleId: doc.billingCycles[0].id,
    paymentLagMonths: 1,
    isActive: 1,
    note: "",
    inspectionMonths: [1, 3, 5, 7, 9, 11],
    facilities: [
      {
        id: null,
        categoryId,
        categoryCycleId,
        capacity: 210,
        coefficientOverride: null,
        note: "",
      },
    ],
    ...overrides,
  };
}

describe("saveCustomer", () => {
  it("新規登録すると顧客・設備・点検月が入る", () => {
    const doc = createInitialDocument();
    const { doc: next, customerId } = saveCustomer(doc, input(doc));

    expect(next.customers).toHaveLength(1);
    expect(next.customerFacilities).toHaveLength(1);
    expect(next.customerInspectionMonths).toHaveLength(6);

    const view = getCustomerViews(next, buildIndexes(next))[0];
    expect(view.id).toBe(customerId);
    expect(view.points).toBe(0.48);
    expect(view.pricing.unitPrice).toBe(36458);
  });

  it("元の文書は書き換えない", () => {
    const doc = createInitialDocument();
    saveCustomer(doc, input(doc));
    expect(doc.customers).toHaveLength(0);
  });

  it("更新すると設備は入れ替わる（増減に追随する）", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));

    const solar = categoryCycle(first, "太陽電池発電所（自家消費）", "6ヶ月に1回");
    const { doc: second } = saveCustomer(first, {
      ...input(first),
      id: customerId,
      facilities: [
        ...input(first).facilities,
        {
          id: null,
          categoryId: solar.categoryId,
          categoryCycleId: solar.categoryCycleId,
          capacity: 80,
          coefficientOverride: null,
          note: "",
        },
      ],
    });

    expect(second.customers).toHaveLength(1);
    expect(second.customerFacilities).toHaveLength(2);

    const view = getCustomerViews(second, buildIndexes(second))[0];
    expect(view.points).toBe(0.555);
  });

  it("住所を変えると座標と距離のキャッシュを捨てる", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const withDistance = updateDistance(first, {
      id: customerId,
      lat: 35.1,
      lng: 137.1,
      distanceKm: 12.3,
      durationMin: null,
      method: "straight",
    });
    expect(withDistance.customers[0].distanceKm).toBe(12.3);

    const { doc: moved } = saveCustomer(withDistance, {
      ...input(withDistance),
      id: customerId,
      address: "愛知県岡崎市",
      lat: 35.1,
      lng: 137.1,
    });

    expect(moved.customers[0].lat).toBeNull();
    expect(moved.customers[0].distanceKm).toBeNull();
  });

  it("座標を手入力し直した場合は残す", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const withDistance = updateDistance(first, {
      id: customerId,
      lat: 35.1,
      lng: 137.1,
      distanceKm: 12.3,
      durationMin: null,
      method: "straight",
    });

    const { doc: moved } = saveCustomer(withDistance, {
      ...input(withDistance),
      id: customerId,
      address: "愛知県岡崎市",
      lat: 34.9,
      lng: 137.2,
    });

    expect(moved.customers[0].lat).toBe(34.9);
  });
});

describe("nextCustomerCode", () => {
  it("T01 形式で採番する", () => {
    const doc = createInitialDocument();
    expect(nextCustomerCode(doc)).toBe("T01");
    const { doc: one } = saveCustomer(doc, input(doc));
    expect(nextCustomerCode(one)).toBe("T02");
  });

  it("欠番があっても最大値の次を返す", () => {
    const doc = createInitialDocument();
    const { doc: a } = saveCustomer(doc, input(doc, { code: "T09" }));
    expect(nextCustomerCode(a)).toBe("T10");
  });
});

describe("稼働状態と削除", () => {
  it("稼働トグルを OFF にすると解除日が入り、実績は残る", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const withRecord = setInspectionDone(first, {
      customerId,
      year: 2026,
      month: 3,
      type: "regular",
      isDone: true,
    });

    const off = setCustomerActive(withRecord, {
      id: customerId,
      isActive: false,
      contractEndDate: "2026-09-30",
    });

    expect(off.customers[0].isActive).toBe(0);
    expect(off.customers[0].contractEndDate).toBe("2026-09-30");
    expect(off.inspectionRecords).toHaveLength(1);
  });

  it("完全削除すると関連データもすべて消える", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const withRecord = setInspectionDone(first, {
      customerId,
      year: 2026,
      month: 3,
      type: "regular",
      isDone: true,
    });

    const snapshot = extractCustomer(withRecord, customerId);
    expect(snapshot.customer?.code).toBe("T01");
    expect(snapshot.inspectionRecords).toHaveLength(1);

    const deleted = deleteCustomer(withRecord, customerId);
    expect(deleted.customers).toHaveLength(0);
    expect(deleted.customerFacilities).toHaveLength(0);
    expect(deleted.customerInspectionMonths).toHaveLength(0);
    expect(deleted.inspectionRecords).toHaveLength(0);
  });
});

describe("点検チェック", () => {
  it("付けると実施日が入り、外すと消える", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const key = { customerId, year: 2026, month: 3, type: "regular" as const };

    const on = setInspectionDone(first, { ...key, isDone: true, doneDate: "2026-03-15" });
    expect(on.inspectionRecords[0].isDone).toBe(1);
    expect(on.inspectionRecords[0].doneDate).toBe("2026-03-15");

    const off = setInspectionDone(on, { ...key, isDone: false });
    expect(off.inspectionRecords).toHaveLength(1);
    expect(off.inspectionRecords[0].isDone).toBe(0);
    expect(off.inspectionRecords[0].doneDate).toBeNull();
  });

  it("通常点検と年次点検は別々に持つ", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const a = setInspectionDone(first, {
      customerId,
      year: 2026,
      month: 3,
      type: "regular",
      isDone: true,
    });
    const b = setInspectionDone(a, {
      customerId,
      year: 2026,
      month: 3,
      type: "annual",
      isDone: true,
    });
    expect(b.inspectionRecords).toHaveLength(2);
  });
});

describe("請求・入金", () => {
  it("チェックすると請求実績が作られ、入金予定月が入る", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));

    const billed = setBilled(first, {
      customerId,
      year: 2026,
      month: 12,
      isBilled: true,
      defaultAmount: 19250,
      paymentLagMonths: 1,
    });

    expect(billed.billingRecords).toHaveLength(1);
    const r = billed.billingRecords[0];
    expect(r.isBilled).toBe(1);
    expect(r.billingAmount).toBe(19250);
    expect(r.expectedPaymentYear).toBe(2027);
    expect(r.expectedPaymentMonth).toBe(1);
  });

  it("同じ年月に請求と入金を付けてもレコードは1件のまま", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const key = { customerId, year: 2026, month: 5, defaultAmount: 19250, paymentLagMonths: 1 };

    const billed = setBilled(first, { ...key, isBilled: true });
    const paid = setPaid(billed, { ...key, isPaid: true });

    expect(paid.billingRecords).toHaveLength(1);
    expect(paid.billingRecords[0].isBilled).toBe(1);
    expect(paid.billingRecords[0].isPaid).toBe(1);
  });

  it("請求額の手修正は負にならない", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const edited = setBillingAmount(first, {
      customerId,
      year: 2026,
      month: 5,
      amount: -100,
      paymentLagMonths: 1,
    });
    expect(edited.billingRecords[0].billingAmount).toBe(0);
  });
});

describe("マスタ", () => {
  it("使われている周期は削除できない", () => {
    const doc = createInitialDocument();
    const { doc: first } = saveCustomer(doc, input(doc));
    const used = first.customerFacilities[0].categoryCycleId;

    const result = deleteCategoryCycle(first, used);
    expect(result.ok).toBe(false);
    expect(first.categoryCycles.some((c) => c.id === used)).toBe(true);
  });

  it("使われていない周期は削除できる", () => {
    const doc = createInitialDocument();
    const unused = doc.categoryCycles[0].id;
    const result = deleteCategoryCycle(doc, unused);
    expect(result.ok).toBe(true);
    expect(result.doc.categoryCycles.some((c) => c.id === unused)).toBe(false);
  });

  it("換算係数の行を入れ替えても他のテーブルは触らない", () => {
    const doc = createInitialDocument();
    const demand = doc.coefficientTables[0].id;
    const solarRowsBefore = doc.coefficientRows.filter((r) => r.tableId !== demand);

    const next = saveCoefficientRows(doc, demand, [
      { minCapacity: 100, maxCapacity: 200, coefficient: 0.5 },
      { minCapacity: 0, maxCapacity: 100, coefficient: 0.3 },
    ]);

    const demandRows = next.coefficientRows.filter((r) => r.tableId === demand);
    expect(demandRows).toHaveLength(2);
    // 下限の昇順に並べ替えられる
    expect(demandRows.map((r) => r.minCapacity)).toEqual([0, 100]);
    expect(next.coefficientRows.filter((r) => r.tableId !== demand)).toHaveLength(
      solarRowsBefore.length,
    );
  });
});

describe("validateCustomer", () => {
  it("必須項目が空なら弾く", () => {
    const doc = createInitialDocument();
    const errors = validateCustomer(doc, {
      ...input(doc),
      code: "",
      name: "",
      address: "",
    });
    expect(errors.code).toBeDefined();
    expect(errors.name).toBeDefined();
    expect(errors.address).toBeDefined();
  });

  it("顧客IDの重複を弾く（自分自身は除く）", () => {
    const doc = createInitialDocument();
    const { doc: saved, customerId } = saveCustomer(doc, input(doc));

    expect(validateCustomer(saved, input(saved)).code).toBeDefined();
    expect(
      validateCustomer(saved, { ...input(saved), id: customerId }).code,
    ).toBeUndefined();
  });

  it("設備が無ければ弾く", () => {
    const doc = createInitialDocument();
    const errors = validateCustomer(doc, { ...input(doc), facilities: [] });
    expect(errors.facilities).toBeDefined();
  });

  it("係数表方式で容量も換算係数も無ければ弾く", () => {
    const doc = createInitialDocument();
    const base = input(doc);
    const errors = validateCustomer(doc, {
      ...base,
      facilities: [{ ...base.facilities[0], capacity: null }],
    });
    expect(errors.facilities).toContain("設備容量、または換算係数");
  });

  it("換算係数を手で入れてあれば容量が無くても通る", () => {
    const doc = createInitialDocument();
    const base = input(doc);
    const errors = validateCustomer(doc, {
      ...base,
      facilities: [{ ...base.facilities[0], capacity: null, coefficientOverride: 0.8 }],
    });
    expect(errors.facilities).toBeUndefined();
  });

  it("固定点数の区分は容量が無くても通る", () => {
    const doc = createInitialDocument();
    const lowVoltage = categoryCycle(doc, "需要設備（低圧）", "月1回");
    const errors = validateCustomer(doc, {
      ...input(doc),
      facilities: [
        { id: null, ...lowVoltage, capacity: null, coefficientOverride: null, note: "" },
      ],
    });
    expect(errors.facilities).toBeUndefined();
  });

  it("解除日が契約開始日より前なら弾く", () => {
    const doc = createInitialDocument();
    const errors = validateCustomer(doc, {
      ...input(doc),
      contractEndDate: "2026-01-01",
    });
    expect(errors.contractEndDate).toBeDefined();
  });

  it("別途請求なのに年次点検費が無ければ弾く", () => {
    const doc = createInitialDocument();
    const errors = validateCustomer(doc, {
      ...input(doc),
      annualFeeHandling: "separate",
      annualInspectionFee: null,
    });
    expect(errors.annualInspectionFee).toBeDefined();
  });
});
