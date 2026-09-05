"use client";

import { useRef, useState } from "react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import { downloadFile, toCsv } from "@/lib/csv";
import { useStore } from "@/lib/store/context";
import { renameCustomerCodePrefix } from "@/lib/store/mutations";
import { parseDocument } from "@/lib/store/seed";
import { getCustomerViews } from "@/lib/store/selectors";
import { formatDateTime, summarizeFacility, todayIso } from "@/lib/utils";
import { ClientIdSetting } from "./client-id-setting";
import { DriveConnection } from "./drive-connection";

/** データ管理：書き出しと取り込み */
export function DataManagement() {
  const { doc, indexes, replace, updateWith } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefixFrom, setPrefixFrom] = useState("");
  const [prefixTo, setPrefixTo] = useState("");
  const [prefixMessage, setPrefixMessage] = useState<string | null>(null);

  // 実行前に、いくつ変わるのかを見せる
  const prefixHits = prefixFrom.trim()
    ? doc.customers.filter((c) => c.code.startsWith(prefixFrom.trim()))
    : [];

  const applyPrefix = () => {
    setPrefixMessage(null);
    const result = updateWith((d) => {
      const r = renameCustomerCodePrefix(d, prefixFrom, prefixTo);
      return { doc: r.doc, result: r.result };
    });

    if (result.renamed === 0 && result.skipped.length === 0) {
      setPrefixMessage("該当する顧客IDがありませんでした。");
      return;
    }
    const skipped = result.skipped.length
      ? `　同じ顧客IDが既にあるため、${result.skipped
          .map((s) => s.code)
          .join("、")} は変えていません。`
      : "";
    setPrefixMessage(`${result.renamed} 件の顧客IDを変えました。${skipped}`);
    setPrefixFrom("");
    setPrefixTo("");
  };

  const views = getCustomerViews(doc, indexes);
  const nameOf = (id: number) => views.find((v) => v.id === id);

  const exportJson = () =>
    downloadFile(
      `顧客管理_バックアップ_${todayIso()}.json`,
      JSON.stringify(doc, null, 2),
      "application/json",
    );

  const exportInspections = () => {
    const csv = toCsv(
      ["顧客ID", "物件名称", "年", "月", "点検種別", "実施済み", "実施日", "備考"],
      [...doc.inspectionRecords]
        .sort((a, b) => a.year - b.year || a.month - b.month || a.customerId - b.customerId)
        .map((r) => {
          const c = nameOf(r.customerId);
          return [
            c?.code ?? r.customerId,
            c?.name ?? "",
            r.year,
            r.month,
            r.type === "annual" ? "年次点検" : "通常点検",
            r.isDone ? "済" : "",
            r.doneDate ?? "",
            r.note ?? "",
          ];
        }),
    );
    downloadFile(`点検実績_${todayIso()}.csv`, csv, "text/csv");
  };

  const exportBillings = () => {
    const csv = toCsv(
      [
        "顧客ID",
        "物件名称",
        "請求年",
        "請求月",
        "請求額(税込)",
        "請求済み",
        "請求日",
        "入金予定年",
        "入金予定月",
        "入金済み",
        "入金日",
        "備考",
      ],
      [...doc.billingRecords]
        .sort((a, b) => a.year - b.year || a.month - b.month || a.customerId - b.customerId)
        .map((r) => {
          const c = nameOf(r.customerId);
          return [
            c?.code ?? r.customerId,
            c?.name ?? "",
            r.year,
            r.month,
            r.billingAmount,
            r.isBilled ? "済" : "",
            r.billedDate ?? "",
            r.expectedPaymentYear,
            r.expectedPaymentMonth,
            r.isPaid ? "済" : "",
            r.paidDate ?? "",
            r.note ?? "",
          ];
        }),
    );
    downloadFile(`請求実績_${todayIso()}.csv`, csv, "text/csv");
  };

  const exportCustomers = () => {
    const csv = toCsv(
      ["顧客ID", "物件名称", "設備", "保安管理点数", "月額(税抜)", "年額(税抜)", "点数単価", "住所", "状態"],
      views.map((c) => [
        c.code,
        c.name,
        c.facilities
          .map((f) =>
            summarizeFacility(f.category?.name, f.capacity, f.category?.capacityUnit),
          )
          .join(" / "),
        c.points ?? "",
        c.pricing.monthlyExcl,
        c.pricing.annualExcl,
        c.pricing.unitPrice ?? "",
        c.address,
        c.isActive ? "稼働中" : "解除",
      ]),
    );
    downloadFile(`顧客マスタ_${todayIso()}.csv`, csv, "text/csv");
  };

  const importJson = async (file: File) => {
    setMessage(null);
    setError(null);
    try {
      const next = parseDocument(JSON.parse(await file.text()));
      replace(next);
      setMessage(
        `顧客 ${next.customers.length} 件、点検実績 ${next.inspectionRecords.length} 件、請求実績 ${next.billingRecords.length} 件を取り込みました`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <DriveConnection />
      <ClientIdSetting />

      <Card>
        <CardHeader title="エクスポート" description="ブラウザにダウンロードされます" />
        <div className="flex flex-wrap gap-2 p-4">
          <Button size="sm" onClick={exportJson}>
            JSON 一括エクスポート
          </Button>
          <Button size="sm" variant="outline" onClick={exportCustomers}>
            顧客マスタ CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportInspections}>
            点検実績 CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportBillings}>
            請求実績 CSV
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="JSON インポート"
          description="現在のデータをすべて置き換えます。実行前に JSON エクスポートを取ってください"
        />
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="h-auto max-w-xs py-1.5"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
            }}
          />
          {message && (
            <p className="text-xs text-ok" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="顧客IDの接頭辞をまとめて変える"
          description="「Ch01 → Zch01」のように、採番の決め方を変えたときの引っ越しに使います。点検実績や請求実績は顧客IDではなく内部の紐づけで持っているので、切れません"
        />
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted">いまの接頭辞</label>
              <Input
                value={prefixFrom}
                onChange={(e) => setPrefixFrom(e.target.value)}
                placeholder="Ch"
                className="w-32"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">新しい接頭辞</label>
              <Input
                value={prefixTo}
                onChange={(e) => setPrefixTo(e.target.value)}
                placeholder="Zch"
                className="w-32"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={prefixHits.length === 0 || prefixTo.trim() === ""}
              onClick={applyPrefix}
            >
              {prefixHits.length} 件を変える
            </Button>
          </div>

          {prefixHits.length > 0 && prefixTo.trim() !== "" && (
            <p className="text-xs text-muted">
              例：{prefixHits[0].code} →{" "}
              <span className="font-medium text-ink">
                {prefixTo.trim() + prefixHits[0].code.slice(prefixFrom.trim().length)}
              </span>
              {prefixHits.length > 1 && ` ほか ${prefixHits.length - 1} 件`}
            </p>
          )}
          {prefixMessage && (
            <p className="text-xs text-ok" role="status">
              {prefixMessage}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="いまのデータ" />
        <dl className="divide-y divide-line text-sm">
          {[
            ["顧客", doc.customers.length],
            ["設備", doc.customerFacilities.length],
            ["点検実績", doc.inspectionRecords.length],
            ["請求実績", doc.billingRecords.length],
          ].map(([label, count]) => (
            <div key={label} className="flex justify-between px-4 py-2">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="tabular">{count} 件</dd>
            </div>
          ))}
          <div className="flex justify-between px-4 py-2">
            <dt className="text-xs text-muted">最終更新</dt>
            <dd className="tabular text-xs">
              {doc.savedAt ? formatDateTime(doc.savedAt) : "まだ保存されていません"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
