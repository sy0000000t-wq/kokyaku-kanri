import type { AppDocument } from "./document";
import type { CustomerInput } from "./mutations";

export type ValidationErrors = Record<string, string>;

/** 顧客フォームの検証。保存前にここを通す */
export function validateCustomer(
  doc: AppDocument,
  input: CustomerInput,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!input.code.trim()) {
    errors.code = "顧客IDは必須です";
  } else if (
    doc.customers.some((c) => c.code === input.code.trim() && c.id !== input.id)
  ) {
    errors.code = "同じ顧客IDが既に登録されています";
  }

  if (!input.name.trim()) errors.name = "物件名称は必須です";
  if (!input.inspectionCycleId) errors.inspectionCycleId = "訪問周期は必須です";
  if (!Number.isFinite(input.monthlyFee)) errors.monthlyFee = "月額（税抜）は必須です";
  else if (input.monthlyFee < 0) errors.monthlyFee = "月額は 0 以上で入力してください";
  if (!input.address.trim()) errors.address = "住所は必須です";
  if (!input.contractStartDate) errors.contractStartDate = "契約開始日は必須です";

  if (input.annualFeeHandling === "separate" && input.annualInspectionFee == null) {
    errors.annualInspectionFee = "「別途請求」のときは年次点検費が必須です";
  }

  if (
    input.contractEndDate &&
    input.contractStartDate &&
    input.contractEndDate < input.contractStartDate
  ) {
    errors.contractEndDate = "解除日は契約開始日以降にしてください";
  }

  if (input.facilities.length === 0) {
    errors.facilities = "設備を1つ以上登録してください";
  } else {
    for (const [i, f] of input.facilities.entries()) {
      const category = doc.equipmentCategories.find((c) => c.id === f.categoryId);
      if (!category) {
        errors.facilities = `設備 ${i + 1}：設備区分を選んでください`;
        break;
      }
      const cycle = doc.categoryCycles.find(
        (c) => c.id === f.categoryCycleId && c.categoryId === f.categoryId,
      );
      if (!cycle) {
        errors.facilities = `設備 ${i + 1}：点検周期を選んでください`;
        break;
      }
      if (category.capacityUnit !== "none") {
        // 係数表を引く区分では、容量か換算係数のどちらかが要る
        const needsCapacity =
          category.calculationMethod === "table" && f.coefficientOverride == null;
        if (needsCapacity && f.capacity == null) {
          errors.facilities = `設備 ${i + 1}：設備容量、または換算係数を入力してください`;
          break;
        }
        if (f.capacity != null && f.capacity < 0) {
          errors.facilities = `設備 ${i + 1}：設備容量は 0 以上で入力してください`;
          break;
        }
      }
    }
  }

  return errors;
}
