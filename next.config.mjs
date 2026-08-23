/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 はネイティブモジュールなのでバンドルせず外部化する
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
