"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { COLUMNS, DEFAULT_VISIBLE, type ColumnId } from "@/lib/customer-columns";
import { cn } from "@/lib/utils";

const GROUPS = ["設備", "料金", "点検", "連絡先", "その他"] as const;

/** 一覧に出す列を選ぶ。選択はこの端末に憶えておく */
export function ColumnPicker({
  visible,
  onChange,
}: {
  visible: ColumnId[];
  onChange: (next: ColumnId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 外側 をクリックしたら閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (id: ColumnId) =>
    onChange(
      visible.includes(id) ? visible.filter((v) => v !== id) : [...visible, id],
    );

  return (
    <div className="relative" ref={boxRef}>
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        表示する列（{visible.length}）
      </Button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-line bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">表示する列</span>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_VISIBLE)}
              className="text-xs text-brand underline"
            >
              既定に戻す
            </button>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {GROUPS.map((group) => {
              const items = COLUMNS.filter((c) => c.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <p className="mb-0.5 text-[11px] text-muted">{group}</p>
                  {items.map((col) => (
                    <label
                      key={col.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-canvas",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={visible.includes(col.id)}
                        onChange={() => toggle(col.id)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
