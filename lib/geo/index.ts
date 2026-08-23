import type { Settings } from "@/db/schema";
import { GoogleProvider } from "./google";
import { HaversineProvider } from "./haversine";
import type { GeoProvider } from "./provider";

export * from "./provider";
export { haversineKm } from "./haversine";

const DEFAULT_USER_AGENT =
  "denki-hoan-customer-manager/0.1 (local use; contact via app owner)";

/** §10-4 .env.local の API キーを DB より優先する */
export function resolveApiKey(settings: Pick<Settings, "googleMapsApiKey">) {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || settings.googleMapsApiKey?.trim() || null;
}

/**
 * §4.3 distance_mode に従ってプロバイダを選ぶ。
 * auto: API キーがあれば道路距離、無ければ直線距離。
 */
export function resolveProvider(
  settings: Pick<Settings, "googleMapsApiKey" | "distanceMode">,
): GeoProvider {
  const apiKey = resolveApiKey(settings);
  const userAgent = process.env.NOMINATIM_USER_AGENT?.trim() || DEFAULT_USER_AGENT;

  if (settings.distanceMode === "straight") return new HaversineProvider(userAgent);
  if (settings.distanceMode === "road") {
    if (!apiKey) throw new Error("道路距離モードには Google Maps API キーが必要です");
    return new GoogleProvider(apiKey);
  }
  return apiKey ? new GoogleProvider(apiKey) : new HaversineProvider(userAgent);
}
