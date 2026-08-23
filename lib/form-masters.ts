import "server-only";
import type { FormMasters } from "@/lib/customer-form-types";
import { getMasters, type Masters } from "@/lib/queries";

/** サーバー側のマスタをクライアントフォームに渡せる形へ落とす */
export function toFormMasters(masters: Masters = getMasters()): FormMasters {
  const coefficientRows: FormMasters["coefficientRows"] = {};
  for (const [tableId, rows] of masters.coefficientRowsByTable) {
    coefficientRows[tableId] = rows.map((r) => ({
      minCapacity: r.minCapacity,
      maxCapacity: r.maxCapacity,
      coefficient: r.coefficient,
    }));
  }

  return {
    facilityTypes: masters.facilityTypes
      .filter((f) => f.isActive)
      .map((f) => ({
        id: f.id,
        name: f.name,
        capacityUnit: f.capacityUnit,
        coefficientTableId: f.coefficientTableId,
        secondaryCoefficientTableId: f.secondaryCoefficientTableId,
      })),
    inspectionCycles: masters.inspectionCycles
      .filter((c) => c.isActive)
      .map((c) => ({
        id: c.id,
        name: c.name,
        intervalMonths: c.intervalMonths,
        coefficientMultiplier: c.coefficientMultiplier,
      })),
    billingCycles: masters.billingCycles
      .filter((b) => b.isActive)
      .map((b) => ({ id: b.id, name: b.name, intervalMonths: b.intervalMonths })),
    coefficientRows,
    taxRate: masters.settings.taxRate,
  };
}
