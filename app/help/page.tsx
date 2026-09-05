"use client";

import { Suspense } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BackupHelp } from "@/components/help/backup";
import { BillingHelp } from "@/components/help/billing";
import { CustomersHelp } from "@/components/help/customers";
import { Overview } from "@/components/help/overview";
import { ScheduleHelp } from "@/components/help/schedule";
import { Setup } from "@/components/help/setup";
import { ShareHelp } from "@/components/help/share";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "はじめに" },
  { id: "setup", label: "はじめの設定" },
  { id: "customers", label: "顧客マスタ" },
  { id: "schedule", label: "点検スケジュール" },
  { id: "billing", label: "請求・入金" },
  { id: "backup", label: "バックアップ" },
  { id: "share", label: "配る・更新する" },
] as const;

function HelpPageInner() {
  const params = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.id === requested) ? requested! : "overview";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">使い方</h1>
        <p className="text-xs text-muted">
          設定の手順から日々の運用まで、このツールの中だけで分かるようにしています（{APP_VERSION}）
        </p>
      </div>

      <nav className="no-print flex gap-0.5 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/help?tab=${t.id}`}
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

      {tab === "overview" && <Overview />}
      {tab === "setup" && <Setup />}
      {tab === "customers" && <CustomersHelp />}
      {tab === "schedule" && <ScheduleHelp />}
      {tab === "billing" && <BillingHelp />}
      {tab === "backup" && <BackupHelp />}
      {tab === "share" && <ShareHelp />}
    </div>
  );
}

/** useSearchParams は境界を要求するため Suspense で包む */
export default function HelpPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted">読み込んでいます…</p>}>
      <HelpPageInner />
    </Suspense>
  );
}
