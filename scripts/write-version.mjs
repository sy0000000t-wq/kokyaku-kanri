// lib/version.ts の APP_VERSION を public/version.json に写す。
// 動いているアプリが、公開されている版と自分の版を比べるために使う。
import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/version.ts", import.meta.url), "utf8");
const match = /APP_VERSION\s*=\s*"([^"]+)"/.exec(source);
if (!match) {
  console.error("lib/version.ts から APP_VERSION を読めませんでした");
  process.exit(1);
}

writeFileSync(
  new URL("../public/version.json", import.meta.url),
  `${JSON.stringify({ version: match[1] }, null, 2)}\n`,
);
console.log(`public/version.json → ${match[1]}`);
