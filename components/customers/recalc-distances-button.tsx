"use client";

import { useState, useTransition } from "react";
import { recalcAllDistances } from "@/app/actions/customer";
import { Button } from "@/components/ui";

/** §4.3 距離の一括再計算。実行中は進捗を出す */
export function RecalcDistancesButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  const run = () => {
    setResult(null);
    setFailures([]);
    startTransition(async () => {
      const r = await recalcAllDistances();
      setResult(`${r.total} 件中 ${r.success} 件の距離を更新しました`);
      setFailures(r.failures);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={run} disabled={pending}>
        {pending ? "計算中…（レート制限のため時間がかかります）" : "距離を一括再計算"}
      </Button>
      {result && <p className="text-xs text-muted">{result}</p>}
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
