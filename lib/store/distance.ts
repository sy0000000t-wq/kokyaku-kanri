import { fallbackProvider, resolveProvider } from "@/lib/geo";
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
  /** 保存済みの座標を捨てて、住所から引き直す */
  regeocode = false,
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

  let lat = regeocode ? null : customer.lat;
  let lng = regeocode ? null : customer.lng;
  if (lat == null || lng == null) {
    // まず国土地理院。引けなければ OpenStreetMap で拾い直す
    let geo = await provider.geocode(customer.address);
    if (!geo) {
      try {
        geo = await fallbackProvider().geocode(customer.address);
      } catch {
        geo = null;
      }
    }
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
