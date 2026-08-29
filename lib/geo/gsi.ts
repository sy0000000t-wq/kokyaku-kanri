import { addressCandidates } from "./address";
import type { DistanceResult, GeocodeResult, GeoProvider, LatLng } from "./provider";
import { haversineKm } from "./haversine";

/**
 * 国土地理院の住所検索API。
 *
 * 日本の住所を番地まで引ける。鍵も登録も不要で、ブラウザから直接呼べる（CORS許可済み）。
 * OpenStreetMap の Nominatim は日本の住所を町・大字までしか引けず、
 * 別の市町村の施設に誤爆することもあったため、日本国内はこちらを使う。
 *
 * 距離そのものは道路を辿れないので直線距離。
 * 実際の走行距離に近づけたい場合は補正係数を掛ける。
 */
const ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch";

type GsiFeature = {
  geometry: { coordinates: [number, number] };
  properties: { title: string };
};

export class GsiProvider implements GeoProvider {
  readonly method = "straight" as const;

  /**
   * @param detourFactor 直線距離に掛ける補正。1 なら補正なし
   */
  constructor(private readonly detourFactor = 1) {}

  async geocode(address: string): Promise<GeocodeResult | null> {
    // 番地まで引けるので、まず住所そのままで試す。
    // 引けないときだけ、末尾を落とした候補で粗く探す。
    for (const candidate of addressCandidates(address)) {
      const hit = await this.search(candidate);
      if (hit) return hit;
    }
    return null;
  }

  private async search(query: string): Promise<GeocodeResult | null> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as GsiFeature[];
    const hit = json?.[0];
    if (!hit?.geometry?.coordinates) return null;

    const [lng, lat] = hit.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, formattedAddress: hit.properties?.title };
  }

  async distance(origin: LatLng, destination: LatLng): Promise<DistanceResult> {
    const straight = haversineKm(origin, destination);
    return {
      distanceKm: Math.round(straight * this.detourFactor * 10) / 10,
      durationMin: null,
      method: "straight",
    };
  }
}
