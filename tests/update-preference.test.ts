import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSkip,
  isSnoozed,
  shouldNotify,
  skipVersion,
  skippedVersion,
  snooze,
} from "@/lib/update-preference";

/** localStorage の代わり */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: fakeStorage() },
    configurable: true,
  });
});

describe("更新を受け取るかどうか", () => {
  it("同じ版なら知らせない", () => {
    expect(shouldNotify("V1.13", "V1.13")).toBe(false);
  });

  it("新しい版が出ていれば知らせる", () => {
    expect(shouldNotify("V1.14", "V1.13")).toBe(true);
  });

  it("「この版のまま使う」を選んだ版は、もう知らせない", () => {
    skipVersion("V1.14");
    expect(skippedVersion()).toBe("V1.14");
    expect(shouldNotify("V1.14", "V1.13")).toBe(false);

    // さらに新しい版が出たら、また知らせる
    expect(shouldNotify("V1.15", "V1.13")).toBe(true);
  });

  it("見送りをやめれば、また知らせる", () => {
    skipVersion("V1.14");
    clearSkip();
    expect(shouldNotify("V1.14", "V1.13")).toBe(true);
  });

  it("「あとで」を押すと、しばらく知らせない", () => {
    const now = Date.UTC(2026, 8, 12);
    snooze(now);

    expect(isSnoozed(now + 60_000)).toBe(true);
    expect(shouldNotify("V1.14", "V1.13", now + 60_000)).toBe(false);

    // 1日経てばまた出る
    const nextDay = now + 25 * 60 * 60 * 1000;
    expect(isSnoozed(nextDay)).toBe(false);
    expect(shouldNotify("V1.14", "V1.13", nextDay)).toBe(true);
  });
});
