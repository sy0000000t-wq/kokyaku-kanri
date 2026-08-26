"use client";

import { Suspense } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CustomerFilters } from "@/components/customers/customer-filters";
import { ActiveToggle } from "@/components/customers/active-toggle";
import { RecalcDistancesButton } from "@/components/customers/recalc-distances-button";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui";
import { CustomerCsvButton } from "@/components/customers/customer-csv-button";
import {
  applyCustomerFilters,
  parseCustomerFilters,
  type SortKey,
} from "@/lib/customer-filter";
import { useStore } from "@/lib/store/context";
import { getCustomerViews, summarizeCustomers } from "@/lib/store/selectors";
import {
  cn,
  formatDate,
  formatKm,
  formatPoints,
  formatYen,
  splitPhones,
  summarizeFacility,
} from "@/lib/utils";

type SP = Record<string, string | undefined>;

function SortLink({
  label,
  sortKey,
  sp,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sp: SP;
  className?: string;
}) {
  const current = parseCustomerFilters(sp);
  const nextDir = current.sort === sortKey && current.dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  );
  params.set("sort", sortKey);
  params.set("dir", nextDir);

  const arrow =
    current.sort === sortKey ? (current.dir === "asc" ? " ▲" : " ▼") : "";

  return (
    <Link
      href={`/customers?${params.toString()}`}
      className={cn("hover:text-ink", current.sort === sortKey && "text-ink", className)}
    >
      {label}
      {arrow}
    </Link>
  );
}

function CustomersPageInner() {
  const params = useSearchParams();
  const { doc, indexes } = useStore();

  const sp: SP = Object.fromEntries(params.entries());
  const filters = parseCustomerFilters(sp);
  const all = getCustomerViews(doc, indexes);
  const rows = applyCustomerFilters(all, filters);
  // §5.3 集計は常に稼働中の行を対象にする
  const summary = summarizeCustomers(all);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">顧客マスタ</h1>
          <p className="text-xs text-muted">
            {rows.length} 件表示 / 稼働中 {summary.count} 件
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecalcDistancesButton />
          <CustomerCsvButton rows={rows} />
          <Link href="/customers/new" className={buttonClass("default", "sm")}>
            ＋ 新規登録
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CustomerFilters
          categories={doc.equipmentCategories}
          inspectionCycles={doc.inspectionCycles}
        />

        {rows.length === 0 ? (
          <EmptyState>
            該当する顧客がありません。
            <Link href="/customers/new" className="ml-1 text-brand underline">
              新規登録
            </Link>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1560px] text-sm">
              <thead className="border-b border-line bg-canvas text-xs text-muted">
                <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th className="sticky-col left-0 w-[4.5rem] min-w-[4.5rem] whitespace-nowrap">
                    <SortLink label="顧客ID" sortKey="code" sp={sp} />
                  </th>
                  <th className="sticky-col sticky-col-shadow left-[4.5rem] w-40 min-w-40 sm:w-52 sm:min-w-52">
                    <SortLink label="物件名称" sortKey="name" sp={sp} />
                  </th>
                  <th className="w-72 min-w-72">設備</th>
                  <th>訪問周期</th>
                  <th className="text-right!">
                    <SortLink label="保安管理点数" sortKey="points" sp={sp} />
                  </th>
                  <th className="text-right!">
                    <SortLink label="月額(税抜)" sortKey="monthly" sp={sp} />
                  </th>
                  <th className="text-right!">
                    <SortLink label="年額(税抜)" sortKey="annual" sp={sp} />
                  </th>
                  <th className="text-right!">
                    <SortLink label="点数単価" sortKey="unitPrice" sp={sp} />
                  </th>
                  <th className="text-right!">
                    <SortLink label="距離" sortKey="distance" sp={sp} />
                  </th>
                  <th>担当者</th>
                  <th>連絡先</th>
                  <th>契約開始日</th>
                  <th className="text-center!">状態</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-line last:border-0 hover:bg-canvas",
                      // §6 解除済みの行は淡色表示
                      !c.isActive && "text-muted opacity-70",
                    )}
                  >
                    <td className="sticky-col left-0 w-[4.5rem] min-w-[4.5rem] px-2.5 py-2 font-mono text-xs whitespace-nowrap">
                      {c.code}
                    </td>
                    <td className="sticky-col sticky-col-shadow left-[4.5rem] w-40 min-w-40 px-2.5 py-2 sm:w-52 sm:min-w-52">
                      <Link
                        href={`/customers/edit?id=${c.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {c.name}
                      </Link>
                      {!c.isActive && (
                        <Badge tone="neutral" className="ml-1.5">
                          解除{c.contractEndDate ? `（${formatDate(c.contractEndDate)}）` : ""}
                        </Badge>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-xs">
                      {c.facilities.length === 0 ? (
                        <Badge tone="warn">設備が未登録</Badge>
                      ) : (
                        c.facilities.map((f) => (
                          <div key={f.id} className="whitespace-nowrap">
                            {summarizeFacility(
                              f.category?.name,
                              f.capacity,
                              f.category?.capacityUnit,
                            )}
                            <span className="ml-1 text-muted">
                              / {f.cycle?.name ?? "—"} / {formatPoints(f.result.points)}点
                            </span>
                          </div>
                        ))
                      )}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      {c.inspectionCycle?.name ?? "—"}
                    </td>
                    <td className="tabular px-2.5 py-2 text-right">
                      {formatPoints(c.points)}
                      {c.facilities.some((f) => f.result.isOverridden) && (
                        <Badge tone="warn" className="ml-1">
                          手動
                        </Badge>
                      )}
                    </td>
                    <td className="tabular px-2.5 py-2 text-right">
                      {formatYen(c.pricing.monthlyExcl)}
                    </td>
                    <td className="tabular px-2.5 py-2 text-right">
                      {formatYen(c.pricing.annualExcl)}
                    </td>
                    <td className="tabular px-2.5 py-2 text-right">
                      {formatYen(c.pricing.unitPrice)}
                    </td>
                    <td className="tabular px-2.5 py-2 text-right whitespace-nowrap">
                      {c.distanceKm == null ? (
                        <Badge tone="warn">未取得</Badge>
                      ) : (
                        <>
                          {formatKm(c.distanceKm)}
                          {c.distanceMethod === "straight" && (
                            <Badge tone="neutral" className="ml-1">
                              直線
                            </Badge>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      {c.contactPerson || "—"}
                    </td>
                    <td className="px-2.5 py-2 text-xs whitespace-nowrap">
                      {splitPhones(c.phone).map((p) => (
                        <div key={p}>{p}</div>
                      ))}
                      {splitPhones(c.phone).length === 0 && "—"}
                    </td>
                    <td className="tabular px-2.5 py-2 whitespace-nowrap">
                      {formatDate(c.contractStartDate)}
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex justify-center">
                        <ActiveToggle id={c.id} name={c.name} isActive={!!c.isActive} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-canvas text-xs">
                <tr className="[&>td]:px-2.5 [&>td]:py-2">
                  <td colSpan={4} className="sticky-col left-0 font-medium">
                    合計（稼働中 {summary.count} 件）
                  </td>
                  <td className="tabular text-right font-medium">
                    {formatPoints(summary.points)}
                  </td>
                  <td className="tabular text-right font-medium">
                    {formatYen(summary.monthlyExcl)}
                  </td>
                  <td className="tabular text-right font-medium">
                    {formatYen(summary.annualExcl)}
                    <div className="font-normal text-muted">
                      税込 {formatYen(summary.annualIncl)}
                    </div>
                  </td>
                  <td className="tabular text-right font-medium">
                    {formatYen(summary.unitPriceAvg)}
                    <div className="font-normal text-muted">平均</div>
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * useSearchParams はレンダリング境界を要求するため Suspense で包む。
 * 中身はブラウザ側で描画される。
 */
export default function CustomersPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">読み込んでいます…</p>}>
      <CustomersPageInner />
    </Suspense>
  );
}
