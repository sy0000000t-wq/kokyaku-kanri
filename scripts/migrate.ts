import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { seedMasters } from "../db/seed";
import { openDb } from "./db-connect";

const { sqlite, db, dbPath } = openDb();

console.log(`DB: ${dbPath}`);
migrate(db, { migrationsFolder: path.join(process.cwd(), "db/migrations") });
console.log("スキーマを最新化しました");

const log = seedMasters(db);
if (log.length === 0) {
  console.log("マスタは投入済みです（変更なし）");
} else {
  for (const line of log) console.log(`  - ${line}`);
}

sqlite.close();
console.log("完了");
