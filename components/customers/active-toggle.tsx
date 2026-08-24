"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import { setCustomerActive } from "@/lib/store/mutations";
import { cn, todayIso } from "@/lib/utils";

/**
 * 行末の稼働トグル。
 * OFF にするときだけ確認ダイアログを出し、解除日を入力させる。
 */
export function ActiveToggle({
  id,
  name,
  isActive,
}: {
  id: number;
  name: string;
  isActive: boolean;
}) {
  const { update } = useStore();
  const [open, setOpen] = useState(false);
  const [endDate, setEndDate] = useState(todayIso());

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        aria-label={`${name} の稼働状態`}
        onClick={() =>
          isActive
            ? setOpen(true)
            : update((doc) => setCustomerActive(doc, { id, isActive: true }))
        }
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          isActive ? "bg-ok" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]",
            isActive ? "left-[1.125rem]" : "left-0.5",
          )}
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`deactivate-${id}`}
        >
          <div className="w-full max-w-sm rounded-lg bg-surface p-4 shadow-lg">
            <h2 id={`deactivate-${id}`} className="text-sm font-semibold">
              契約を解除しますか？
            </h2>
            <p className="mt-1.5 text-xs text-muted">
              {name} を解除日以降のスケジュール対象から外します。
              過去の実績・チェックはすべて残ります。
            </p>

            <label
              className="mt-3 mb-1 block text-xs font-medium text-muted"
              htmlFor={`end-${id}`}
            >
              解除日
            </label>
            <Input
              id={`end-${id}`}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  update((doc) =>
                    setCustomerActive(doc, {
                      id,
                      isActive: false,
                      contractEndDate: endDate,
                    }),
                  );
                  setOpen(false);
                }}
              >
                解除する
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
