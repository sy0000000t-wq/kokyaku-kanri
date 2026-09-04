"use client";

import { useState } from "react";
import { formatBilledMonths } from "@/lib/calc/billing";
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
        aria-label={`${props.customerName} ${props.year}年${props.month}月分 入金済み`}
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

/**
 * 年間マトリクスの上段：この月に「立つ」請求。
 * 請求額と請求済みチェックだけを持つ。
 */
export function BillingBox({
  amount,
  isBilled,
  coveredMonths,
  ...props
}: BillingKeyProps & {
  amount: number;
  isBilled: boolean;
  coveredMonths?: number[];
}) {
  return (
    <div className={cn("rounded px-1 py-1", isBilled && "bg-brand-soft")}>
      {coveredMonths && coveredMonths.length > 1 && (
        <div className="text-center text-[10px] leading-tight text-muted">
          {formatBilledMonths(coveredMonths)}
        </div>
      )}
      <div className="flex items-center gap-1">
        <BillingAmount {...props} amount={amount} className="flex-1" />
        <BilledCheck {...props} isBilled={isBilled} />
      </div>
    </div>
  );
}

/**
 * 年間マトリクスの下段：この月に「入る」入金。
 * 請求より paymentLagMonths ヶ月あとの月に現れるので、
 * 何月分の入金なのかを必ず出す。請求額はここでは編集しない。
 */
export function PaymentBox({
  amount,
  isPaid,
  isOverdue,
  coveredMonths,
  ...props
}: BillingKeyProps & {
  amount: number;
  isPaid: boolean;
  isOverdue: boolean;
  coveredMonths: number[];
}) {
  return (
    <div
      className={cn(
        "rounded border border-dashed border-line px-1 py-1",
        // 入金済み＝緑、未入金かつ期日超過＝赤
        isPaid && "border-transparent bg-ok-soft",
        !isPaid && isOverdue && "border-transparent bg-danger-soft",
      )}
    >
      <div className="text-center text-[10px] leading-tight text-muted">
        {formatBilledMonths(coveredMonths)} 入金
      </div>
      <div className="flex items-center gap-1">
        <span className="tabular flex-1 text-right text-xs text-muted">
          {formatYen(amount)}
        </span>
        <PaidCheck {...props} isPaid={isPaid} />
      </div>
    </div>
  );
}
