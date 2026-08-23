/**
 * OpenStreetMap Nominatim は日本の番地・小字まで収録していないことが多い。
 * 全体 → 番地を落とす → 町/村まで → 市/区/郡まで、の順に候補を作って再試行する。
 */
export function addressCandidates(address: string): string[] {
  const base = address.trim().replace(/\s+/g, " ");
  if (!base) return [];

  const candidates = [base];
  const push = (value: string) => {
    const v = value.trim();
    if (v && v.length >= 4 && !candidates.includes(v)) candidates.push(v);
  };

  // 末尾の番地・号（数字と区切り記号の並び）を落とす
  push(base.replace(/[0-9０-９][0-9０-９\-‐−ー－の丁目番地号ノ]*$/u, ""));

  // 「…町」「…村」までで切る（小字より下を捨てる）
  const townMatch = /^(.*[町村])/u.exec(base);
  if (townMatch) push(townMatch[1]);

  // 「…市」「…区」「…郡」までで切る
  const cityMatch = /^(.*[市区郡])/u.exec(base);
  if (cityMatch) push(cityMatch[1]);

  return candidates;
}

export type AddressTokens = {
  prefecture: string | null;
  /** 市・区・郡 */
  city: string | null;
};

/** 住所から都道府県と市区郡を取り出す */
export function extractAddressTokens(address: string): AddressTokens {
  const prefecture = /(.{2,3}?[都道府県])/u.exec(address)?.[1] ?? null;
  const rest = prefecture ? address.slice(address.indexOf(prefecture) + prefecture.length) : address;
  const city = /^(.{1,8}?[市区郡])/u.exec(rest)?.[1] ?? null;
  return { prefecture, city };
}

/**
 * Nominatim は自由文検索であいまい一致するため、
 * まったく別の市の施設が返ることがある（例：豊田市の住所 → 豊橋市の保育園）。
 * 都道府県と市区郡が一致しない結果は採用しない。
 */
export function isPlausibleMatch(query: string, displayName: string): boolean {
  const { prefecture, city } = extractAddressTokens(query);
  if (prefecture && !displayName.includes(prefecture)) return false;
  if (city && !displayName.includes(city)) return false;
  return true;
}
