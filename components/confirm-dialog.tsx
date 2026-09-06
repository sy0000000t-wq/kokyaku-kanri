"use client";

import { useEffect, useRef } from "react";
import { buttonClass } from "@/components/ui";

/**
 * 取り返しのつかない操作の前に、必ず一度止めるための確認。
 *
 * 何が起きるかを具体的に書き、既定の選択は「いいえ」にする。
 * Esc と背景クリックでも閉じられる。
 */
export function ConfirmDialog({
  open,
  title,
  danger,
  detail,
  confirmLabel,
  cancelLabel = "いいえ（やめる）",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** これを押すと何が失われるか。いちばん目立たせる */
  danger: string;
  detail?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 押し間違いを防ぐため、開いた直後は「いいえ」に合わせる
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-lg border border-line bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">{title}</h2>

          <p className="rounded-md border-l-2 border-danger bg-danger-soft px-3 py-2 text-xs text-danger">
            {danger}
          </p>

          {detail && <div className="text-xs leading-relaxed text-muted">{detail}</div>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          <button
            ref={cancelRef}
            type="button"
            className={buttonClass("outline", "sm")}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={buttonClass("danger", "sm")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
