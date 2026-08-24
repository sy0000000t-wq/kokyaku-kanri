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
    categories: masters.equipmentCategories
      .filter((c) => c.isActive)
      .map((c) => ({
        id: c.id,
        name: c.name,
        categoryGroup: c.categoryGroup,
        capacityUnit: c.capacityUnit,
        calculationMethod: c.calculationMethod,
        coefficientTableId: c.coefficientTableId,
        minCapacity: c.minCapacity,
        maxCapacity: c.maxCapacity,
        note: c.note,
        cycles: (masters.categoryCyclesByCategory.get(c.id) ?? []).map((cy) => ({
          id: cy.id,
          name: cy.name,
          intervalMonths: cy.intervalMonths,
          multiplier: cy.multiplier,
          fixedPoints: cy.fixedPoints,
          requiresInsulationMonitor: !!cy.requiresInsulationMonitor,
          conditionNote: cy.conditionNote,
        })),
      })),
    inspectionCycles: masters.inspectionCycles
      .filter((c) => c.isActive)
      .map((c) => ({ id: c.id, name: c.name, intervalMonths: c.intervalMonths })),
    billingCycles: masters.billingCycles
      .filter((b) => b.isActive)
      .map((b) => ({ id: b.id, name: b.name, intervalMonths: b.intervalMonths })),
    coefficientRows,
    taxRate: masters.settings.taxRate,
  };
}
