"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import { recalcDistance } from "@/lib/store/distance";
import type { AppDocument } from "@/lib/store/document";

/** 距離の一括再計算。レート制限は各プロバイダ側で守る */
export function RecalcDistancesButton() {
  const { doc, replace } = useStore();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  const run = async () => {
    setRunning(true);
    setFailures([]);

    const targets = doc.customers.filter((c) => c.isActive);
    const problems: string[] = [];
    let working: AppDocument = doc;
    let success = 0;

    for (const [i, customer] of targets.entries()) {
      setProgress(`${i + 1} / ${targets.length} 件目：${customer.name}`);
      try {
        const r = await recalcDistance(working, customer);
        if (r.ok) {
          working = r.doc;
          success++;
        } else {
          problems.push(`${customer.code} ${customer.name}: ${r.message}`);
        }
      } catch (e) {
        problems.push(`${customer.code} ${customer.name}: ${(e as Error).message}`);
      }
    }

    replace(working);
    setProgress(`${targets.length} 件中 ${success} 件の距離を更新しました`);
    setFailures(problems);
    setRunning(false);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={() => void run()} disabled={running}>
        {running ? "計算中…（1秒に1件）" : "距離を一括再計算"}
      </Button>
      {progress && <p className="text-xs text-muted">{progress}</p>}
      {failures.length > 0 && (
        <ul className="max-w-md text-right text-xs text-warn">
          {failures.slice(0, 5).map((f) => (
            <li key={f}>{f}</li>
          ))}
          {failures.length > 5 && <li>ほか {failures.length - 5} 件</li>}
        </ul>
      )}
    </div>
  );
}
