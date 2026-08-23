import { describe, expect, it } from "vitest";
import {
  addressCandidates,
  extractAddressTokens,
  isPlausibleMatch,
} from "@/lib/geo/address";
import { haversineKm } from "@/lib/geo/haversine";

describe("addressCandidates", () => {
  it("番地を落とした候補と町までの候補を作る", () => {
    const c = addressCandidates("愛知県豊田市仮町仮田9-9");
    expect(c[0]).toBe("愛知県豊田市仮町仮田9-9");
    expect(c).toContain("愛知県豊田市仮町仮田");
    expect(c).toContain("愛知県豊田市仮町");
    expect(c).toContain("愛知県豊田市");
  });

  it("郡がある住所でも町まで切り出せる", () => {
    const c = addressCandidates("愛知県愛知郡東郷町大字仮野字仮田1-2");
    expect(c).toContain("愛知県愛知郡東郷町大字仮野字仮田");
    expect(c).toContain("愛知県愛知郡東郷町");
  });

  it("重複した候補は作らない", () => {
    const c = addressCandidates("愛知県豊田市");
    expect(new Set(c).size).toBe(c.length);
  });

  it("空文字は候補なし", () => {
    expect(addressCandidates("   ")).toEqual([]);
  });
});

describe("haversineKm", () => {
  it("同じ地点は 0km", () => {
    expect(haversineKm({ lat: 35.1, lng: 137.0 }, { lat: 35.1, lng: 137.0 })).toBe(0);
  });

  it("近隣2地点の距離（実測 約 6km 前後）", () => {
    const km = haversineKm(
      { lat: 35.107975, lng: 137.075844 },
      { lat: 35.1557, lng: 137.128985 },
    );
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(9);
  });

  it("小数第1位に丸める", () => {
    const km = haversineKm({ lat: 35.0, lng: 137.0 }, { lat: 36.0, lng: 137.0 });
    expect(km).toBe(Math.round(km * 10) / 10);
    expect(km).toBeCloseTo(111.2, 1);
  });
});

describe("isPlausibleMatch", () => {
  it("市が一致すれば採用する", () => {
    expect(
      isPlausibleMatch(
        "愛知県豊田市仮町仮田",
        "仮町, 豊田市, 愛知県, 471-8501, 日本",
      ),
    ).toBe(true);
  });

  it("別の市の施設に化けた結果は弾く", () => {
    expect(
      isPlausibleMatch(
        "愛知県豊田市仮町仮田",
        "○○園, ○○線, 別町, 豊橋市, 愛知県, 441-8122, 日本",
      ),
    ).toBe(false);
  });

  it("郡がある住所も判定できる", () => {
    expect(
      isPlausibleMatch(
        "愛知県愛知郡東郷町大字仮野",
        "大字仮野, 東郷町, 愛知郡, 愛知県, 470-0151, 日本",
      ),
    ).toBe(true);
  });

  it("都道府県が違えば弾く", () => {
    expect(isPlausibleMatch("愛知県豊田市", "豊田市, 静岡県, 日本")).toBe(false);
  });
});

describe("extractAddressTokens", () => {
  it("都道府県と市区郡を取り出す", () => {
    expect(extractAddressTokens("愛知県豊田市仮町仮田9-9")).toEqual({
      prefecture: "愛知県",
      city: "豊田市",
    });
    expect(extractAddressTokens("愛知県愛知郡東郷町大字仮野字仮田1-2")).toEqual({
      prefecture: "愛知県",
      city: "愛知郡",
    });
  });
});
