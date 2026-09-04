"use client";

import { Suspense } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InspectionCheck } from "@/components/schedule/inspection-check";
import {
  HelperFields,
  ReportedCheck,
  SwitchgearRequestCheck,
} from "@/components/schedule/inspection-extras";
import { InspectionNote } from "@/components/schedule/inspection-note";
import { FocusItems } from "@/components/schedule/focus-items";
import { PeriodNav } from "@/components/period-nav";
import { ScopeFilter } from "@/components/scope-filter";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { getInspectionTarget } from "@/lib/calc/schedule";
import { useStore } from "@/lib/store/context";
import { buildInspectionGrid, type InspectionCell } from "@/lib/store/monthly";
import { groupByCity } from "@/lib/store/route-groups";
import { AVAILABILITY_LABEL } from "@/lib/customer-columns";
import { getCustomerViews } from "@/lib/store/selectors";
import { resolvePeriod } from "@/lib/period";
import {
  cn,
  formatDate,
  formatKm,
  formatYearMonth,
  MONTHS,
  splitPhones,
  telHref,
} from "@/lib/utils";

type SP = Record<string, string | undefined>;

function SchedulePageInner() {
  const params = useSearchParams();
  const { doc, indexes } = useStore();

  const sp: SP = Object.fromEntries(params.entries());
  const period = resolvePeriod(sp);
  const showAll = sp.active === "all";
  const typeFilter = sp.type === "regular" || sp.type === "annual" ? sp.type : "both";
  // 既定は市町村ごと。日によって使い分けられるよう距離順にも切り替えられる
  const listView = sp.view === "flat" ? "flat" : "group";

  const rows = getCustomerViews(doc, indexes).filter((c) => showAll || c.isActive);
  const { cellFor } = buildInspectionGrid(doc, period.year);

  // 当月リストは距離順（未取得は末尾）
  const monthCells = rows
    .flatMap((c) => {
      const list = [];
      if (typeFilter !== "annual") list.push(cellFor(c, period.month, "regular"));
      if (typeFilter !== "regular") list.push(cellFor(c, period.month, "annual"));
      return list;
    })
    .filter((cell) => cell.isTarget)
    .sort((a, b) => (a.customer.distanceKm ?? 1e9) - (b.customer.distanceKm ?? 1e9));

  const routeGroups = groupByCity(monthCells);

  const regularCount = monthCells.filter((c) => c.type === "regular").length;
  const annualCount = monthCells.filter((c) => c.type === "annual").length;
  const doneCount = monthCells.filter((c) => c.isDone).length;
  const reportedCount = monthCells.filter((c) => c.isReported).length;
  // 点検は終えたのに報告書がまだ、という積み残しを見えるようにする
  const unreportedCount = monthCells.filter((c) => c.isDone && !c.isReported).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">点検スケジュール</h1>
          <p className="text-xs text-muted">{period.year}年の年間予定と実施状況</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <ScopeFilter base="/schedule" />
          <TypeFilter current={typeFilter} sp={sp} />
          <PeriodNav base="/schedule" year={period.year} month={period.month} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title="年間マトリクス"
            description="● が通常点検、★ が年次点検。「点検」を押すと緑、「報告」を押すと青になります（報告＝報告書の提出済み）"
          />
          {rows.length === 0 ? (
            <EmptyState>表示できる顧客がありません。</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="border-b border-line bg-canvas text-xs text-muted">
                  <tr>
                    <th className="sticky-col left-0 w-[4.5rem] min-w-[4.5rem] px-2.5 py-2 text-left font-medium whitespace-nowrap">
                      顧客ID
                    </th>
                    <th className="sticky-col sticky-col-shadow left-[4.5rem] w-40 min-w-40 px-2.5 py-2 text-left font-medium sm:w-56 sm:min-w-56">
                      物件名称
                    </th>
                    <th className="px-2.5 py-2 text-right font-medium">距離</th>
                    <th className="px-2.5 py-2 text-left font-medium">周期</th>
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
                      <td className="tabular px-2.5 py-1.5 text-right text-xs whitespace-nowrap">
                        {formatKm(c.distanceKm)}
                      </td>
                      <td className="px-2.5 py-1.5 text-xs whitespace-nowrap">
                        {c.inspectionCycle?.name ?? "—"}
                      </td>
                      {MONTHS.map((m) => {
                        const target = getInspectionTarget(
                          {
                            isActive: c.isActive,
                            contractStartDate: c.contractStartDate,
                            contractEndDate: c.contractEndDate,
                            inspectionMonths: c.inspectionMonths,
                            annualInspectionMonth: c.annualInspectionMonth,
                          },
                          { year: period.year, month: m },
                        );
                        const showRegular = target.regular && typeFilter !== "annual";
                        const showAnnual = target.annual && typeFilter !== "regular";
                        const regular = cellFor(c, m, "regular");
                        const annual = cellFor(c, m, "annual");

                        return (
                          <td
                            key={m}
                            className={cn(
                              "border-l border-line px-1 py-1.5 text-center align-top",
                              m === period.month && "bg-brand-soft/40",
                            )}
                          >
                            {!showRegular && !showAnnual && (
                              <div className="text-xs leading-4 text-muted">−</div>
                            )}
                            {/* 種別ごとに1行。記号がその行の点検を表す */}
                            {showRegular && (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs text-brand">●</span>
                                <InspectionCheck
                                  customerId={c.id}
                                  customerName={c.name}
                                  year={period.year}
                                  month={m}
                                  type="regular"
                                  isDone={regular.isDone}
                                />
                                <ReportedCheck
                                  customerId={c.id}
                                  customerName={c.name}
                                  year={period.year}
                                  month={m}
                                  type="regular"
                                  isReported={regular.isReported}
                                />
                              </div>
                            )}
                            {showAnnual && (
                              <div
                                className={cn(
                                  "flex items-center justify-center gap-1",
                                  showRegular && "mt-1",
                                )}
                              >
                                <span className="text-xs text-warn">★</span>
                                <InspectionCheck
                                  customerId={c.id}
                                  customerName={c.name}
                                  year={period.year}
                                  month={m}
                                  type="annual"
                                  isDone={annual.isDone}
                                />
                                <ReportedCheck
                                  customerId={c.id}
                                  customerName={c.name}
                                  year={period.year}
                                  month={m}
                                  type="annual"
                                  isReported={annual.isReported}
                                />
                              </div>
                            )}
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

        {/* 集計パネル */}
        <Card className="h-fit">
          <CardHeader title={`対象月：${period.month}月`} />
          <dl className="divide-y divide-line text-sm">
            <SumRow label="通常点検">{regularCount} 件</SumRow>
            <SumRow label="年次点検">{annualCount} 件</SumRow>
            <SumRow label="合計（予定）" strong>
              {monthCells.length} 件
            </SumRow>
            <SumRow label="実施済み ✓" strong>
              <span className={cn(doneCount === monthCells.length && monthCells.length > 0 && "text-ok")}>
                {doneCount} 件
              </span>
            </SumRow>
            <SumRow label="報告書提出 ✓" strong>
              <span
                className={cn(
                  reportedCount === monthCells.length && monthCells.length > 0 && "text-ok",
                )}
              >
                {reportedCount} 件
              </span>
            </SumRow>
            {unreportedCount > 0 && (
              <SumRow label="点検済・報告書まだ">
                <span className="text-warn">{unreportedCount} 件</span>
              </SumRow>
            )}
          </dl>
        </Card>
      </div>

      <FocusItems
        year={period.year}
        month={period.month}
        hasAnnualTarget={annualCount > 0}
      />

      {/* 当月リスト（モバイル主用途） */}
      <Card>
        <CardHeader
          title={`${formatYearMonth(period.year, period.month)}の点検リスト`}
          description="市町村ごとにまとめ、近いところから順に並べています。連絡先はタップで発信、住所はマップで開けます"
          action={
            <div className="no-print inline-flex rounded-md border border-line p-0.5">
              {[
                { value: "group", label: "市町村ごと" },
                { value: "flat", label: "距離順" },
              ].map((o) => {
                const params = new URLSearchParams(
                  Object.entries(sp).filter(([, v]) => v) as [string, string][],
                );
                if (o.value === "group") params.delete("view");
                else params.set("view", o.value);
                return (
                  <Link
                    key={o.value}
                    href={`/schedule?${params.toString()}`}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs",
                      listView === o.value
                        ? "bg-brand text-white"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    {o.label}
                  </Link>
                );
              })}
            </div>
          }
        />
        {monthCells.length === 0 ? (
          <EmptyState>この月の点検対象はありません。</EmptyState>
        ) : listView === "flat" ? (
          <ul className="divide-y divide-line">
            {monthCells.map((cell) => (
              <InspectionListItem
                key={`${cell.customer.id}-${cell.type}`}
                cell={cell}
                period={period}
              />
            ))}
          </ul>
        ) : (
          <div className="divide-y divide-line">
            {routeGroups.map((group) => (
              <section key={group.city}>
                <div className="flex items-baseline justify-between gap-3 bg-canvas px-4 py-2">
                  <h3 className="text-sm font-medium">{group.city}</h3>
                  <p className="tabular text-xs text-muted">
                    {group.cells.length} 件
                    {group.nearestKm != null && ` / 最短 ${formatKm(group.nearestKm)}`}
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {group.cells.map((cell) => (
                    <InspectionListItem
                      key={`${cell.customer.id}-${cell.type}`}
                      cell={cell}
                      period={period}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** 当月リストの1件。グループ表示でも距離順表示でも同じ見た目にする */
function InspectionListItem({
  cell,
  period,
}: {
  cell: InspectionCell;
  period: { year: number; month: number };
}) {
  const c = cell.customer;
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3">
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/customers/edit?id=${c.id}`}
            className="font-medium text-brand hover:underline"
          >
            {c.name}
          </Link>
          <Badge tone={cell.type === "annual" ? "warn" : "brand"}>
            {cell.type === "annual" ? "★ 年次点検" : "● 通常点検"}
          </Badge>
          <span className="tabular text-xs text-muted">
            {formatKm(c.distanceKm)}
            {c.distanceMethod === "straight" && "（直線）"}
          </span>
          {/* 現場に行く前に知りたいことは、ここに出しておく */}
          {!!c.priorContactRequired && <Badge tone="warn">事前連絡が必要</Badge>}
          {cell.type === "annual" && c.annualAvailability !== "unspecified" && (
            <Badge>{AVAILABILITY_LABEL[c.annualAvailability]}</Badge>
          )}
          {cell.type === "annual" && !!c.switchgearRequestRequired && (
            <Badge tone={cell.isSwitchgearRequested ? "ok" : "warn"}>
              中電PG開閉器操作 {cell.isSwitchgearRequested ? "申込済み" : "要申込"}
            </Badge>
          )}
        </div>

        {/* 訪問周期より長い周期の設備は、該当月だけここに出る */}
        {cell.dueFacilities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted">この訪問で点検：</span>
            {cell.dueFacilities.map((f) => (
              <Badge
                key={f.id}
                tone={f.cycle && f.cycle.intervalMonths > 1 ? "ok" : "neutral"}
              >
                {f.category?.name ?? "設備"}
                {f.cycle && f.cycle.intervalMonths > 1 && `（${f.cycle.name}）`}
              </Badge>
            ))}
          </div>
        )}

        <div className="text-xs text-muted">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-ink"
          >
            {c.address}
          </a>
        </div>

        <div className="flex flex-wrap gap-x-3 text-xs">
          {splitPhones(c.phone).map((p) => (
            <a key={p} href={telHref(p)} className="text-brand underline">
              {p}
            </a>
          ))}
          {c.contactPerson && <span className="text-muted">{c.contactPerson}</span>}
        </div>

        {!!c.priorContactRequired && c.priorContactNote && (
          <p className="text-xs text-warn">{c.priorContactNote}</p>
        )}
        {cell.type === "annual" && c.annualAvailabilityNote && (
          <p className="text-xs text-muted">{c.annualAvailabilityNote}</p>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-64">
        {/* 点検を終えても報告書の提出はあとになるので、別々に押せるようにする */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <InspectionCheck
              customerId={c.id}
              customerName={c.name}
              year={period.year}
              month={period.month}
              type={cell.type}
              isDone={cell.isDone}
              label="点検済み"
              size="md"
            />
            <span className="tabular text-center text-[11px] text-muted">
              {cell.doneDate ? formatDate(cell.doneDate) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <ReportedCheck
              customerId={c.id}
              customerName={c.name}
              year={period.year}
              month={period.month}
              type={cell.type}
              isReported={cell.isReported}
              label="報告書提出"
              size="md"
            />
            <span className="tabular text-center text-[11px] text-muted">
              {cell.reportedDate ? formatDate(cell.reportedDate) : "—"}
            </span>
          </div>
        </div>

        {/* 停電に開閉器操作の申し込みが要る物件は、出したかどうかを追う */}
        {cell.type === "annual" && !!c.switchgearRequestRequired && (
          <SwitchgearRequestCheck
            customerId={c.id}
            customerName={c.name}
            year={period.year}
            month={period.month}
            type={cell.type}
            isRequested={cell.isSwitchgearRequested}
            note={c.switchgearRequestNote}
          />
        )}

        {/* 年次点検はひとりで回せないことがあるので、応援の段取りをここに残す */}
        {cell.type === "annual" && (
          <HelperFields
            customerId={c.id}
            customerName={c.name}
            year={period.year}
            month={period.month}
            type={cell.type}
            needsHelper={cell.needsHelper}
            helperName={cell.helperName}
          />
        )}
        {/* 訪問前に思い出したいことを、その月の予定に紐づけて残す */}
        <InspectionNote
          customerId={c.id}
          customerName={c.name}
          year={period.year}
          month={period.month}
          type={cell.type}
          note={cell.record?.note ?? null}
        />
      </div>
    </li>
  );
}

function SumRow({
  label,
  children,
  strong,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("tabular", strong && "font-semibold")}>{children}</dd>
    </div>
  );
}

function TypeFilter({ current, sp }: { current: string; sp: SP }) {
  const make = (value: string) => {
    const params = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => v) as [string, string][],
    );
    if (value === "both") params.delete("type");
    else params.set("type", value);
    return `/schedule?${params.toString()}`;
  };

  const options = [
    { value: "both", label: "両方" },
    { value: "regular", label: "通常のみ" },
    { value: "annual", label: "年次のみ" },
  ];

  return (
    <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {options.map((o) => (
        <Link
          key={o.value}
          href={make(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            current === o.value ? "bg-brand text-white" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * useSearchParams はレンダリング境界を要求するため Suspense で包む。
 * 中身はブラウザ側で描画される。
 */
export default function SchedulePage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">読み込んでいます…</p>}>
      <SchedulePageInner />
    </Suspense>
  );
}
