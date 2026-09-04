"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import { AVAILABILITY_LABEL, type ColumnId } from "@/lib/customer-columns";
import type { CustomerView } from "@/lib/store/selectors";
import {
  formatDate,
  formatKm,
  formatPoints,
  formatYen,
  splitPhones,
  summarizeFacility,
  telHref,
} from "@/lib/utils";

/** 顧客マスタ一覧の1セル。列の定義と描画をここに集める */
export function CustomerCell({
  column,
  customer,
  showTaxIncluded,
}: {
  column: ColumnId;
  customer: CustomerView;
  /** 金額を税込で出すか */
  showTaxIncluded: boolean;
}) {
  const c = customer;

  switch (column) {
    case "facilities":
      return c.facilities.length === 0 ? (
        <Badge tone="warn">設備が未登録</Badge>
      ) : (
        <>
          {c.facilities.map((f) => (
            <div key={f.id} className="whitespace-nowrap">
              {summarizeFacility(
                f.category?.name,
                f.capacity,
                f.category?.capacityUnit,
              )}
              <span className="ml-1 text-muted">
                / {f.cycle?.name ?? "—"} /{" "}
                {f.category?.calculationMethod === "excluded"
                  ? "対象外"
                  : `${formatPoints(f.result.points)}点`}
              </span>
            </div>
          ))}
        </>
      );

    case "inspectionCycle":
      return <>{c.inspectionCycle?.name ?? "—"}</>;

    case "points":
      return (
        <>
          {formatPoints(c.points)}
          {c.facilities.some((f) => f.result.isOverridden) && (
            <Badge tone="warn" className="ml-1">
              手動
            </Badge>
          )}
        </>
      );

    case "monthly":
      // 1回あたりの契約は月額そのものが無いので、何の値かを添える
      return (
        <>
          {formatYen(
            showTaxIncluded ? c.pricing.monthlyIncl : c.pricing.monthlyExcl,
          )}
          {c.contractType === "external" && (
            <div className="text-[11px] whitespace-nowrap text-muted">
              {formatYen(
                showTaxIncluded ? c.pricing.visitFeeIncl : c.pricing.visitFeeExcl,
              )}{" "}
              × {c.pricing.visitsPerYear}回
            </div>
          )}
        </>
      );
    case "annual":
      return (
        <>
          {formatYen(showTaxIncluded ? c.pricing.annualIncl : c.pricing.annualExcl)}
        </>
      );

    case "annualInspectionFee":
      // 月額に含む場合は金額が存在しないので、そうと分かるように出す
      return c.annualFeeHandling === "separate" ? (
        <>
          {formatYen(
            showTaxIncluded
              ? c.pricing.annualInspectionFeeIncl
              : c.pricing.annualInspectionFeeExcl,
          )}
        </>
      ) : (
        <span className="text-xs text-muted">月額に含む</span>
      );

    case "unitPrice":
      return <>{formatYen(c.pricing.unitPrice)}</>;

    case "distance":
      return c.distanceKm == null ? (
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
      );

    case "annualAvailability":
      return (
        <>
          {AVAILABILITY_LABEL[c.annualAvailability]}
          {c.annualAvailabilityNote && (
            <div className="text-xs text-muted">{c.annualAvailabilityNote}</div>
          )}
        </>
      );

    case "priorContact":
      return c.priorContactRequired ? (
        <>
          <Badge tone="warn">要連絡</Badge>
          {c.priorContactNote && (
            <div className="mt-0.5 text-xs text-muted">{c.priorContactNote}</div>
          )}
        </>
      ) : (
        <span className="text-xs text-muted">不要</span>
      );

    case "contactPerson":
      return <>{c.contactPerson || "—"}</>;

    case "phone": {
      const phones = splitPhones(c.phone);
      return phones.length === 0 ? (
        <>—</>
      ) : (
        <>
          {phones.map((p) => (
            <div key={p}>
              <a href={telHref(p)} className="text-brand hover:underline">
                {p}
              </a>
            </div>
          ))}
        </>
      );
    }

    case "address":
      return c.address ? (
        <Link
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
          target="_blank"
          className="text-xs hover:underline"
        >
          {c.address}
        </Link>
      ) : (
        <>—</>
      );

    case "contractStartDate":
      return <>{formatDate(c.contractStartDate)}</>;

    case "note":
      return <span className="text-xs">{c.note || "—"}</span>;
  }
}
