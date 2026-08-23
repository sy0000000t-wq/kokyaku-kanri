import Link from "next/link";
import { CustomerFilters } from "@/components/customers/customer-filters";
import { ActiveToggle } from "@/components/customers/active-toggle";
import { RecalcDistancesButton } from "@/components/customers/recalc-distances-button";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui";
import {
  applyCustomerFilters,
  parseCustomerFilters,
  type SortKey,
} from "@/lib/customer-filter";
import { getCustomerViews, getMasters, summarizeCustomers } from "@/lib/queries";
import {
  cn,
  formatDate,
  formatKm,
  formatNumber,
  formatPoints,
  formatYen,
  splitPhones,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const filters = parseCustomerFilters(sp);
  const masters = getMasters();
  const all = getCustomerViews();
  const rows = applyCustomerFilters(all, filters);
  // §5.3 集計は常に稼働中の行を対象にする
  const summary = summarizeCustomers(all);

  const csvParams = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  );

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
          <a
            href={`/api/export/customers?${csvParams.toString()}`}
            className={buttonClass("outline", "sm")}
          >
            CSV エクスポート
          </a>
          <Link href="/customers/new" className={buttonClass("default", "sm")}>
            ＋ 新規登録
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CustomerFilters
          facilityTypes={masters.facilityTypes}
          inspectionCycles={masters.inspectionCycles}
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
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="border-b border-line bg-canvas text-xs text-muted">
                <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th className="sticky-col left-0">
                    <SortLink label="顧客ID" sortKey="code" sp={sp} />
                  </th>
                  <th className="sticky-col sticky-col-shadow left-[4.5rem] min-w-52">
                    <SortLink label="物件名称" sortKey="name" sp={sp} />
                  </th>
                  <th>施設種別</th>
                  <th className="text-right!">設備容量</th>
                  <th>点検周期</th>
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
                    <td className="sticky-col left-0 px-2.5 py-2 font-mono text-xs">
                      {c.code}
                    </td>
                    <td className="sticky-col sticky-col-shadow left-[4.5rem] px-2.5 py-2">
                      <Link
                        href={`/customers/${c.id}`}
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
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      {c.facilityType?.name ?? "—"}
                    </td>
                    <td className="tabular px-2.5 py-2 text-right whitespace-nowrap">
                      {c.capacityKva != null && `${formatNumber(c.capacityKva)} kVA`}
                      {c.capacityKva != null && c.capacityKw != null && " / "}
                      {c.capacityKw != null && `${formatNumber(c.capacityKw)} kW`}
                      {c.capacityKva == null && c.capacityKw == null && "—"}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      {c.inspectionCycle?.name ?? "—"}
                    </td>
                    <td className="tabular px-2.5 py-2 text-right">
                      {formatPoints(c.points)}
                      {c.isPointsOverridden && (
                        <Badge tone="warn" className="ml-1">
                          上書
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
                  <td colSpan={5} className="sticky-col left-0 font-medium">
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
