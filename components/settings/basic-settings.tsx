"use client";

import { useActionState, useState, useTransition } from "react";
import {
  geocodeBaseAddress,
  saveBasicSettings,
  type SettingsState,
} from "@/app/actions/settings";
import { Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import type { Settings } from "@/db/schema";

const initial: SettingsState = { status: "idle" };

export function BasicSettings({
  settings,
  hasEnvApiKey,
}: {
  settings: Settings;
  hasEnvApiKey: boolean;
}) {
  const [state, action, pending] = useActionState(saveBasicSettings, initial);
  const [address, setAddress] = useState(settings.baseAddress);
  const [lat, setLat] = useState(settings.baseLat?.toString() ?? "");
  const [lng, setLng] = useState(settings.baseLng?.toString() ?? "");
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [geoPending, startGeo] = useTransition();

  const runGeocode = () => {
    setGeoMessage(null);
    startGeo(async () => {
      const r = await geocodeBaseAddress(address);
      if (r.ok) {
        setLat(String(r.lat));
        setLng(String(r.lng));
        setGeoMessage(r.formatted ? `取得しました：${r.formatted}` : "取得しました");
      } else {
        setGeoMessage(r.message);
      }
    });
  };

  return (
    <form action={action}>
      <Card>
        <CardHeader title="基本設定" description="距離算出の起点と税率、距離モードを設定します" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="基準住所（自宅／事務所）" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                name="baseAddress"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="愛知県…"
              />
              <Button type="button" variant="outline" onClick={runGeocode} disabled={geoPending}>
                {geoPending ? "取得中…" : "座標を取得"}
              </Button>
            </div>
            {geoMessage && <p className="mt-1 text-xs text-muted">{geoMessage}</p>}
          </Field>

          <Field label="緯度">
            <Input
              name="baseLat"
              type="number"
              step="0.0000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </Field>
          <Field label="経度">
            <Input
              name="baseLng"
              type="number"
              step="0.0000001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </Field>

          <Field label="消費税率" hint="小数で入力します（10% なら 0.10）">
            <Input
              name="taxRate"
              type="number"
              step="0.001"
              min="0"
              max="1"
              defaultValue={settings.taxRate}
            />
          </Field>

          <Field label="距離算出モード" hint="自動：API キーがあれば道路距離、無ければ直線距離">
            <Select name="distanceMode" defaultValue={settings.distanceMode}>
              <option value="auto">自動</option>
              <option value="road">道路距離</option>
              <option value="straight">直線距離</option>
            </Select>
          </Field>

          <Field
            label="Google Maps API キー"
            className="sm:col-span-2"
            hint={
              hasEnvApiKey
                ? ".env.local の GOOGLE_MAPS_API_KEY が設定されているため、そちらが優先されます"
                : "DB には平文で保存されます。可能なら .env.local の GOOGLE_MAPS_API_KEY を使ってください"
            }
          >
            <Input
              name="googleMapsApiKey"
              type="password"
              autoComplete="off"
              defaultValue={settings.googleMapsApiKey ?? ""}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Button type="submit" disabled={pending}>
            {pending ? "保存中…" : "保存する"}
          </Button>
          {state.status !== "idle" && (
            <p
              className={
                state.status === "ok" ? "text-xs text-ok" : "text-xs text-danger"
              }
              role="status"
            >
              {state.message}
            </p>
          )}
        </div>
      </Card>
    </form>
  );
}
