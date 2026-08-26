/** @type {import('next').NextConfig} */

// GitHub Pages のプロジェクトサイトはサブパス配下に置かれる。
// ローカル開発では素のパスで動かしたいので、ビルド時だけ付ける。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  // サーバーを持たない静的サイトとして書き出す
  output: "export",
  basePath,
  // GitHub Pages は末尾スラッシュのディレクトリ構成のほうが素直に動く
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
