/** Excel で文字化けしないよう UTF-8 BOM を付ける */
const BOM = "﻿";

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  return BOM + lines.join("\r\n");
}

/** ブラウザから CSV / JSON をダウンロードさせる */
export function downloadFile(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 直後に revoke すると Safari で落ちることがあるので少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
