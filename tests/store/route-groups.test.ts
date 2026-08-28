import { describe, expect, it } from "vitest";
import { groupByCity } from "@/lib/store/route-groups";
import type { InspectionCell } from "@/lib/store/monthly";

/** テストに要る部分だけ持った、点検対象1件 */
function cell(address: string, distanceKm: number | null, name = address) {
  return {
    customer: { name, address, distanceKm },
    type: "regular",
    isTarget: true,
    isDone: false,
    doneDate: null,
    record: null,
  } as unknown as InspectionCell;
}

describe("groupByCity", () => {
  it("市区町村ごとにまとめる", () => {
    const groups = groupByCity([
      cell("愛知県豊田市西町1-1", 10),
      cell("愛知県豊田市本町2-2", 12),
      cell("愛知県岡崎市中町3-3", 30),
    ]);

    expect(groups.map((g) => g.city)).toEqual(["愛知県豊田市", "愛知県岡崎市"]);
    expect(groups[0].cells).toHaveLength(2);
    expect(groups[1].cells).toHaveLength(1);
  });

  it("近い市区町村から順に並ぶ", () => {
    const groups = groupByCity([
      cell("愛知県岡崎市中町1-1", 30),
      cell("愛知県豊田市西町1-1", 10),
      cell("愛知県名古屋市中区栄1-1", 20),
    ]);

    expect(groups.map((g) => g.nearestKm)).toEqual([10, 20, 30]);
  });

  it("グループの中も距離順に並ぶ", () => {
    const groups = groupByCity([
      cell("愛知県豊田市西町1-1", 18, "遠いほう"),
      cell("愛知県豊田市本町2-2", 5, "近いほう"),
    ]);

    expect(groups[0].cells.map((c) => c.customer.name)).toEqual([
      "近いほう",
      "遠いほう",
    ]);
  });

  it("郡がある住所は郡でまとまる", () => {
    const groups = groupByCity([
      cell("愛知県愛知郡東郷町大字仮野1-1", 25),
      cell("愛知県愛知郡東郷町大字別野2-2", 26),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].city).toBe("愛知県愛知郡");
  });

  it("同名の市町村でも県が違えば分ける", () => {
    const groups = groupByCity([
      cell("愛知県豊田市西町1-1", 10),
      cell("静岡県豊田市本町1-1", 40),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("距離が未取得のものは末尾のグループになる", () => {
    const groups = groupByCity([
      cell("愛知県豊田市西町1-1", null),
      cell("愛知県岡崎市中町1-1", 30),
    ]);
    expect(groups[0].city).toBe("愛知県岡崎市");
    expect(groups[1].nearestKm).toBeNull();
  });

  it("住所から市区町村を取り出せないものはまとめて末尾へ", () => {
    const groups = groupByCity([cell("", null, "住所なし")]);
    expect(groups[0].city).toBe("（住所未設定）");
  });
});
