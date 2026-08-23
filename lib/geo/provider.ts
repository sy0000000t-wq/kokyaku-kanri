export type LatLng = { lat: number; lng: number };

export type GeocodeResult = LatLng & { formattedAddress?: string };

export type DistanceResult = {
  distanceKm: number;
  /** 道路距離モードのみ。直線距離では null */
  durationMin: number | null;
  method: "road" | "straight";
};

/**
 * §10-3 距離算出は必ず抽象化する。
 * GoogleProvider と HaversineProvider を差し替え可能にし、
 * API キーの有無で自動選択する。
 */
export interface GeoProvider {
  readonly method: "road" | "straight";
  geocode(address: string): Promise<GeocodeResult | null>;
  distance(origin: LatLng, destination: LatLng): Promise<DistanceResult | null>;
}

export class GeoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeoError";
  }
}
