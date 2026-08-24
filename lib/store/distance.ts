import { resolveProvider } from "@/lib/geo";
import type { AppDocument, Customer } from "./document";
import { updateDistance } from "./mutations";

export type DistanceOutcome =
  | { ok: true; doc: AppDocument; distanceKm: number; method: "road" | "straight" }
  | { ok: false; message: string };

/**
 * 顧客1件の距離を算出して文書に反映する。
 * 住所→座標はキャッシュがあれば使い、無いときだけ問い合わせる。
 */
export async function recalcDistance(
  doc: AppDocument,
  customer: Customer,
): Promise<DistanceOutcome> {
  const { settings } = doc;
  if (!settings.baseAddress || settings.baseLat == null || settings.baseLng == null) {
    return { ok: false, message: "設定画面で基準住所の座標を取得してください" };
  }

  let provider;
  try {
    provider = resolveProvider(settings);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  let lat = customer.lat;
  let lng = customer.lng;
  if (lat == null || lng == null) {
    const geo = await provider.geocode(customer.address);
    if (!geo) {
      return {
        ok: false,
        message: "住所から座標を取得できませんでした。緯度経度を手入力してください",
      };
    }
    lat = geo.lat;
    lng = geo.lng;
  }

  const result = await provider.distance(
    { lat: settings.baseLat, lng: settings.baseLng },
    { lat, lng },
  );
  if (!result) return { ok: false, message: "距離を取得できませんでした" };

  return {
    ok: true,
    distanceKm: result.distanceKm,
    method: result.method,
    doc: updateDistance(doc, {
      id: customer.id,
      lat,
      lng,
      distanceKm: result.distanceKm,
      durationMin: result.durationMin,
      method: result.method,
    }),
  };
}
