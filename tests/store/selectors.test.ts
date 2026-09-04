import { describe, expect, it } from "vitest";
import { createInitialDocument, parseDocument } from "@/lib/store/seed";
import {
  buildIndexes,
  getCustomerViews,
  summarizeCustomers,
} from "@/lib/store/selectors";
import type { AppDocument, Customer } from "@/lib/store/document";

const CATEGORY = {
  demandOver100: "需要設備（高圧・100kVA超過）",
  solarSelf: "太陽電池発電所（自家消費）",
  solarSell: "太陽電池発電所（全量売電）",
  thermal: "火力発電所（ディーゼル・ガスタービン等）",
};

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    code: "T01",
    name: "テスト事業場",
    inspectionCycleId: 2,
    monthlyFee: 17500,
    monthlyFeeTaxMode: "excluded" as const,
    contractType: "hoan" as const,
    annualFeeHandling: "included",
    annualInspectionFee: null,
    annualFeeTaxMode: "excluded" as const,
    unitPriceOverride: null,
    address: "愛知県",
    lat: null,
    lng: null,
    distanceKm: null,
    durationMin: null,
    distanceMethod: null,
    distanceUpdatedAt: null,
    phone: "",
    email: "",
    contactPerson: "",
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
    billingCycleId: 1,
    paymentLagMonths: 1,
    isActive: 1,
    note: "",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

/** 区分名と周期名を指定して設備を1件足す */
function addFacility(
  doc: AppDocument,
  customerId: number,
  categoryName: string,
  cycleName: string,
  capacity: number | null,
) {
  const category = doc.equipmentCategories.find((c) => c.name === categoryName);
  if (!category) throw new Error(`設備区分が見つかりません: ${categoryName}`);
  const cycle = doc.categoryCycles.find(
    (c) => c.categoryId === category.id && c.name === cycleName,
  );
  if (!cycle) throw new Error(`周期が見つかりません: ${cycleName}`);

  doc.customerFacilities.push({
    id: doc.customerFacilities.length + 1,
    customerId,
    categoryId: category.id,
    categoryCycleId: cycle.id,
    capacity,
    coefficientOverride: null,
    startMonth: null,
    note: "",
    sortOrder: doc.customerFacilities.filter((f) => f.customerId === customerId).length,
  });
}

describe("createInitialDocument", () => {
  it("マスタが一式そろっている", () => {
    const doc = createInitialDocument();
    expect(doc.coefficientTables).toHaveLength(2);
    expect(doc.coefficientRows).toHaveLength(24);
    expect(doc.equipmentCategories).toHaveLength(12);
    expect(doc.inspectionCycles.length).toBeGreaterThan(0);
    expect(doc.billingCycles).toHaveLength(5);
    expect(doc.customers).toHaveLength(0);
  });

  it("設備区分には必ず周期がぶら下がっている", () => {
    const doc = createInitialDocument();
    for (const category of doc.equipmentCategories) {
      const cycles = doc.categoryCycles.filter((c) => c.categoryId === category.id);
      expect(cycles.length, category.name).toBeGreaterThan(0);
    }
  });

  it("係数表を引く区分にはテーブルが紐づいている", () => {
    const doc = createInitialDocument();
    for (const c of doc.equipmentCategories.filter(
      (c) => c.calculationMethod === "table",
    )) {
      expect(c.coefficientTableId, c.name).not.toBeNull();
    }
  });
});

describe("getCustomerViews（換算値算出フロー図の参考例）", () => {
  it("参考例1：需要設備300kVA 2ヶ月 + 太陽光80kW 自家消費 6ヶ月 = 0.555 点", () => {
    const doc = createInitialDocument();
    doc.customers.push(customer());
    addFacility(doc, 1, CATEGORY.demandOver100, "2ヶ月に1回", 300);
    addFacility(doc, 1, CATEGORY.solarSelf, "6ヶ月に1回", 80);

    const view = getCustomerViews(doc, buildIndexes(doc))[0];
    expect(view.facilities.map((f) => f.result.points)).toEqual([0.48, 0.075]);
    expect(view.points).toBe(0.555);
  });

  it("参考例2：需要設備550kVA + ディーゼル80kW + 太陽光100kW全量売電 = 1.152 点", () => {
    const doc = createInitialDocument();
    doc.customers.push(customer());
    addFacility(doc, 1, CATEGORY.demandOver100, "2ヶ月に1回", 550);
    addFacility(doc, 1, CATEGORY.thermal, "月1回", 80);
    addFacility(doc, 1, CATEGORY.solarSell, "3ヶ月に1回", 100);

    const view = getCustomerViews(doc, buildIndexes(doc))[0];
    expect(view.facilities.map((f) => f.result.points)).toEqual([0.72, 0.3, 0.132]);
    expect(view.points).toBe(1.152);
  });
});

describe("getCustomerViews（既存シートとの一致）", () => {
  it("A社（サンプル）相当：210kVA 隔月 → 0.48 点 / 年額210,000 / 点数単価36,458", () => {
    const doc = createInitialDocument();
    doc.customers.push(customer({ monthlyFee: 17500 }));
    addFacility(doc, 1, CATEGORY.demandOver100, "2ヶ月に1回", 210);

    const view = getCustomerViews(doc, buildIndexes(doc))[0];
    expect(view.points).toBe(0.48);
    expect(view.pricing.annualExcl).toBe(210000);
    expect(view.pricing.unitPrice).toBe(36458);
  });

  it("B社（サンプル）相当：530kVA 隔月 別途40,000 → 0.60 点 / 点数単価28,889", () => {
    const doc = createInitialDocument();
    doc.customers.push(
      customer({
        monthlyFee: 14000,
        annualFeeHandling: "separate",
        annualInspectionFee: 40000,
      }),
    );
    addFacility(doc, 1, CATEGORY.demandOver100, "2ヶ月に1回", 530);

    const view = getCustomerViews(doc, buildIndexes(doc))[0];
    expect(view.points).toBe(0.6);
    expect(view.pricing.annualExcl).toBe(208000);
    expect(view.pricing.unitPrice).toBe(28889);
  });
});

describe("summarizeCustomers", () => {
  /** 稼働中1件（17,500円）と解除済1件（99,999円） */
  function twoCustomers() {
    const doc = createInitialDocument();
    doc.customers.push(customer({ id: 1, code: "T01" }));
    doc.customers.push(customer({ id: 2, code: "T02", isActive: 0, monthlyFee: 99999 }));
    addFacility(doc, 1, CATEGORY.demandOver100, "2ヶ月に1回", 210);
    addFacility(doc, 2, CATEGORY.demandOver100, "2ヶ月に1回", 210);
    return getCustomerViews(doc, buildIndexes(doc));
  }

  it("渡した行だけを集計する", () => {
    const views = twoCustomers();
    const summary = summarizeCustomers(views.filter((v) => v.isActive));

    expect(summary.count).toBe(1);
    expect(summary.monthlyExcl).toBe(17500);
    expect(summary.points).toBe(0.48);
  });

  it("絞り込んだ結果をそのまま合計できる", () => {
    const views = twoCustomers();

    // 1件だけに絞れば、その1件の合計になる
    expect(summarizeCustomers([views[1]]).monthlyExcl).toBe(99999);
    // 解除済みも、渡せば数える（表示している行が対象）
    expect(summarizeCustomers(views).count).toBe(2);
  });

  it("空なら合計は 0、点数単価の平均は null", () => {
    const summary = summarizeCustomers([]);
    expect(summary.count).toBe(0);
    expect(summary.monthlyExcl).toBe(0);
    expect(summary.unitPriceAvg).toBeNull();
  });
});

describe("parseDocument", () => {
  it("SQLite 版のエクスポート（settings が配列）をそのまま読める", () => {
    const initial = createInitialDocument();
    const v1 = {
      version: 1,
      exportedAt: "2026-08-24T00:00:00.000Z",
      settings: [
        {
          id: 1,
          baseAddress: "愛知県豊田市",
          baseLat: 35.1,
          baseLng: 137.1,
          googleMapsApiKey: null,
          taxRate: 0.1,
          distanceMode: "auto",
          updatedAt: "2026-08-24T00:00:00.000Z",
        },
      ],
      coefficientTables: initial.coefficientTables,
      coefficientRows: initial.coefficientRows,
      equipmentCategories: initial.equipmentCategories,
      categoryCycles: initial.categoryCycles,
      inspectionCycles: initial.inspectionCycles,
      billingCycles: initial.billingCycles,
      customers: [customer()],
      customerFacilities: [],
      customerInspectionMonths: [{ customerId: 1, month: 3 }],
      inspectionRecords: [],
      billingRecords: [],
    };

    const doc = parseDocument(v1);
    expect(doc.version).toBe(2);
    expect(doc.settings.baseAddress).toBe("愛知県豊田市");
    expect(doc.settings.taxRate).toBe(0.1);
    expect(doc.customers).toHaveLength(1);
    expect(doc.customerInspectionMonths).toEqual([{ customerId: 1, month: 3 }]);
  });

  it("形式が違うものは弾く", () => {
    expect(() => parseDocument(null)).toThrow();
    expect(() => parseDocument({ hello: "world" })).toThrow();
    expect(() => parseDocument({ customers: "not an array" })).toThrow();
  });
});

describe("設備ごとの点検月", () => {
  it("自家消費の太陽光は6ヶ月に1回の月だけ対象になる", () => {
    const doc = createInitialDocument();
    // 3月契約開始。需要設備は2ヶ月ごと、太陽光は6ヶ月ごと
    doc.customers.push(customer({ contractStartDate: "2026-03-01" }));
    addFacility(doc, 1, CATEGORY.demandOver100, "2ヶ月に1回", 300);
    addFacility(doc, 1, CATEGORY.solarSelf, "6ヶ月に1回", 80);

    const view = getCustomerViews(doc, buildIndexes(doc))[0];
    const demand = view.facilities[0];
    const solar = view.facilities[1];

    expect(demand.inspectionMonths).toEqual([1, 3, 5, 7, 9, 11]);
    expect(solar.inspectionMonths).toEqual([3, 9]);
  });

  it("毎月点検の設備は全月が対象", () => {
    const doc = createInitialDocument();
    doc.customers.push(customer({ contractStartDate: "2026-03-01" }));
    addFacility(doc, 1, CATEGORY.demandOver100, "月1回", 300);

    const view = getCustomerViews(doc, buildIndexes(doc))[0];
    expect(view.facilities[0].inspectionMonths).toHaveLength(12);
  });
});

describe("設備ごとの点検開始月", () => {
  /** 7月開始・隔月訪問（7・9・11・1・3・5月）に太陽光6ヶ月を1件置く */
  function solarSite(startMonth: number | null) {
    const doc = createInitialDocument();
    doc.customers.push(customer({ contractStartDate: "2026-07-01" }));
    addFacility(doc, 1, CATEGORY.demandOver100, "2ヶ月に1回", 300);
    addFacility(doc, 1, CATEGORY.solarSelf, "6ヶ月に1回", 80);
    doc.customerFacilities[1].startMonth = startMonth;
    for (const month of [7, 9, 11, 1, 3, 5]) {
      doc.customerInspectionMonths.push({ customerId: 1, month });
    }
    return getCustomerViews(doc, buildIndexes(doc))[0];
  }

  it("未指定なら需要設備は7・9・11・1・3・5月、太陽光は7・1月", () => {
    const view = solarSite(null);
    expect(view.facilities[0].inspectionMonths).toEqual([1, 3, 5, 7, 9, 11]);
    expect(view.facilities[1].inspectionMonths).toEqual([1, 7]);
  });

  it("太陽光を9月始まりにすると9・3月になる", () => {
    const view = solarSite(9);
    // 需要設備は変わらない
    expect(view.facilities[0].inspectionMonths).toEqual([1, 3, 5, 7, 9, 11]);
    expect(view.facilities[1].inspectionMonths).toEqual([3, 9]);
  });
});
