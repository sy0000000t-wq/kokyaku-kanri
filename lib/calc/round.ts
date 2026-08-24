/**
 * 浮動小数の誤差で 0.48 が 0.47999... になるのを避けつつ四捨五入する。
 * Excel の ROUND と同じく、正の数の 0.5 は切り上げる。
 */
export function roundTo(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return NaN;
  const factor = 10 ** digits;
  const scaled = value * factor;
  // 12 桁で丸めてから四捨五入し、2 進表現の誤差を落とす
  const corrected = Number(scaled.toPrecision(12));
  return Math.round(corrected) / factor;
}

/**
 * 保安管理点数の保持形式。
 * 換算値算出フロー図の参考例が 0.075 点・0.132 点・計 0.555 点と
 * 小数第3位まで扱っているため、第4位を四捨五入して第3位まで保持する。
 */
export function roundPoints(value: number): number {
  return roundTo(value, 3);
}

/** 金額の表示・保持形式（円・整数） */
export function roundYen(value: number): number {
  return roundTo(value, 0);
}
