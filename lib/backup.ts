import fs from "node:fs";
import path from "node:path";

export const BACKUP_RETENTION_DAYS = 30;

export function backupDirFor(dbPath: string): string {
  return path.join(path.dirname(dbPath), "backup");
}

function stamp(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * §2.3 起動時に data/backup/app-YYYYMMDD.db へバックアップする。
 * 同日分は上書きし、30日より古いものは削除する。
 */
export async function runStartupBackup(dbPath: string, now = new Date()) {
  if (!fs.existsSync(dbPath)) return;

  const dir = backupDirFor(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const dest = path.join(dir, `app-${stamp(now)}.db`);
  // WAL の内容も取り込むため、SQLite の backup API ではなく
  // チェックポイント済みのファイルコピーで足りる運用とする
  await fs.promises.copyFile(dbPath, dest);

  pruneOldBackups(dir, now);
}

export function pruneOldBackups(dir: string, now = new Date()) {
  if (!fs.existsSync(dir)) return;
  const limit = now.getTime() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const file of fs.readdirSync(dir)) {
    const m = /^app-(\d{4})(\d{2})(\d{2})\.db$/.exec(file);
    if (!m) continue;
    const taken = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    if (taken < limit) fs.rmSync(path.join(dir, file), { force: true });
  }
}

export function listBackups(dbPath: string) {
  const dir = backupDirFor(dbPath);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^app-\d{8}\.db$/.test(f))
    .sort()
    .reverse()
    .map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      return { file: f, size: stat.size, mtime: stat.mtime.toISOString() };
    });
}
