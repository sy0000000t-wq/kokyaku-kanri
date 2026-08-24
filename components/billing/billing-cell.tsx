"use client";

import { useState } from "react";
import { useStore } from "@/lib/store/context";
import { setBilled, setBillingAmount, setPaid } from "@/lib/store/mutations";
import { cn, formatYen } from "@/lib/utils";

export type BillingKeyProps = {
  customerId: number;
  customerName: string;
  year: number;
  month: number;
  defaultAmount: number;
  paymentLagMonths: number;
};

function useBillingKey(props: BillingKeyProps) {
  const { update } = useStore();
  return {
    update,
    common: {
      customerId: props.customerId,
      year: props.year,
      month: props.month,
      defaultAmount: props.defaultAmount,
      paymentLagMonths: props.paymentLagMonths,
    },
  };
}

/** 請求済みチェック（1クリックで確定・楽観的更新） */
export function BilledCheck({
  isBilled,
  label,
  ...props
}: BillingKeyProps & { isBilled: boolean; label?: string }) {
  const { update, common } = useBillingKey(props);

  return (
    <label className="flex cursor-pointer items-center gap-1 text-[11px]">
      <input
        type="checkbox"
        className="size-3.5 accent-[oklch(0.52_0.15_250)]"
        checked={isBilled}
        onChange={(e) =>
          update((doc) => setBilled(doc, { ...common, isBilled: e.target.checked }))
        }
        aria-label={`${props.customerName} ${props.year}年${props.month}月 請求済み`}
      />
      {label ?? "請"}
    </label>
  );
}

/** 入金済みチェック */
export function PaidCheck({
  isPaid,
  label,
  ...props
}: BillingKeyProps & { isPaid: boolean; label?: string }) {
  const { update, common } = useBillingKey(props);

  return (
    <label className="flex cursor-pointer items-center gap-1 text-[11px]">
      <input
        type="checkbox"
        className="size-3.5 accent-[oklch(0.55_0.14_155)]"
        checked={isPaid}
        onChange={(e) =>
          update((doc) => setPaid(doc, { ...common, isPaid: e.target.checked }))
        }
        aria-label={`${props.customerName} ${props.year}年${props.month}月 入金済み`}
      />
      {label ?? "入"}
    </label>
  );
}

/** 請求額（クリックで編集） */
export function BillingAmount({
  amount,
  className,
  ...props
}: BillingKeyProps & { amount: number; className?: string }) {
  const { update, common } = useBillingKey(props);
  const [editing, setEditing] = useState(false);

  const commit = (next: number) => {
    setEditing(false);
    if (!Number.isFinite(next) || next === amount) return;
    update((doc) => setBillingAmount(doc, { ...common, amount: next }));
  };

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        defaultValue={amount}
        className={cn(
          "tabular h-6 w-full rounded border border-line px-1 text-right text-xs",
          className,
        )}
        onBlur={(e) => commit(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(Number(e.currentTarget.value));
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label={`${props.customerName} ${props.month}月の請求額`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn("tabular block w-full text-right text-xs hover:underline", className)}
      title="クリックで請求額を編集"
    >
      {formatYen(amount)}
    </button>
  );
}

/** §5.6 年間マトリクスの各月セル */
export function BillingCell({
  amount,
  isBilled,
  isPaid,
  isOverdue,
  isExpectedPaymentMonth,
  ...props
}: BillingKeyProps & {
  amount: number;
  isBilled: boolean;
  isPaid: boolean;
  isOverdue: boolean;
  isExpectedPaymentMonth?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-[5.25rem] rounded px-1 py-1",
        // 請求済み＝青、入金済み＝緑、未入金かつ期日超過＝赤
        isOverdue && "bg-danger-soft",
        !isOverdue && isPaid && "bg-ok-soft",
        !isOverdue && !isPaid && isBilled && "bg-brand-soft",
        isExpectedPaymentMonth && "ring-1 ring-brand/40 ring-inset",
      )}
    >
      <BillingAmount {...props} amount={amount} />
      <div className="mt-0.5 flex items-center justify-center gap-2">
        <BilledCheck {...props} isBilled={isBilled} />
        <PaidCheck {...props} isPaid={isPaid} />
      </div>
    </div>
  );
}
