import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriveBackend } from "@/lib/store/drive-backend";
import { readMirror, writeMirror } from "@/lib/store/offline";
import { createInitialDocument } from "@/lib/store/seed";
import type { AppDocument } from "@/lib/store/document";

/**
 * 「更新のたびに入力した顧客が消える」不具合の再発防止。
 * 消えていたのは、未送信の変更を確認せずドライブの内容で置き換えていたため。
 */

// テスト用の localStorage
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}

const auth = { getToken: async () => ({ accessToken: "t", expiresAt: Date.now() + 60000 }) };

function docWith(names: string[]): AppDocument {
  const doc = createInitialDocument();
  doc.customers = names.map((name, i) => ({
    id: i + 1,
    code: `T0${i + 1}`,
    name,
    inspectionCycleId: 1,
    monthlyFee: 0,
    annualFeeHandling: "included" as const,
    annualInspectionFee: null,
    unitPriceOverride: null,
    address: "",
    lat: null, lng: null, distanceKm: null, durationMin: null,
    distanceMethod: null, distanceUpdatedAt: null,
    phone: "", email: "", contactPerson: "",
    contractStartDate: "2026-01-01", contractEndDate: null,
    annualInspectionMonth: null, annualInspectionDay: null,
    annualAvailability: "unspecified" as const, annualAvailabilityNote: "",
    priorContactRequired: 0, priorContactNote: "",
    billingCycleId: 1, paymentLagMonths: 1, isActive: 1, note: "",
    createdAt: "", updatedAt: "",
  }));
  return doc;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("window", { localStorage: globalThis.localStorage });
  vi.stubGlobal("navigator", { onLine: true });
});

describe("保存の起点となる版", () => {
  it("版が分からないまま上書きせず、控えの版も潰さない", async () => {
    // 以前は控えの版を null で潰していたため、
    // 次の読み込みで「両方が進んだ」と誤判定し、入力が消えていた
    writeMirror(docWith(["A社"]), "100", false);

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/files?q=")) {
        return new Response(JSON.stringify({ files: [{ id: "f1", version: "100" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ version: "100" }), { status: 200 });
    }));

    const backend = new DriveBackend(auth as never);
    const result = await backend.save(docWith(["A社", "B社"]), null);

    expect(result.status).toBe("conflict");
    // 起点の版は保たれ、未送信として残る（次の読み込みで正しく判定できる）
    expect(readMirror()?.revision).toBe("100");
    expect(readMirror()?.pending).toBe(true);
    expect(readMirror()?.doc.customers).toHaveLength(2);
  });

  it("版が合っていれば書き込み、控えを最新の版に更新する", async () => {
    writeMirror(docWith(["A社"]), "100", false);

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/files?q=")) {
        return new Response(JSON.stringify({ files: [{ id: "f1", version: "100" }] }), { status: 200 });
      }
      if (u.includes("fields=version")) {
        return new Response(JSON.stringify({ version: "100" }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "f1", version: "101" }), { status: 200 });
    }));

    const backend = new DriveBackend(auth as never);
    const result = await backend.save(docWith(["A社", "B社"]), "100");

    expect(result.status).toBe("saved");
    expect(readMirror()?.revision).toBe("101");
    expect(readMirror()?.pending).toBe(false);
  });
});

describe("競合したときの読み込み", () => {
  it("入力したばかりの内容を画面から消さない（手元を返す）", async () => {
    // 手元に未送信の「新規顧客」がある状態
    writeMirror(docWith(["A社", "新規で入れた会社"]), "100", true);

    const remote = docWith(["A社"]);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/files?q=")) {
        // ドライブ側は別の版に進んでいる
        return new Response(JSON.stringify({ files: [{ id: "f1", version: "200" }] }), { status: 200 });
      }
      return new Response(JSON.stringify(remote), { status: 200 });
    }));

    const backend = new DriveBackend(auth as never);
    const loaded = await backend.load();

    expect(loaded?.conflictWithLocal).toBe(true);
    // 表示されるのは手元の内容。入力した会社が残っている
    expect(loaded?.doc.customers.map((c) => c.name)).toContain("新規で入れた会社");
    // 取り込むほうを選べるよう、ドライブ側も渡ってくる
    expect(loaded?.remoteDoc?.customers.map((c) => c.name)).toEqual(["A社"]);
  });

  it("ドライブが進んでいなければ、手元の未送信分をそのまま採る", async () => {
    writeMirror(docWith(["A社", "新規で入れた会社"]), "100", true);

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/files?q=")) {
        return new Response(JSON.stringify({ files: [{ id: "f1", version: "100" }] }), { status: 200 });
      }
      return new Response(JSON.stringify(docWith(["A社"])), { status: 200 });
    }));

    const backend = new DriveBackend(auth as never);
    const loaded = await backend.load();

    expect(loaded?.conflictWithLocal).toBeUndefined();
    expect(loaded?.pendingLocalChanges).toBe(true);
    expect(loaded?.doc.customers).toHaveLength(2);
  });

  it("サインインが切れていても、控えがあれば表示して未送信を知らせる", async () => {
    writeMirror(docWith(["A社", "新規で入れた会社"]), "100", true);

    const backend = new DriveBackend({
      getToken: async () => { throw new Error("サインインできませんでした"); },
    } as never);
    const loaded = await backend.load();

    expect(loaded?.degraded).toBe("signin");
    expect(loaded?.pendingLocalChanges).toBe(true);
    expect(loaded?.doc.customers).toHaveLength(2);
  });
});

describe("空データでの上書き防止", () => {
  it("手元が空で保存先に顧客がいるときは書き込まない", async () => {
    writeMirror(createInitialDocument(), "100", false);

    const patched = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/files?q=")) {
        return new Response(JSON.stringify({ files: [{ id: "f1", version: "100" }] }), { status: 200 });
      }
      if (u.includes("fields=version")) {
        return new Response(JSON.stringify({ version: "100" }), { status: 200 });
      }
      if (u.includes("alt=media")) {
        return new Response(JSON.stringify(docWith(["A社"])), { status: 200 });
      }
      if (init?.method === "PATCH") patched();
      return new Response(JSON.stringify({ id: "f1", version: "101" }), { status: 200 });
    }));

    const backend = new DriveBackend(auth as never);
    const result = await backend.save(createInitialDocument(), "100");

    expect(result.status).toBe("conflict");
    expect(patched).not.toHaveBeenCalled();
  });
});
