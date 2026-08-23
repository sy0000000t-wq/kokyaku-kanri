import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { runStartupBackup } from "@/lib/backup";

/** §2.3 DB ファイルは data/app.db 固定 */
export const DATA_DIR = path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "app.db");

function createConnection() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

// 開発時の HMR で接続が増え続けないよう globalThis に保持する
const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
  __backupDone?: boolean;
};

export const sqlite = globalForDb.__sqlite ?? createConnection();
if (process.env.NODE_ENV !== "production") globalForDb.__sqlite = sqlite;

if (!globalForDb.__backupDone) {
  globalForDb.__backupDone = true;
  // 起動時バックアップ。失敗してもアプリ本体は動かす
  runStartupBackup(DB_PATH).catch((e) =>
    console.error("[backup] 起動時バックアップに失敗しました:", e),
  );
}

export const db = drizzle(sqlite, { schema });
export { schema };
