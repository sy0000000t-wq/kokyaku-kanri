import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import {
  seedBillingCycles,
  seedCoefficientTables,
  seedEquipmentCategories,
  seedInspectionCycles,
} from "./seed-data";

type DB = BetterSQLite3Database<typeof schema>;

/**
 * §7 マスタの初期投入。
 * 既に同名レコードがある場合は触らない（ユーザーの編集内容を壊さない）。
 */
export function seedMasters(db: DB) {
  const log: string[] = [];

  // settings（1レコードのみ）
  const existingSettings = db.select().from(schema.settings).all();
  if (existingSettings.length === 0) {
    db.insert(schema.settings)
      .values({ id: 1, baseAddress: "", taxRate: 0.1, distanceMode: "auto" })
      .run();
    log.push("settings を初期化しました");
  }

  // 換算係数テーブルと行
  for (const [i, table] of seedCoefficientTables.entries()) {
    const found = db
      .select()
      .from(schema.coefficientTables)
      .where(eq(schema.coefficientTables.name, table.name))
      .get();
    if (found) continue;

    const inserted = db
      .insert(schema.coefficientTables)
      .values({ name: table.name, unit: table.unit, note: table.note })
      .returning()
      .get();

    db.insert(schema.coefficientRows)
      .values(
        table.rows.map((r, idx) => ({
          tableId: inserted.id,
          minCapacity: r.minCapacity,
          maxCapacity: r.maxCapacity,
          coefficient: r.coefficient,
          sortOrder: idx,
        })),
      )
      .run();
    log.push(`換算係数テーブル「${table.name}」を ${table.rows.length} 行投入しました`);
    void i;
  }

  const tableIdByName = new Map(
    db
      .select()
      .from(schema.coefficientTables)
      .all()
      .map((t) => [t.name, t.id] as const),
  );

  // 設備区分と、区分ごとの点検周期
  for (const [idx, category] of seedEquipmentCategories.entries()) {
    const found = db
      .select()
      .from(schema.equipmentCategories)
      .where(eq(schema.equipmentCategories.name, category.name))
      .get();
    if (found) continue;

    const inserted = db
      .insert(schema.equipmentCategories)
      .values({
        name: category.name,
        categoryGroup: category.categoryGroup,
        capacityUnit: category.capacityUnit,
        calculationMethod: category.calculationMethod,
        coefficientTableId: category.table
          ? (tableIdByName.get(category.table) ?? null)
          : null,
        minCapacity: category.minCapacity ?? null,
        maxCapacity: category.maxCapacity ?? null,
        note: category.note ?? "",
        sortOrder: idx,
        isActive: 1,
      })
      .returning()
      .get();

    db.insert(schema.categoryCycles)
      .values(
        category.cycles.map((c, i) => ({
          categoryId: inserted.id,
          name: c.name,
          intervalMonths: c.intervalMonths,
          multiplier: c.multiplier ?? null,
          fixedPoints: c.fixedPoints ?? null,
          requiresInsulationMonitor: c.requiresInsulationMonitor ? 1 : 0,
          conditionNote: c.conditionNote ?? "",
          sortOrder: i,
        })),
      )
      .run();

    log.push(
      `設備区分「${category.name}」を周期 ${category.cycles.length} 件とともに追加しました`,
    );
  }

  // 点検周期
  for (const [idx, c] of seedInspectionCycles.entries()) {
    const found = db
      .select()
      .from(schema.inspectionCycles)
      .where(eq(schema.inspectionCycles.name, c.name))
      .get();
    if (found) continue;

    db.insert(schema.inspectionCycles)
      .values({ ...c, sortOrder: idx, isActive: 1 })
      .run();
    log.push(`点検周期「${c.name}」を追加しました`);
  }

  // 請求サイクル
  for (const [idx, c] of seedBillingCycles.entries()) {
    const found = db
      .select()
      .from(schema.billingCycles)
      .where(eq(schema.billingCycles.name, c.name))
      .get();
    if (found) continue;

    db.insert(schema.billingCycles)
      .values({ ...c, sortOrder: idx, isActive: 1 })
      .run();
    log.push(`請求サイクル「${c.name}」を追加しました`);
  }

  return log;
}
