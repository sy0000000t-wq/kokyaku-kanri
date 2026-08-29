"use client";

import { Suspense, useEffect, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CustomerFilters } from "@/components/customers/customer-filters";
import { ActiveToggle } from "@/components/customers/active-toggle";
import { RecalcDistancesButton } from "@/components/customers/recalc-distances-button";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui";
import { CustomerCsvButton } from "@/components/customers/customer-csv-button";
import { CustomerCell } from "@/components/customers/customer-cell";
import { ColumnPicker } from "@/components/customers/column-picker";
import { TaxToggle } from "@/components/tax-toggle";
import {
  COLUMNS,
  loadVisibleColumns,
  saveVisibleColumns,
  type ColumnId,
} from "@/lib/customer-columns";
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

/** 並べ替えに対応している列 */
const SORTABLE: Partial<Record<ColumnId, SortKey>> = {
  points: "points",
  monthly: "monthly",
  annual: "annual",
  unitPrice: "unitPrice",
  distance: "distance",
};

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

  const [visible, setVisible] = useState<ColumnId[]>(loadVisibleColumns);
  // 端末に憶えておく
  useEffect(() => saveVisibleColumns(visible), [visible]);

  const shownColumns = COLUMNS.filter((c) => visible.includes(c.id));
  // 固定2列 + 選んだ列 + 状態列。横スクロールできる幅を確保する
  const tableMinWidth = `${28 + shownColumns.length * 9}rem`;

  const showTaxIncluded = doc.settings.showTaxIncluded;

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
          <TaxToggle />
          <ColumnPicker visible={visible} onChange={setVisible} />
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
            <table className="w-full text-sm" style={{ minWidth: tableMinWidth }}>
              <thead className="border-b border-line bg-canvas text-xs text-muted">
                <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th className="sticky-col left-0 w-[4.5rem] min-w-[4.5rem] whitespace-nowrap">
                    <SortLink label="顧客ID" sortKey="code" sp={sp} />
                  </th>
                  <th className="sticky-col sticky-col-shadow left-[4.5rem] w-40 min-w-40 sm:w-52 sm:min-w-52">
                    <SortLink label="物件名称" sortKey="name" sp={sp} />
                  </th>
                  {shownColumns.map((col) => (
                    <th
                      key={col.id}
                      className={cn(
                        "whitespace-nowrap",
                        col.numeric && "text-right!",
                        col.id === "facilities" && "min-w-64",
                      )}
                    >
                      {SORTABLE[col.id] ? (
                        <SortLink label={col.label} sortKey={SORTABLE[col.id]!} sp={sp} />
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                  <th className="text-center!">状態</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-line last:border-0 hover:bg-canvas",
                      // 解除済みの行は淡色表示
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
                    {shownColumns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          "px-2.5 py-2",
                          col.numeric && "tabular text-right whitespace-nowrap",
                          col.id === "facilities" && "text-xs",
                        )}
                      >
                        <CustomerCell
                          column={col.id}
                          customer={c}
                          showTaxIncluded={showTaxIncluded}
                        />
                      </td>
                    ))}
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
                  <td colSpan={2} className="sticky-col left-0 font-medium">
                    合計（稼働中 {summary.count} 件）
                  </td>
                  {shownColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(col.numeric && "tabular text-right font-medium")}
                    >
                      <ColumnTotal
                        column={col.id}
                        summary={summary}
                        showTaxIncluded={showTaxIncluded}
                      />
                    </td>
                  ))}
                  <td />
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

/** 集計フッターの各列。合計を出せる列だけ値を返す */
function ColumnTotal({
  column,
  summary,
  showTaxIncluded,
}: {
  column: ColumnId;
  summary: ReturnType<typeof summarizeCustomers>;
  showTaxIncluded: boolean;
}) {
  switch (column) {
    case "points":
      return <>{formatPoints(summary.points)}</>;
    case "monthly":
      return (
        <>{formatYen(showTaxIncluded ? summary.monthlyIncl : summary.monthlyExcl)}</>
      );
    case "annual":
      return (
        <>{formatYen(showTaxIncluded ? summary.annualIncl : summary.annualExcl)}</>
      );
    case "annualInspectionFee":
      return <>{formatYen(summary.annualInspectionFeeExcl)}</>;
    case "unitPrice":
      return (
        <>
          {formatYen(summary.unitPriceAvg)}
          <div className="font-normal text-muted">平均</div>
        </>
      );
    default:
      return null;
  }
}
