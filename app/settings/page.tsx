import Link from "next/link";
import { getBackupList } from "@/app/actions/data";
import { BasicSettings } from "@/components/settings/basic-settings";
import { CoefficientEditor } from "@/components/settings/coefficient-editor";
import { DataManagement } from "@/components/settings/data-management";
import {
  BillingCycleEditor,
  InspectionCycleEditor,
} from "@/components/settings/master-editors";
import { CategoryEditor } from "@/components/settings/category-editor";
import { DB_PATH } from "@/db";
import type { CategoryCycle, CoefficientRow } from "@/db/schema";
import { resolveApiKey } from "@/lib/geo";
import { getMasters } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "basic", label: "基本設定" },
  { id: "facility", label: "設備区分" },
  { id: "cycle", label: "訪問周期" },
  { id: "billing", label: "請求サイクル" },
  { id: "coefficient", label: "換算係数" },
  { id: "data", label: "データ管理" },
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "basic";

  const masters = getMasters();
  const rowsByTable: Record<number, CoefficientRow[]> = {};
  for (const [id, rows] of masters.coefficientRowsByTable) rowsByTable[id] = rows;

  const cyclesByCategory: Record<number, CategoryCycle[]> = {};
  for (const [id, cycles] of masters.categoryCyclesByCategory)
    cyclesByCategory[id] = cycles;

  const hasEnvApiKey = !!process.env.GOOGLE_MAPS_API_KEY?.trim();
  const backups = tab === "data" ? await getBackupList() : [];

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

      {tab === "basic" && (
        <BasicSettings settings={masters.settings} hasEnvApiKey={hasEnvApiKey} />
      )}
      {tab === "facility" && (
        <CategoryEditor
          categories={masters.equipmentCategories}
          cyclesByCategory={cyclesByCategory}
          coefficientTables={masters.coefficientTables}
        />
      )}
      {tab === "cycle" && <InspectionCycleEditor cycles={masters.inspectionCycles} />}
      {tab === "billing" && <BillingCycleEditor cycles={masters.billingCycles} />}
      {tab === "coefficient" && (
        <CoefficientEditor tables={masters.coefficientTables} rowsByTable={rowsByTable} />
      )}
      {tab === "data" && <DataManagement backups={backups} dbPath={DB_PATH} />}

      {tab === "basic" && (
        <p className="text-xs text-muted">
          現在の距離算出：
          {resolveApiKey(masters.settings)
            ? masters.settings.distanceMode === "straight"
              ? "直線距離（設定で固定）"
              : "道路距離（Google API）"
            : masters.settings.distanceMode === "road"
              ? "道路距離を選択中ですが API キーがありません"
              : "直線距離（OpenStreetMap Nominatim）"}
        </p>
      )}
    </div>
  );
}
