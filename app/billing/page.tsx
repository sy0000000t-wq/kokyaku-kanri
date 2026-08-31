"use client";

import { Suspense } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BilledCheck,
  BillingAmount,
  BillingCell,
  PaidCheck,
} from "@/components/billing/billing-cell";
import { PeriodNav } from "@/components/period-nav";
import { ScopeFilter } from "@/components/scope-filter";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import { buildBillingGrid } from "@/lib/store/monthly";
import { getCustomerViews } from "@/lib/store/selectors";
import { resolvePeriod } from "@/lib/period";
import {
  cn,
  formatDate,
  formatYearMonth,
  formatYen,
  MONTHS,
} from "@/lib/utils";

type SP = Record<string, string | undefined>;

function BillingPageInner() {
  const params = useSearchParams();
  const { doc, indexes } = useStore();

  const sp: SP = Object.fromEntries(params.entries());
  const period = resolvePeriod(sp);
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const showAll = sp.active === "all";
  const quick = sp.q === "unbilled" || sp.q === "unpaid" ? sp.q : "all";

  const rows = getCustomerViews(doc, indexes).filter((c) => showAll || c.isActive);
  const { cellFor } = buildBillingGrid(doc, period.year, today);

  const monthCells = rows
    .map((c) => cellFor(c, period.month))
    .filter((cell) => cell.isTarget);

  const listCells = monthCells.filter((cell) => {
    if (quick === "unbilled") return !cell.isBilled;
    if (quick === "unpaid") return !cell.isPaid;
    return true;
  });

  // 集計パネル（§5.6）
  const billingTotal = monthCells.reduce((s, c) => s + c.amount, 0);
  const billedCells = monthCells.filter((c) => c.isBilled);
  const billedTotal = billedCells.reduce((s, c) => s + c.amount, 0);

  // 今月に入金予定のセルは、年をまたぐ場合があるので前年分も見る
  const paymentCells = [period.year - 1, period.year]
    .flatMap((y) => {
      const grid = buildBillingGrid(doc, y, today);
      return rows.flatMap((c) =>
        MONTHS.map((m) => grid.cellFor(c, m)).filter(
          (cell) =>
            cell.isTarget &&
            cell.expected.year === period.year &&
            cell.expected.month === period.month,
        ),
      );
    });
  const paymentTotal = paymentCells.reduce((s, c) => s + c.amount, 0);
  const paidCells = paymentCells.filter((c) => c.isPaid);
  const paidTotal = paidCells.reduce((s, c) => s + c.amount, 0);

  const overdueCells = [period.year - 1, period.year]
    .flatMap((y) => {
      const grid = buildBillingGrid(doc, y, today);
      return rows.flatMap((c) => MONTHS.map((m) => grid.cellFor(c, m)));
    })
    .filter((cell) => cell.isTarget && cell.isOverdue);
  const overdueTotal = overdueCells.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">請求・入金管理</h1>
          <p className="text-xs text-muted">{period.year}年の請求額と請求済・入金済</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <ScopeFilter base="/billing" />
          <PeriodNav base="/billing" year={period.year} month={period.month} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title="年間マトリクス"
            description="請求は対象期間の最終月に立ちます（隔月なら2ヶ月分をまとめて請求）。請求額はクリックで編集。請＝請求済み（青）、入＝入金済み（緑）、期日超過は赤"
          />
          {rows.length === 0 ? (
            <EmptyState>表示できる顧客がありません。</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-sm">
                <thead className="border-b border-line bg-canvas text-xs text-muted">
                  <tr>
                    <th className="sticky-col left-0 w-[4.5rem] min-w-[4.5rem] px-2.5 py-2 text-left font-medium whitespace-nowrap">
                      顧客ID
                    </th>
                    <th className="sticky-col sticky-col-shadow left-[4.5rem] w-40 min-w-40 px-2.5 py-2 text-left font-medium sm:w-56 sm:min-w-56">
                      物件名称
                    </th>
                    <th className="w-28 px-2.5 py-2 text-left font-medium whitespace-nowrap">
                      請求サイクル
                    </th>
                    {MONTHS.map((m) => (
                      <th
                        key={m}
                        className={cn(
                          "px-1 py-2 text-center font-medium",
                          m === period.month && "bg-brand-soft text-brand",
                        )}
                      >
                        {m}月
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b border-line last:border-0",
                        !c.isActive && "text-muted opacity-70",
                      )}
                    >
                      <td className="sticky-col left-0 px-2.5 py-1.5 font-mono text-xs">
                        {c.code}
                      </td>
                      <td className="sticky-col sticky-col-shadow left-[4.5rem] px-2.5 py-1.5">
                        <Link
                          href={`/customers/edit?id=${c.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {c.name}
                        </Link>
                        {!c.isActive && (
                          <Badge className="ml-1.5">
                            解除
                            {c.contractEndDate ? `（${formatDate(c.contractEndDate)}）` : ""}
                          </Badge>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-xs whitespace-nowrap">
                        {c.billingCycle?.name ?? "毎月"}
                      </td>
                      {MONTHS.map((m) => {
                        const cell = cellFor(c, m);
                        if (!cell.isTarget) {
                          return (
                            <td
                              key={m}
                              className="border-l border-line bg-canvas px-1 py-1.5 text-center text-xs text-muted"
                              title="請求サイクル対象外"
                            >
                              −
                            </td>
                          );
                        }
                        return (
                          <td key={m} className="border-l border-line px-1 py-1.5 align-top">
                            <BillingCell
                              customerId={c.id}
                              customerName={c.name}
                              year={period.year}
                              month={m}
                              amount={cell.amount}
                              defaultAmount={cell.defaultAmount}
                              isBilled={cell.isBilled}
                              isPaid={cell.isPaid}
                              isOverdue={cell.isOverdue}
                              coveredMonths={cell.coveredMonths}
                              paymentLagMonths={c.paymentLagMonths}
                              isExpectedPaymentMonth={
                                cell.expected.year === period.year &&
                                cell.expected.month === period.month
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title={`${formatYearMonth(period.year, period.month)}の集計`} />
          <dl className="divide-y divide-line text-sm">
            <SumRow label="今月の請求予定額" count={monthCells.length}>
              {formatYen(billingTotal)}
            </SumRow>
            <SumRow label="うち請求済み" count={billedCells.length}>
              {formatYen(billedTotal)}
            </SumRow>
            <SumRow label="今月の入金予定額" count={paymentCells.length}>
              {formatYen(paymentTotal)}
            </SumRow>
            <SumRow label="うち入金済み" count={paidCells.length}>
              {formatYen(paidTotal)}
            </SumRow>
            <SumRow label="未入金（期日超過）" count={overdueCells.length} tone="danger">
              {formatYen(overdueTotal)}
            </SumRow>
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`${formatYearMonth(period.year, period.month)}の請求リスト`}
          action={
            <div className="no-print inline-flex rounded-md border border-line p-0.5">
              {[
                { value: "all", label: "すべて" },
                { value: "unbilled", label: "未請求のみ" },
                { value: "unpaid", label: "未入金のみ" },
              ].map((o) => {
                const params = new URLSearchParams(
                  Object.entries(sp).filter(([, v]) => v) as [string, string][],
                );
                if (o.value === "all") params.delete("q");
                else params.set("q", o.value);
                return (
                  <Link
                    key={o.value}
                    href={`/billing?${params.toString()}`}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs",
                      quick === o.value ? "bg-brand text-white" : "text-muted hover:text-ink",
                    )}
                  >
                    {o.label}
                  </Link>
                );
              })}
            </div>
          }
        />
        {listCells.length === 0 ? (
          <EmptyState>該当する請求がありません。</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-canvas text-xs text-muted">
                <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th>物件名</th>
                  <th className="text-right!">請求額</th>
                  <th className="text-center!">請求</th>
                  <th>請求日</th>
                  <th>入金予定月</th>
                  <th className="text-center!">入金</th>
                  <th>入金日</th>
                </tr>
              </thead>
              <tbody>
                {listCells.map((cell) => (
                  <tr key={cell.customer.id} className="border-b border-line last:border-0">
                    <td className="px-2.5 py-2">
                      <Link
                        href={`/customers/edit?id=${cell.customer.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {cell.customer.name}
                      </Link>
                      {cell.isOverdue && (
                        <Badge tone="danger" className="ml-1.5">
                          期日超過 {cell.monthsOverdue}ヶ月
                        </Badge>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      {cell.coveredMonths.length > 1 && (
                        <div className="mb-0.5 text-xs text-muted">
                          {cell.coveredMonths.join("・")}月分
                        </div>
                      )}
                      <BillingAmount
                        customerId={cell.customer.id}
                        customerName={cell.customer.name}
                        year={period.year}
                        month={period.month}
                        amount={cell.amount}
                        defaultAmount={cell.defaultAmount}
                        paymentLagMonths={cell.customer.paymentLagMonths}
                        className="text-sm"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex justify-center">
                        <BilledCheck
                          customerId={cell.customer.id}
                          customerName={cell.customer.name}
                          year={period.year}
                          month={period.month}
                          defaultAmount={cell.defaultAmount}
                          paymentLagMonths={cell.customer.paymentLagMonths}
                          isBilled={cell.isBilled}
                          label="請求済み"
                        />
                      </div>
                    </td>
                    <td className="tabular px-2.5 py-2 text-xs">
                      {formatDate(cell.billedDate)}
                    </td>
                    <td className="tabular px-2.5 py-2 text-xs">
                      {formatYearMonth(cell.expected.year, cell.expected.month)}
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <PaidCheck
                          customerId={cell.customer.id}
                          customerName={cell.customer.name}
                          year={period.year}
                          month={period.month}
                          defaultAmount={cell.defaultAmount}
                          paymentLagMonths={cell.customer.paymentLagMonths}
                          isPaid={cell.isPaid}
                          label="入金済み"
                        />
                        {!cell.isPaid && cell.isOverdue && <Badge tone="danger">超過</Badge>}
                      </div>
                    </td>
                    <td className="tabular px-2.5 py-2 text-xs">{formatDate(cell.paidDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SumRow({
  label,
  count,
  children,
  tone,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("tabular text-right", tone === "danger" && count > 0 && "text-danger")}>
        <span className="font-semibold">{children}</span>
        <span className="ml-1 text-xs text-muted">（{count} 件）</span>
      </dd>
    </div>
  );
}

/**
 * useSearchParams はレンダリング境界を要求するため Suspense で包む。
 * 中身はブラウザ側で描画される。
 */
export default function BillingPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">読み込んでいます…</p>}>
      <BillingPageInner />
    </Suspense>
  );
}
