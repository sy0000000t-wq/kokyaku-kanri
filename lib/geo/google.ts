import type { DistanceResult, GeocodeResult, GeoProvider, LatLng } from "./provider";

/** §4.3 道路距離モード（Geocoding API + Routes API） */
export class GoogleProvider implements GeoProvider {
  readonly method = "road" as const;

  constructor(private readonly apiKey: string) {}

  async geocode(address: string): Promise<GeocodeResult | null> {
    if (!address.trim()) return null;

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("language", "ja");
    url.searchParams.set("region", "jp");

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
      }>;
    };
    const hit = json.results?.[0];
    if (json.status !== "OK" || !hit) return null;

    return {
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      formattedAddress: hit.formatted_address,
    };
  }

  async distance(
    origin: LatLng,
    destination: LatLng,
  ): Promise<DistanceResult | null> {
    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: {
            location: {
              latLng: { latitude: destination.lat, longitude: destination.lng },
            },
          },
          travelMode: "DRIVE",
          languageCode: "ja-JP",
          units: "METRIC",
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;

    const json = (await res.json()) as {
      routes?: Array<{ distanceMeters?: number; duration?: string }>;
    };
    const route = json.routes?.[0];
    if (!route?.distanceMeters) return null;

    const seconds = Number(String(route.duration ?? "0s").replace("s", ""));
    return {
      distanceKm: Math.round(route.distanceMeters / 100) / 10,
      durationMin: Number.isFinite(seconds) ? Math.round(seconds / 60) : null,
      method: "road",
    };
  }
}
