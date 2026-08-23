"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input, Select } from "@/components/ui";
import type { ActiveFilter } from "@/lib/customer-filter";

type Option = { id: number; name: string };

export function CustomerFilters({
  facilityTypes,
  inspectionCycles,
}: {
  facilityTypes: Option[];
  inspectionCycles: Option[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    startTransition(() => router.replace(`/customers?${sp.toString()}`));
  };

  const active = (params.get("active") as ActiveFilter) ?? "active";

  return (
    <div
      className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3"
      data-pending={pending ? "" : undefined}
    >
      <div className="w-full sm:w-56">
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="q">
          検索（物件名・住所・担当者）
        </label>
        <Input
          id="q"
          type="search"
          defaultValue={params.get("q") ?? ""}
          placeholder="キーワード"
          onChange={(e) => update("q", e.target.value)}
        />
      </div>

      <div className="w-[calc(50%-0.25rem)] sm:w-40">
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="active">
          稼働状態
        </label>
        <Select
          id="active"
          value={active}
          onChange={(e) => update("active", e.target.value)}
        >
          <option value="active">稼働中のみ</option>
          <option value="inactive">解除済のみ</option>
          <option value="all">すべて</option>
        </Select>
      </div>

      <div className="w-[calc(50%-0.25rem)] sm:w-44">
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="ft">
          施設種別
        </label>
        <Select
          id="ft"
          value={params.get("ft") ?? ""}
          onChange={(e) => update("ft", e.target.value)}
        >
          <option value="">すべて</option>
          {facilityTypes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-[calc(50%-0.25rem)] sm:w-40">
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="cycle">
          点検周期
        </label>
        <Select
          id="cycle"
          value={params.get("cycle") ?? ""}
          onChange={(e) => update("cycle", e.target.value)}
        >
          <option value="">すべて</option>
          {inspectionCycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
