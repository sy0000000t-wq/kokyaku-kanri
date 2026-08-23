"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { todayIso } from "@/lib/utils";

export type InspectionType = "regular" | "annual";

/**
 * §10-6 チェック操作は1クリックで完結させる。
 * レコードはチェックを付けた時点で必ず永続化する（§3.8）。
 */
export async function setInspectionDone(input: {
  customerId: number;
  year: number;
  month: number;
  type: InspectionType;
  isDone: boolean;
  doneDate?: string | null;
}) {
  const { customerId, year, month, type, isDone } = input;
  const doneDate = isDone ? (input.doneDate ?? todayIso()) : null;

  const existing = db
    .select()
    .from(schema.inspectionRecords)
    .where(
      and(
        eq(schema.inspectionRecords.customerId, customerId),
        eq(schema.inspectionRecords.year, year),
        eq(schema.inspectionRecords.month, month),
        eq(schema.inspectionRecords.type, type),
      ),
    )
    .get();

  if (existing) {
    db.update(schema.inspectionRecords)
      .set({ isDone: isDone ? 1 : 0, doneDate })
      .where(eq(schema.inspectionRecords.id, existing.id))
      .run();
  } else {
    db.insert(schema.inspectionRecords)
      .values({
        customerId,
        year,
        month,
        type,
        isDone: isDone ? 1 : 0,
        doneDate,
      })
      .run();
  }

  revalidatePath("/schedule");
  revalidatePath("/");
  return { ok: true as const };
}

/** 実施日の直接編集 */
export async function setInspectionDate(input: {
  customerId: number;
  year: number;
  month: number;
  type: InspectionType;
  doneDate: string | null;
}) {
  const existing = db
    .select()
    .from(schema.inspectionRecords)
    .where(
      and(
        eq(schema.inspectionRecords.customerId, input.customerId),
        eq(schema.inspectionRecords.year, input.year),
        eq(schema.inspectionRecords.month, input.month),
        eq(schema.inspectionRecords.type, input.type),
      ),
    )
    .get();

  if (existing) {
    db.update(schema.inspectionRecords)
      .set({ doneDate: input.doneDate })
      .where(eq(schema.inspectionRecords.id, existing.id))
      .run();
  } else if (input.doneDate) {
    db.insert(schema.inspectionRecords)
      .values({ ...input, isDone: 1 })
      .run();
  }

  revalidatePath("/schedule");
  revalidatePath("/");
  return { ok: true as const };
}
