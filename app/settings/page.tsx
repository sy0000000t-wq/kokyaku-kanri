"use client";

import { Suspense } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BasicSettings } from "@/components/settings/basic-settings";
import { CategoryEditor } from "@/components/settings/category-editor";
import { CoefficientEditor } from "@/components/settings/coefficient-editor";
import { DataManagement } from "@/components/settings/data-management";
import {
  BillingCycleEditor,
  InspectionCycleEditor,
} from "@/components/settings/master-editors";
import { useStore } from "@/lib/store/context";
import type { CategoryCycle } from "@/lib/store/document";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "basic", label: "基本設定" },
  { id: "facility", label: "設備区分" },
  { id: "cycle", label: "訪問周期" },
  { id: "billing", label: "請求サイクル" },
  { id: "coefficient", label: "換算係数" },
  { id: "data", label: "データ管理" },
] as const;

function SettingsPageInner() {
  const params = useSearchParams();
  const { doc, indexes } = useStore();

  const requested = params.get("tab");
  const tab = TABS.some((t) => t.id === requested) ? requested! : "basic";

  const rowsByTable = Object.fromEntries(indexes.coefficientRowsByTable);
  const cyclesByCategory: Record<number, CategoryCycle[]> = Object.fromEntries(
    indexes.categoryCyclesByCategory,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">設定</h1>
        <p className="text-xs text-muted">
          マスタの値はここから編集できます。アプリ側に固定値は持たせていません
        </p>
      </div>

      <nav className="no-print flex gap-0.5 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/settings?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              tab === t.id
                ? "border-brand font-medium text-brand"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "basic" && <BasicSettings settings={doc.settings} />}
      {tab === "facility" && (
        <CategoryEditor
          categories={doc.equipmentCategories}
          cyclesByCategory={cyclesByCategory}
          coefficientTables={doc.coefficientTables}
        />
      )}
      {tab === "cycle" && <InspectionCycleEditor cycles={doc.inspectionCycles} />}
      {tab === "billing" && <BillingCycleEditor cycles={doc.billingCycles} />}
      {tab === "coefficient" && (
        <CoefficientEditor
          tables={doc.coefficientTables}
          rowsByTable={rowsByTable}
        />
      )}
      {tab === "data" && <DataManagement />}
    </div>
  );
}

/**
 * useSearchParams はレンダリング境界を要求するため Suspense で包む。
 * 中身はブラウザ側で描画される。
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">読み込んでいます…</p>}>
      <SettingsPageInner />
    </Suspense>
  );
}
