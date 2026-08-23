"use server";

import { revalidatePath } from "next/cache";
import { DB_PATH } from "@/db";
import { importAll } from "@/lib/data-transfer";
import { listBackups } from "@/lib/backup";

export type ImportState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/** §2.3 JSON 一括インポート（既存データを全置換する） */
export async function importJson(
  _prev: ImportState,
  fd: FormData,
): Promise<ImportState> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "JSON ファイルを選択してください" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { status: "error", message: "JSON として読み取れませんでした" };
  }

  const result = importAll(parsed);
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath("/schedule");
  revalidatePath("/billing");
  revalidatePath("/settings");
  return { status: "ok", message: result.message };
}

export async function getBackupList() {
  return listBackups(DB_PATH);
}
