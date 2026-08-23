import { addressCandidates, isPlausibleMatch } from "./address";
import type { DistanceResult, GeocodeResult, GeoProvider, LatLng } from "./provider";

const EARTH_RADIUS_KM = 6371;

/** Haversine 公式（地球半径 6371km、小数第1位） */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const km = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(km * 10) / 10;
}

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

// Nominatim は 1 リクエスト/秒。プロセス内で直列化して守る
let lastRequestAt = 0;
async function throttle() {
  const wait = 1000 - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/** §4.3 直線距離モード */
export class HaversineProvider implements GeoProvider {
  readonly method = "straight" as const;

  constructor(private readonly userAgent: string) {}

  /** 番地まで引けないことが多いため、候補を粗くしながら再試行する */
  async geocode(address: string): Promise<GeocodeResult | null> {
    for (const candidate of addressCandidates(address)) {
      const hit = await this.search(candidate);
      if (hit) return hit;
    }
    return null;
  }

  private async search(query: string): Promise<GeocodeResult | null> {
    await throttle();

    const url = new URL(NOMINATIM_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "jp");

    const res = await fetch(url, {
      headers: { "User-Agent": this.userAgent, "Accept-Language": "ja" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name?: string;
    }>;
    const hit = json[0];
    if (!hit) return null;

    // 別の市町村の施設に化けていないか確かめる
    if (hit.display_name && !isPlausibleMatch(query, hit.display_name)) return null;

    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      formattedAddress: hit.display_name,
    };
  }

  async distance(origin: LatLng, destination: LatLng): Promise<DistanceResult> {
    return {
      distanceKm: haversineKm(origin, destination),
      durationMin: null,
      method: "straight",
    };
  }
}
