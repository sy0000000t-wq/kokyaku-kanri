import { describe, expect, it } from "vitest";
import { createInitialDocument } from "@/lib/store/seed";
import { buildIndexes, getCustomerViews } from "@/lib/store/selectors";
import {
  deleteCategoryCycle,
  deleteCustomer,
  extractCustomer,
  suggestCustomerCode,
  saveCoefficientRows,
  saveCustomer,
  setBilled,
  setBillingAmount,
  setCustomerActive,
  setInspectionDone,
  setInspectionHelper,
  setInspectionNote,
  setInspectionReported,
  setInspectionSwitchgearRequested,
  setMonthlyFocus,
  getMonthlyFocus,
  saveAnnualFocus,
  deleteAnnualFocus,
  isAnnualFocusDue,
  getAnnualFocusForYear,
  setPaid,
  updateDistance,
  type CustomerInput,
} from "@/lib/store/mutations";
import { validateCustomer } from "@/lib/store/validation";
import type { AppDocument } from "@/lib/store/document";
import { getInspectionTarget } from "@/lib/calc/schedule";

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
    monthlyFeeTaxMode: "excluded" as const,
    annualFeeHandling: "included",
    annualInspectionFee: null,
    annualFeeTaxMode: "excluded" as const,
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
    annualAvailability: "unspecified",
    annualAvailabilityNote: "",
    priorContactRequired: 0,
    priorContactNote: "",
    switchgearRequestRequired: 0,
    switchgearRequestNote: "",
    billingCycleId: doc.billingCycles[0].id,
    paymentLagMonths: 1,
    isActive: 1,
    note: "",
    inspectionMonths: [1, 3, 5, 7, 9, 11],
    billingMonths: [],
    facilities: [
      {
        id: null,
        categoryId,
        categoryCycleId,
        capacity: 210,
        coefficientOverride: null,
        startMonth: null,
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
          startMonth: null,
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

describe("suggestCustomerCode（契約年月日から作る）", () => {
  it("契約年月日を YYMMDD にする", () => {
    const doc = createInitialDocument();
    expect(suggestCustomerCode(doc, "2026-03-01")).toBe("260301");
    expect(suggestCustomerCode(doc, "2026-12-25")).toBe("261225");
  });

  it("同じ日に複数あるときは a, b, c… を付ける", () => {
    const doc = createInitialDocument();
    const { doc: one } = saveCustomer(doc, input(doc, { code: "260301" }));
    expect(suggestCustomerCode(one, "2026-03-01")).toBe("260301a");

    const { doc: two } = saveCustomer(one, input(one, { code: "260301a" }));
    expect(suggestCustomerCode(two, "2026-03-01")).toBe("260301b");
  });

  it("自分自身の顧客IDは重複とみなさない（編集中）", () => {
    const doc = createInitialDocument();
    const { doc: saved, customerId } = saveCustomer(doc, input(doc, { code: "260301" }));
    expect(suggestCustomerCode(saved, "2026-03-01", customerId)).toBe("260301");
  });

  it("日付が無ければ候補を出さない", () => {
    const doc = createInitialDocument();
    expect(suggestCustomerCode(doc, "")).toBe("");
    expect(suggestCustomerCode(doc, "not-a-date")).toBe("");
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
        {
          id: null,
          ...lowVoltage,
          capacity: null,
          coefficientOverride: null,
          startMonth: null,
          note: "",
        },
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

describe("覚書", () => {
  it("点検1件ごとにメモを残せる", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));

    const withNote = setInspectionNote(first, {
      customerId,
      year: 2026,
      month: 9,
      type: "regular",
      note: "メガー持参。屋上の鍵を借りる",
    });

    expect(withNote.inspectionRecords).toHaveLength(1);
    expect(withNote.inspectionRecords[0].note).toBe("メガー持参。屋上の鍵を借りる");
    // 実施チェックは別物なので付かない
    expect(withNote.inspectionRecords[0].isDone).toBe(0);
  });

  it("実施チェック済みの点検にもメモを足せる", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const key = { customerId, year: 2026, month: 9, type: "regular" as const };

    const done = setInspectionDone(first, { ...key, isDone: true });
    const withNote = setInspectionNote(done, { ...key, note: "次回は要清掃" });

    expect(withNote.inspectionRecords).toHaveLength(1);
    expect(withNote.inspectionRecords[0].isDone).toBe(1);
    expect(withNote.inspectionRecords[0].note).toBe("次回は要清掃");
  });

  it("メモを空にすると消える", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const key = { customerId, year: 2026, month: 9, type: "regular" as const };

    const withNote = setInspectionNote(first, { ...key, note: "あとで消す" });
    const cleared = setInspectionNote(withNote, { ...key, note: "  " });

    expect(cleared.inspectionRecords[0].note).toBeNull();
  });

  it("月次の重点実施項目は毎年その月に巡ってくる", () => {
    const doc = createInitialDocument();

    const august = setMonthlyFocus(doc, { month: 8, note: "温度測定" });
    const both = setMonthlyFocus(august, { month: 9, note: "電流測定" });

    expect(getMonthlyFocus(both, 8)).toBe("温度測定");
    expect(getMonthlyFocus(both, 9)).toBe("電流測定");
    expect(getMonthlyFocus(both, 10)).toBe("");
    // 年は持たないので、どの年でも同じ内容が出る
    expect(both.monthlyFocus).toEqual([
      { month: 8, note: "温度測定" },
      { month: 9, note: "電流測定" },
    ]);
  });

  it("同じ月に書き直すと置き換わり、空にすると消える", () => {
    const doc = createInitialDocument();
    const a = setMonthlyFocus(doc, { month: 8, note: "温度測定" });
    const b = setMonthlyFocus(a, { month: 8, note: "温度測定と絶縁測定" });
    expect(b.monthlyFocus).toHaveLength(1);
    expect(getMonthlyFocus(b, 8)).toBe("温度測定と絶縁測定");

    const c = setMonthlyFocus(b, { month: 8, note: "  " });
    expect(c.monthlyFocus).toHaveLength(0);
  });

  it("年次点検の重点実施項目は指定年ごとに巡ってくる", () => {
    const doc = createInitialDocument();
    const withItem = saveAnnualFocus(doc, {
      id: null,
      title: "絶縁耐力試験",
      intervalYears: 3,
      baseYear: 2026,
      note: "",
    });
    const item = withItem.annualFocus[0];

    expect(isAnnualFocusDue(item, 2026)).toBe(true);
    expect(isAnnualFocusDue(item, 2027)).toBe(false);
    expect(isAnnualFocusDue(item, 2028)).toBe(false);
    expect(isAnnualFocusDue(item, 2029)).toBe(true);
    expect(isAnnualFocusDue(item, 2032)).toBe(true);
    // 起点より前は対象外
    expect(isAnnualFocusDue(item, 2025)).toBe(false);
  });

  it("毎年の項目は毎年該当する", () => {
    const doc = createInitialDocument();
    const withItem = saveAnnualFocus(doc, {
      id: null,
      title: "接地抵抗測定",
      intervalYears: 1,
      baseYear: 2026,
      note: "",
    });
    const item = withItem.annualFocus[0];
    expect(isAnnualFocusDue(item, 2026)).toBe(true);
    expect(isAnnualFocusDue(item, 2027)).toBe(true);
  });

  it("その年に該当する項目だけ取り出せる", () => {
    let doc = createInitialDocument();
    doc = saveAnnualFocus(doc, {
      id: null, title: "毎年やること", intervalYears: 1, baseYear: 2026, note: "",
    });
    doc = saveAnnualFocus(doc, {
      id: null, title: "3年ごと", intervalYears: 3, baseYear: 2026, note: "",
    });

    expect(getAnnualFocusForYear(doc, 2026).map((a) => a.title)).toEqual([
      "毎年やること",
      "3年ごと",
    ]);
    expect(getAnnualFocusForYear(doc, 2027).map((a) => a.title)).toEqual([
      "毎年やること",
    ]);
  });

  it("年次点検の項目を消せる", () => {
    const doc = createInitialDocument();
    const withItem = saveAnnualFocus(doc, {
      id: null, title: "消す項目", intervalYears: 2, baseYear: 2026, note: "",
    });
    const removed = deleteAnnualFocus(withItem, withItem.annualFocus[0].id);
    expect(removed.annualFocus).toHaveLength(0);
  });
});

describe("報告書の提出と年次点検の応援依頼", () => {
  const key = { customerId: 1, year: 2026, month: 9, type: "annual" as const };

  it("報告書の提出は実施チェックとは別に持つ", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const k = { ...key, customerId };

    const reported = setInspectionReported(first, { ...k, isReported: true });

    expect(reported.inspectionRecords).toHaveLength(1);
    expect(reported.inspectionRecords[0].isReported).toBe(1);
    expect(reported.inspectionRecords[0].reportedDate).not.toBeNull();
    // 点検を実施したことにはならない
    expect(reported.inspectionRecords[0].isDone).toBe(0);
  });

  it("実施と報告書は同じレコードに積み上がる", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const k = { ...key, customerId };

    const done = setInspectionDone(first, { ...k, isDone: true, doneDate: "2026-09-10" });
    const reported = setInspectionReported(done, {
      ...k,
      isReported: true,
      reportedDate: "2026-09-25",
    });

    expect(reported.inspectionRecords).toHaveLength(1);
    expect(reported.inspectionRecords[0].doneDate).toBe("2026-09-10");
    expect(reported.inspectionRecords[0].reportedDate).toBe("2026-09-25");
  });

  it("提出を外すと提出日も消える", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const k = { ...key, customerId };

    const on = setInspectionReported(first, { ...k, isReported: true });
    const off = setInspectionReported(on, { ...k, isReported: false });

    expect(off.inspectionRecords[0].isReported).toBe(0);
    expect(off.inspectionRecords[0].reportedDate).toBeNull();
  });

  it("年次点検に応援の要・不要と応援者を持てる", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const k = { ...key, customerId };

    const needs = setInspectionHelper(first, { ...k, needsHelper: true });
    const named = setInspectionHelper(needs, { ...k, helperName: "山田、佐藤" });

    expect(named.inspectionRecords).toHaveLength(1);
    expect(named.inspectionRecords[0].needsHelper).toBe(1);
    expect(named.inspectionRecords[0].helperName).toBe("山田、佐藤");
  });

  it("応援を不要に戻すと応援者も消える", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const k = { ...key, customerId };

    const named = setInspectionHelper(
      setInspectionHelper(first, { ...k, needsHelper: true }),
      { ...k, helperName: "山田" },
    );
    const cleared = setInspectionHelper(named, { ...k, needsHelper: false });

    expect(cleared.inspectionRecords[0].needsHelper).toBe(0);
    expect(cleared.inspectionRecords[0].helperName).toBe("");
  });

  it("通常点検と年次点検の記録は混ざらない", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));

    const annual = setInspectionReported(first, {
      customerId,
      year: 2026,
      month: 9,
      type: "annual",
      isReported: true,
    });
    const both = setInspectionReported(annual, {
      customerId,
      year: 2026,
      month: 9,
      type: "regular",
      isReported: false,
    });

    expect(both.inspectionRecords).toHaveLength(2);
    expect(both.inspectionRecords.find((r) => r.type === "annual")?.isReported).toBe(1);
    expect(both.inspectionRecords.find((r) => r.type === "regular")?.isReported).toBe(0);
  });
});

describe("中電PGの開閉器操作申し込み", () => {
  const key = { customerId: 1, year: 2026, month: 9, type: "annual" as const };

  it("申し込みの要否は顧客に、申込済みかは年次点検の記録に持つ", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, {
      ...input(doc),
      switchgearRequestRequired: 1,
      switchgearRequestNote: "豊田営業所へ2週間前まで",
    });

    expect(first.customers[0].switchgearRequestRequired).toBe(1);
    expect(first.customers[0].switchgearRequestNote).toBe("豊田営業所へ2週間前まで");

    const requested = setInspectionSwitchgearRequested(first, {
      ...key,
      customerId,
      isRequested: true,
      requestedDate: "2026-08-20",
    });

    expect(requested.inspectionRecords).toHaveLength(1);
    expect(requested.inspectionRecords[0].isSwitchgearRequested).toBe(1);
    expect(requested.inspectionRecords[0].switchgearRequestedDate).toBe("2026-08-20");
    // 申し込みは点検の実施でも報告書の提出でもない
    expect(requested.inspectionRecords[0].isDone).toBe(0);
    expect(requested.inspectionRecords[0].isReported).toBe(0);
  });

  it("申込を外すと申込日も消える", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const k = { ...key, customerId };

    const on = setInspectionSwitchgearRequested(first, { ...k, isRequested: true });
    const off = setInspectionSwitchgearRequested(on, { ...k, isRequested: false });

    expect(off.inspectionRecords[0].isSwitchgearRequested).toBe(0);
    expect(off.inspectionRecords[0].switchgearRequestedDate).toBeNull();
  });

  it("年ごとに別の記録になる", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));

    const y2026 = setInspectionSwitchgearRequested(first, {
      ...key,
      customerId,
      isRequested: true,
    });
    const y2027 = setInspectionSwitchgearRequested(y2026, {
      ...key,
      customerId,
      year: 2027,
      isRequested: false,
    });

    expect(y2027.inspectionRecords).toHaveLength(2);
    expect(
      y2027.inspectionRecords.find((r) => r.year === 2026)?.isSwitchgearRequested,
    ).toBe(1);
    expect(
      y2027.inspectionRecords.find((r) => r.year === 2027)?.isSwitchgearRequested,
    ).toBe(0);
  });
});

describe("点検実績のレコードの形", () => {
  it("呼び出し用の引数は記録に混ざらない", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const key = { customerId, year: 2026, month: 9, type: "annual" as const };

    const next = setInspectionSwitchgearRequested(first, { ...key, isRequested: true });
    const record = next.inspectionRecords[0];

    expect(Object.keys(record).sort()).toEqual(
      [
        "customerId",
        "doneDate",
        "helperName",
        "id",
        "isDone",
        "isReported",
        "isSwitchgearRequested",
        "month",
        "needsHelper",
        "note",
        "reportedDate",
        "switchgearRequestedDate",
        "type",
        "year",
      ].sort(),
    );
  });

  it("応援者だけを書いても、ほかの項目は既定のまま", () => {
    const doc = createInitialDocument();
    const { doc: first, customerId } = saveCustomer(doc, input(doc));
    const key = { customerId, year: 2026, month: 9, type: "annual" as const };

    const next = setInspectionHelper(first, { ...key, helperName: "山田" });

    expect(next.inspectionRecords[0].helperName).toBe("山田");
    expect(next.inspectionRecords[0].needsHelper).toBe(0);
    expect(next.inspectionRecords[0].isDone).toBe(0);
  });
});

describe("年次点検のみの契約", () => {
  it("通常点検のない周期を選べる", () => {
    const doc = createInitialDocument();
    const annualOnly = doc.inspectionCycles.find((c) => c.intervalMonths === 0);
    expect(annualOnly?.name).toBe("年次点検のみ");
  });

  it("通常点検の実施月が空でも、年次点検月があれば登録できる", () => {
    const doc = createInitialDocument();
    const annualOnly = doc.inspectionCycles.find((c) => c.intervalMonths === 0)!;

    const errors = validateCustomer(doc, {
      ...input(doc),
      inspectionCycleId: annualOnly.id,
      inspectionMonths: [],
      billingMonths: [],
      annualInspectionMonth: 9,
    });

    expect(errors.annualInspectionMonth).toBeUndefined();
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("通常点検も年次点検月もないと弾く", () => {
    const doc = createInitialDocument();
    const annualOnly = doc.inspectionCycles.find((c) => c.intervalMonths === 0)!;

    const errors = validateCustomer(doc, {
      ...input(doc),
      inspectionCycleId: annualOnly.id,
      inspectionMonths: [],
      billingMonths: [],
      annualInspectionMonth: null,
    });

    expect(errors.annualInspectionMonth).toBeDefined();
  });

  it("年次点検のみの顧客は、年次点検月にだけ点検が立つ", () => {
    const doc = createInitialDocument();
    const annualOnly = doc.inspectionCycles.find((c) => c.intervalMonths === 0)!;
    const { doc: saved } = saveCustomer(doc, {
      ...input(doc),
      inspectionCycleId: annualOnly.id,
      inspectionMonths: [],
      billingMonths: [],
      annualInspectionMonth: 9,
    });

    const view = getCustomerViews(saved, buildIndexes(saved))[0];
    expect(view.inspectionMonths).toEqual([]);

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const t = getInspectionTarget(
        {
          isActive: view.isActive,
          contractStartDate: view.contractStartDate,
          contractEndDate: view.contractEndDate,
          inspectionMonths: view.inspectionMonths,
          annualInspectionMonth: view.annualInspectionMonth,
        },
        { year: 2026, month: m },
      );
      if (t.regular || t.annual) months.push({ month: m, ...t });
    }

    expect(months).toEqual([{ month: 9, regular: false, annual: true }]);
  });
});
