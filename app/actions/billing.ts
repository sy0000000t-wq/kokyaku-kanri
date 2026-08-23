"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { calcExpectedPayment } from "@/lib/calc/billing";
import { todayIso } from "@/lib/utils";

type Key = { customerId: number; year: number; month: number };

function findRecord({ customerId, year, month }: Key) {
  return db
    .select()
    .from(schema.billingRecords)
    .where(
      and(
        eq(schema.billingRecords.customerId, customerId),
        eq(schema.billingRecords.year, year),
        eq(schema.billingRecords.month, month),
      ),
    )
    .get();
}

/** レコードが無ければ既定の請求額・入金予定月で作る（§3.9 遅延生成） */
function ensureRecord(key: Key, defaults: { amount: number; paymentLagMonths: number }) {
  const existing = findRecord(key);
  if (existing) return existing;

  const expected = calcExpectedPayment(
    { year: key.year, month: key.month },
    defaults.paymentLagMonths,
  );

  return db
    .insert(schema.billingRecords)
    .values({
      ...key,
      billingAmount: defaults.amount,
      expectedPaymentYear: expected.year,
      expectedPaymentMonth: expected.month,
    })
    .returning()
    .get();
}

function revalidate() {
  revalidatePath("/billing");
  revalidatePath("/");
}

export async function setBilled(
  input: Key & {
    isBilled: boolean;
    defaultAmount: number;
    paymentLagMonths: number;
    billedDate?: string | null;
  },
) {
  const record = ensureRecord(input, {
    amount: input.defaultAmount,
    paymentLagMonths: input.paymentLagMonths,
  });

  db.update(schema.billingRecords)
    .set({
      isBilled: input.isBilled ? 1 : 0,
      billedDate: input.isBilled ? (input.billedDate ?? todayIso()) : null,
    })
    .where(eq(schema.billingRecords.id, record.id))
    .run();

  revalidate();
  return { ok: true as const };
}

export async function setPaid(
  input: Key & {
    isPaid: boolean;
    defaultAmount: number;
    paymentLagMonths: number;
    paidDate?: string | null;
  },
) {
  const record = ensureRecord(input, {
    amount: input.defaultAmount,
    paymentLagMonths: input.paymentLagMonths,
  });

  db.update(schema.billingRecords)
    .set({
      isPaid: input.isPaid ? 1 : 0,
      paidDate: input.isPaid ? (input.paidDate ?? todayIso()) : null,
    })
    .where(eq(schema.billingRecords.id, record.id))
    .run();

  revalidate();
  return { ok: true as const };
}

/** §4.5 請求額はレコード単位で手修正できる */
export async function setBillingAmount(
  input: Key & { amount: number; paymentLagMonths: number },
) {
  const record = ensureRecord(input, {
    amount: input.amount,
    paymentLagMonths: input.paymentLagMonths,
  });

  db.update(schema.billingRecords)
    .set({ billingAmount: Math.max(0, Math.round(input.amount)) })
    .where(eq(schema.billingRecords.id, record.id))
    .run();

  revalidate();
  return { ok: true as const };
}
