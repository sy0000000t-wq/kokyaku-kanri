import { extractAddressTokens } from "@/lib/geo/address";
import type { InspectionCell } from "./monthly";

export type RouteGroup = {
  /** 市区町村名。取り出せなければ「（住所未設定）」 */
  city: string;
  cells: InspectionCell[];
  /** その市区町村で一番近い物件までの距離。並び順に使う */
  nearestKm: number | null;
};

const UNKNOWN = "（住所未設定）";

/**
 * 今月の点検対象を市区町村でまとめる。
 * 巡回の順番をそのままなぞれるよう、
 * グループは「一番近い物件までの距離」の順、グループ内も距離順に並べる。
 * 距離が未取得のものは末尾へ回す。
 */
export function groupByCity(cells: InspectionCell[]): RouteGroup[] {
  const byCity = new Map<string, InspectionCell[]>();

  for (const cell of cells) {
    const { prefecture, city } = extractAddressTokens(cell.customer.address);
    // 同名の市町村が県をまたぐことがあるので県名も残す
    const key = city ? `${prefecture ?? ""}${city}` : UNKNOWN;
    const list = byCity.get(key) ?? [];
    list.push(cell);
    byCity.set(key, list);
  }

  const groups: RouteGroup[] = [...byCity.entries()].map(([city, list]) => {
    const distances = list
      .map((c) => c.customer.distanceKm)
      .filter((d): d is number => d != null);

    return {
      city,
      nearestKm: distances.length > 0 ? Math.min(...distances) : null,
      cells: [...list].sort(
        (a, b) => (a.customer.distanceKm ?? 1e9) - (b.customer.distanceKm ?? 1e9),
      ),
    };
  });

  return groups.sort((a, b) => {
    // 距離が分からないグループは最後に回す
    if (a.nearestKm == null && b.nearestKm == null) {
      return a.city.localeCompare(b.city, "ja");
    }
    if (a.nearestKm == null) return 1;
    if (b.nearestKm == null) return -1;
    return a.nearestKm - b.nearestKm;
  });
}
