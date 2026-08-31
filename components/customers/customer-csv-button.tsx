"use client";

import { buttonClass } from "@/components/ui";
import { downloadFile, toCsv } from "@/lib/csv";
import type { CustomerView } from "@/lib/store/selectors";
import { summarizeFacility, todayIso } from "@/lib/utils";

/** 顧客マスタの CSV エクスポート（一覧の絞り込みをそのまま出す） */
export function CustomerCsvButton({ rows }: { rows: CustomerView[] }) {
  const download = () => {
    const csv = toCsv(
      [
        "顧客ID",
        "物件名称",
        "設備",
        "保安管理点数",
        "入力した金額",
        "月額(税抜)",
        "月額(税込)",
        "年次点検費の扱い",
        "年次点検費(税抜)",
        "年額(税抜)",
        "年額(税込)",
        "点数単価",
        "住所",
        "距離(km)",
        "距離種別",
        "担当者",
        "連絡先",
        "メール",
        "契約開始日",
        "解除日",
        "訪問周期",
        "通常点検月",
        "年次点検月",
        "請求サイクル",
        "入金までの月数",
        "状態",
        "備考",
      ],
      rows.map((c) => [
        c.code,
        c.name,
        c.facilities
          .map((f) =>
            [
              summarizeFacility(f.category?.name, f.capacity, f.category?.capacityUnit),
              f.cycle?.name ?? "",
              f.result.points ?? "",
            ].join(" / "),
          )
          .join("\n"),
        c.points ?? "",
        c.feeTaxMode === "included" ? "税込" : "税抜",
        c.pricing.monthlyExcl,
        c.pricing.monthlyIncl,
        c.annualFeeHandling === "separate" ? "別途請求" : "月額に含む",
        c.annualInspectionFee ?? "",
        c.pricing.annualExcl,
        c.pricing.annualIncl,
        c.pricing.unitPrice ?? "",
        c.address,
        c.distanceKm ?? "",
        c.distanceMethod === "road" ? "道路" : c.distanceMethod === "straight" ? "直線" : "",
        c.contactPerson,
        c.phone,
        c.email,
        c.contractStartDate,
        c.contractEndDate ?? "",
        c.inspectionCycle?.name ?? "",
        c.inspectionMonths.join(" "),
        c.annualInspectionMonth ?? "",
        c.billingCycle?.name ?? "",
        c.paymentLagMonths,
        c.isActive ? "稼働中" : "解除",
        c.note,
      ]),
    );

    downloadFile(`顧客マスタ_${todayIso()}.csv`, csv, "text/csv");
  };

  return (
    <button type="button" onClick={download} className={buttonClass("outline", "sm")}>
      CSV エクスポート
    </button>
  );
}
