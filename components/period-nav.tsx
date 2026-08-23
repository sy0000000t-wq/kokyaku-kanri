"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button, Select } from "@/components/ui";
import { MONTHS } from "@/lib/utils";

/** 前月／翌月ボタンと年月ピッカー（§5.2） */
export function PeriodNav({
  base,
  year,
  month,
  showMonth = true,
}: {
  base: string;
  year: number;
  month?: number;
  showMonth?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (y: number, m?: number) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("y", String(y));
    if (m != null) sp.set("m", String(m));
    router.push(`${base}?${sp.toString()}`);
  };

  const shift = (delta: number) => {
    if (month == null) return go(year + delta);
    const total = year * 12 + (month - 1) + delta;
    go(Math.floor(total / 12), (total % 12) + 1);
  };

  const years = Array.from({ length: 11 }, (_, i) => year - 5 + i);

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label="前へ">
        ←
      </Button>
      <Select
        className="h-8 w-24 text-xs"
        value={year}
        onChange={(e) => go(Number(e.target.value), month)}
        aria-label="年"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </Select>
      {showMonth && month != null && (
        <Select
          className="h-8 w-20 text-xs"
          value={month}
          onChange={(e) => go(year, Number(e.target.value))}
          aria-label="月"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </Select>
      )}
      <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label="次へ">
        →
      </Button>
    </div>
  );
}
