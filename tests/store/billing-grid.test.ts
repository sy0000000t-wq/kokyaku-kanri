import { describe, expect, it } from "vitest";
import { createInitialDocument } from "@/lib/store/seed";
import { buildBillingGrid } from "@/lib/store/monthly";
import { buildIndexes, getCustomerViews } from "@/lib/store/selectors";
import type { AppDocument, Customer } from "@/lib/store/document";
import { generateBillingMonths } from "@/lib/calc/billing";

const TODAY = { year: 2026, month: 8 };

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    code: "260301",
    name: "テスト事業場",
    inspectionCycleId: 2,
    monthlyFee: 17500,
    monthlyFeeTaxMode: "excluded",
    feeBasis: "monthly" as const,
    annualFeeHandling: "included",
    annualInspectionFee: null,
    annualFeeTaxMode: "excluded",
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
    billingCoverage: "period" as const,
    paymentLagMonths: 1,
    isActive: 1,
    note: "",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function setup(overrides: Partial<Customer>) {
  const doc: AppDocument = createInitialDocument();
  const c = customer(overrides);
  doc.customers.push(c);

  // 請求月は顧客が持つ。ここでは請求サイクルどおりに置く
  const cycle = doc.billingCycles.find((b) => b.id === c.billingCycleId);
  const startMonth = Number(c.contractStartDate.slice(5, 7));
  for (const month of generateBillingMonths(startMonth, cycle?.intervalMonths ?? 1)) {
    doc.customerBillingMonths.push({ customerId: c.id, month });
  }

  const view = getCustomerViews(doc, buildIndexes(doc))[0];
  return { doc, view };
}

describe("buildBillingGrid：請求月と入金月を分けて引く", () => {
  it("隔月・翌月入金は、4月に請求が立ち、入金は5月に現れる", () => {
    // 3月契約の隔月：3・4月分を4月に請求し、5月に入金
    const { doc, view } = setup({ billingCycleId: 2, paymentLagMonths: 1 });
    const { cellFor, paymentCellFor } = buildBillingGrid(doc, 2026, TODAY);

    expect(cellFor(view, 4).isTarget).toBe(true);
    expect(cellFor(view, 4).coveredMonths).toEqual([3, 4]);
    // 5月は請求月ではない
    expect(cellFor(view, 5).isTarget).toBe(false);

    // 入金は請求の翌月にだけ現れる
    expect(paymentCellFor(view, 4)).toBeNull();
    const payment = paymentCellFor(view, 5);
    expect(payment).not.toBeNull();
    expect(payment?.month).toBe(4);
    expect(payment?.coveredMonths).toEqual([3, 4]);
  });

  it("3ヶ月ごと・翌月入金は、12月請求の入金が翌年1月に現れる", () => {
    // 10月契約の3ヶ月：10-12月分を12月に請求し、翌年1月に入金
    const { doc, view } = setup({
      contractStartDate: "2025-10-01",
      billingCycleId: 3,
      paymentLagMonths: 1,
    });

    const y2025 = buildBillingGrid(doc, 2025, TODAY);
    expect(y2025.cellFor(view, 12).isTarget).toBe(true);
    expect(y2025.cellFor(view, 12).coveredMonths).toEqual([10, 11, 12]);
    // 12月のセルに入金は出さない
    expect(y2025.paymentCellFor(view, 12)).toBeNull();

    const y2026 = buildBillingGrid(doc, 2026, TODAY);
    const payment = y2026.paymentCellFor(view, 1);
    expect(payment?.year).toBe(2025);
    expect(payment?.month).toBe(12);
    expect(payment?.coveredMonths).toEqual([10, 11, 12]);
    // 1月は請求月ではない（次の請求は3月）
    expect(y2026.cellFor(view, 1).isTarget).toBe(false);
    expect(y2026.cellFor(view, 3).isTarget).toBe(true);
  });

  it("入金チェックは請求月のレコードに書かれるので、翌月のセルから読める", () => {
    const { doc, view } = setup({ billingCycleId: 2, paymentLagMonths: 1 });
    doc.billingRecords.push({
      id: 1,
      customerId: 1,
      year: 2026,
      month: 4,
      billingAmount: 38500,
      isBilled: 1,
      billedDate: "2026-04-30",
      isPaid: 1,
      paidDate: "2026-05-25",
      expectedPaymentYear: 2026,
      expectedPaymentMonth: 5,
      note: "",
    });

    const { paymentCellFor } = buildBillingGrid(doc, 2026, TODAY);
    const payment = paymentCellFor(view, 5);
    expect(payment?.isPaid).toBe(true);
    expect(payment?.amount).toBe(38500);
    expect(payment?.paidDate).toBe("2026-05-25");
  });

  it("同月入金（入金ラグ0）なら請求と入金が同じ月に並ぶ", () => {
    const { doc, view } = setup({ billingCycleId: 1, paymentLagMonths: 0 });
    const { cellFor, paymentCellFor } = buildBillingGrid(doc, 2026, TODAY);

    expect(cellFor(view, 6).isTarget).toBe(true);
    expect(paymentCellFor(view, 6)?.month).toBe(6);
  });
});
