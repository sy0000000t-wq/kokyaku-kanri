"use client";

import { Suspense } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InspectionCheck } from "@/components/schedule/inspection-check";
import { PeriodNav } from "@/components/period-nav";
import { Badge, Card, CardHeader, EmptyState, Progress } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import { getUnpaidItems, summarizeMonth } from "@/lib/store/monthly";
import { getCustomerViews } from "@/lib/store/selectors";
import { resolvePeriod } from "@/lib/period";
import {
  cn,
  formatKm,
  formatYearMonth,
  formatYen,
  splitPhones,
  telHref,
} from "@/lib/utils";

function DashboardPageInner() {
  const params = useSearchParams();
  const { doc, indexes } = useStore();

  const period = resolvePeriod({
    y: params.get("y") ?? undefined,
    m: params.get("m") ?? undefined,
  });
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth() + 1 };

  const customers = getCustomerViews(doc, indexes).filter((c) => c.isActive);
  const summary = summarizeMonth(doc, customers, period, today);
  const unpaid = getUnpaidItems(doc, customers, now);
  const unpaidTotal = unpaid.reduce((s, u) => s + u.amount, 0);

  // 当月の点検対象を距離順にまとめる
  const inspections = [...summary.regular.cells, ...summary.annual.cells].sort(
    (a, b) => (a.customer.distanceKm ?? 1e9) - (b.customer.distanceKm ?? 1e9),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            {formatYearMonth(period.year, period.month)}のダッシュボード
          </h1>
          <p className="text-xs text-muted">稼働中 {customers.length} 件が対象</p>
        </div>
        <PeriodNav base="/" year={period.year} month={period.month} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="今月の通常点検"
          value={`${summary.regular.done} / ${summary.regular.total}`}
          unit="件"
          progress={{ value: summary.regular.done, max: summary.regular.total, tone: "brand" }}
          href={`/schedule?y=${period.year}&m=${period.month}&type=regular`}
        />
        <SummaryCard
          title="今月の年次点検"
          value={`${summary.annual.done} / ${summary.annual.total}`}
          unit="件"
          progress={{ value: summary.annual.done, max: summary.annual.total, tone: "warn" }}
          href={`/schedule?y=${period.year}&m=${period.month}&type=annual`}
        />
        <SummaryCard
          title="今月の請求"
          value={`${summary.billing.billed} / ${summary.billing.total}`}
          unit="件"
          sub={`請求予定額 ${formatYen(summary.billing.amount)}`}
          progress={{ value: summary.billing.billed, max: summary.billing.total, tone: "brand" }}
          href={`/billing?y=${period.year}&m=${period.month}`}
        />
        <SummaryCard
          title="未入金"
          value={String(unpaid.length)}
          unit="件"
          sub={formatYen(unpaidTotal)}
          tone={unpaid.length > 0 ? "danger" : undefined}
          href={`/billing?y=${period.year}&m=${period.month}&q=unpaid`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="今月の点検対象"
            description="距離の近い順"
            action={
              <Link
                href={`/schedule?y=${period.year}&m=${period.month}`}
                className="text-xs text-brand hover:underline"
              >
                スケジュールへ
              </Link>
            }
          />
          {inspections.length === 0 ? (
            <EmptyState>この月の点検対象はありません。</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {inspections.map((cell) => (
                <li
                  key={`${cell.customer.id}-${cell.type}`}
                  className="flex items-start gap-3 px-4 py-2.5"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/customers/edit?id=${cell.customer.id}`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        {cell.customer.name}
                      </Link>
                      <Badge tone={cell.type === "annual" ? "warn" : "brand"}>
                        {cell.type === "annual" ? "★ 年次" : "● 通常"}
                      </Badge>
                      <Badge>{cell.customer.inspectionCycle?.name ?? "—"}</Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                      <span className="tabular">{formatKm(cell.customer.distanceKm)}</span>
                      {splitPhones(cell.customer.phone).map((p) => (
                        <a key={p} href={telHref(p)} className="text-brand underline">
                          {p}
                        </a>
                      ))}
                    </div>
                  </div>
                  <InspectionCheck
                    customerId={cell.customer.id}
                    customerName={cell.customer.name}
                    year={period.year}
                    month={period.month}
                    type={cell.type}
                    isDone={cell.isDone}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="未入金一覧"
            description="入金予定月を過ぎた請求"
            action={
              <Link href="/billing?q=unpaid" className="text-xs text-brand hover:underline">
                請求・入金へ
              </Link>
            }
          />
          {unpaid.length === 0 ? (
            <EmptyState>未入金はありません。</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {unpaid.map((u) => (
                <li
                  key={`${u.customer.id}-${u.year}-${u.month}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div>
                    <Link
                      href={`/customers/edit?id=${u.customer.id}`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {u.customer.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {formatYearMonth(u.year, u.month)}分 / 入金予定{" "}
                      {formatYearMonth(u.expected.year, u.expected.month)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular text-sm font-semibold text-danger">
                      {formatYen(u.amount)}
                    </div>
                    <div className="text-xs text-muted">{u.overdueDays} 日経過</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  unit,
  sub,
  progress,
  tone,
  href,
}: {
  title: string;
  value: string;
  unit?: string;
  sub?: string;
  progress?: { value: number; max: number; tone: "brand" | "ok" | "warn" };
  tone?: "danger";
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full p-4 transition-colors hover:border-brand/40">
        <p className="text-xs text-muted">{title}</p>
        <p
          className={cn(
            "tabular mt-1 text-2xl font-semibold",
            tone === "danger" && value !== "0" && "text-danger",
          )}
        >
          {value}
          {unit && <span className="ml-0.5 text-sm font-normal text-muted">{unit}</span>}
        </p>
        {sub && <p className="tabular mt-0.5 text-xs text-muted">{sub}</p>}
        {progress && (
          <div className="mt-2">
            <Progress value={progress.value} max={progress.max} tone={progress.tone} />
          </div>
        )}
      </Card>
    </Link>
  );
}

/**
 * useSearchParams はレンダリング境界を要求するため Suspense で包む。
 * 中身はブラウザ側で描画される。
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">読み込んでいます…</p>}>
      <DashboardPageInner />
    </Suspense>
  );
}
