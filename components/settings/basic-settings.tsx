"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { resolveApiKey, resolveProvider } from "@/lib/geo";
import { useStore } from "@/lib/store/context";
import type { DistanceMode, Settings } from "@/lib/store/document";
import { saveSettings } from "@/lib/store/mutations";

export function BasicSettings({ settings }: { settings: Settings }) {
  const { update, doc } = useStore();

  const [address, setAddress] = useState(settings.baseAddress);
  const [lat, setLat] = useState(settings.baseLat?.toString() ?? "");
  const [lng, setLng] = useState(settings.baseLng?.toString() ?? "");
  const [taxRate, setTaxRate] = useState(settings.taxRate.toString());
  const [distanceMode, setDistanceMode] = useState<DistanceMode>(settings.distanceMode);
  const [apiKey, setApiKey] = useState(settings.googleMapsApiKey ?? "");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [geoPending, startGeo] = useTransition();

  const runGeocode = () => {
    setGeoMessage(null);
    startGeo(async () => {
      if (!address.trim()) {
        setGeoMessage("住所を入力してください");
        return;
      }
      try {
        const provider = resolveProvider({
          googleMapsApiKey: apiKey || null,
          distanceMode,
        });
        const geo = await provider.geocode(address);
        if (!geo) {
          setGeoMessage("座標を取得できませんでした");
          return;
        }
        setLat(String(geo.lat));
        setLng(String(geo.lng));
        setGeoMessage(
          geo.formattedAddress ? `取得しました：${geo.formattedAddress}` : "取得しました",
        );
      } catch (e) {
        setGeoMessage((e as Error).message);
      }
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const rate = Number(taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      setError("消費税率は 0〜1 の小数で入力してください（例：0.10）");
      return;
    }

    update((current) =>
      saveSettings(current, {
        baseAddress: address,
        baseLat: lat === "" ? null : Number(lat),
        baseLng: lng === "" ? null : Number(lng),
        googleMapsApiKey: apiKey || null,
        taxRate: rate,
        distanceMode,
      }),
    );
    setMessage("設定を保存しました");
  };

  const usingRoad = !!resolveApiKey({ googleMapsApiKey: apiKey || null });

  return (
    <form onSubmit={save}>
      <Card>
        <CardHeader
          title="基本設定"
          description="距離算出の起点と税率、距離モードを設定します"
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="基準住所（自宅／事務所）" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="愛知県…"
              />
              <Button
                type="button"
                variant="outline"
                onClick={runGeocode}
                disabled={geoPending}
              >
                {geoPending ? "取得中…" : "座標を取得"}
              </Button>
            </div>
            {geoMessage && <p className="mt-1 text-xs text-muted">{geoMessage}</p>}
          </Field>

          <Field label="緯度">
            <Input
              type="number"
              step="0.0000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </Field>
          <Field label="経度">
            <Input
              type="number"
              step="0.0000001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </Field>

          <Field label="消費税率" hint="小数で入力します（10% なら 0.10）">
            <Input
              type="number"
              step="0.001"
              min="0"
              max="1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </Field>

          <Field
            label="距離算出モード"
            hint="自動：APIキーがあれば道路距離、無ければ直線距離"
          >
            <Select
              value={distanceMode}
              onChange={(e) => setDistanceMode(e.target.value as DistanceMode)}
            >
              <option value="auto">自動</option>
              <option value="road">道路距離</option>
              <option value="straight">直線距離</option>
            </Select>
          </Field>

          <Field
            label="Google Maps API キー"
            className="sm:col-span-2"
            hint="ブラウザから直接呼ぶため、キーは端末から見える状態になります。Google 側でリファラ制限をかけてください"
          >
            <Input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
          <Button type="submit">保存する</Button>
          {message && (
            <p className="text-xs text-ok" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs text-muted">
            現在の距離算出：
            {usingRoad
              ? distanceMode === "straight"
                ? "直線距離（設定で固定）"
                : "道路距離（Google API）"
              : distanceMode === "road"
                ? "道路距離を選択中ですが API キーがありません"
                : "直線距離（OpenStreetMap Nominatim）"}
            {doc.settings.baseLat == null && " / 基準住所の座標が未取得です"}
          </p>
        </div>
      </Card>
    </form>
  );
}
