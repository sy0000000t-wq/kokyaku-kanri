"use client";

import { Badge, Card, CardHeader } from "@/components/ui";
import { CHANGELOG } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";

/** 何がいつ変わったかを、使う人の言葉で並べる */
export function ChangelogView() {
  return (
    <Card>
      <CardHeader
        title="更新履歴"
        description={`いまお使いの版は ${APP_VERSION} です。画面上部にお知らせが出たら「更新する」を押してください`}
      />
      <ol className="divide-y divide-line">
        {CHANGELOG.map((entry) => (
          <li key={entry.version} className="px-4 py-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{entry.version}</span>
              {entry.version === APP_VERSION && <Badge tone="brand">使用中</Badge>}
              <span className="tabular text-xs text-muted">{entry.date}</span>
            </div>
            <ul className="space-y-0.5">
              {entry.changes.map((change) => (
                <li key={change} className="text-sm text-ink">
                  ・{change}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Card>
  );
}
