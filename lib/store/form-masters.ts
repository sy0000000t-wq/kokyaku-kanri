import type { FormMasters } from "@/lib/customer-form-types";
import type { AppDocument } from "./document";
import type { Indexes } from "./selectors";

/** 文書を顧客フォームが使う形へ落とす */
export function toFormMasters(doc: AppDocument, indexes: Indexes): FormMasters {
  const coefficientRows: FormMasters["coefficientRows"] = {};
  for (const [tableId, rows] of indexes.coefficientRowsByTable) {
    coefficientRows[tableId] = rows.map((r) => ({
      minCapacity: r.minCapacity,
      maxCapacity: r.maxCapacity,
      coefficient: r.coefficient,
    }));
  }

  return {
    categories: doc.equipmentCategories
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
        cycles: (indexes.categoryCyclesByCategory.get(c.id) ?? []).map((cy) => ({
          id: cy.id,
          name: cy.name,
          intervalMonths: cy.intervalMonths,
          multiplier: cy.multiplier,
          fixedPoints: cy.fixedPoints,
          requiresInsulationMonitor: !!cy.requiresInsulationMonitor,
          conditionNote: cy.conditionNote,
        })),
      })),
    inspectionCycles: doc.inspectionCycles
      .filter((c) => c.isActive)
      .map((c) => ({ id: c.id, name: c.name, intervalMonths: c.intervalMonths })),
    billingCycles: doc.billingCycles
      .filter((b) => b.isActive)
      .map((b) => ({ id: b.id, name: b.name, intervalMonths: b.intervalMonths })),
    coefficientRows,
    taxRate: doc.settings.taxRate,
  };
}
