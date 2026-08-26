import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";

export const metadata = {
  title: "プライバシーポリシー | 電気保安管理 顧客管理ツール",
};

/**
 * プライバシーポリシー。
 * Google の OAuth 本番公開に必要なため用意している。
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-ink">
          ← ダッシュボード
        </Link>
        <h1 className="text-lg font-semibold">プライバシーポリシー</h1>
        <p className="text-xs text-muted">最終更新：2026年8月27日</p>
      </div>

      <Card>
        <CardHeader title="このアプリについて" />
        <div className="space-y-3 p-4 text-sm leading-relaxed">
          <p>
            電気保安管理 顧客管理ツール（以下「本アプリ」）は、電気管理技術者が担当する
            保安管理契約物件の情報・点検予定・請求状況を管理するための個人用ツールです。
          </p>
          <p>
            本アプリはブラウザ上だけで動作します。
            <strong>
              運営者が管理するサーバーは存在せず、利用者のデータが運営者に
              送信されることはありません。
            </strong>
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="データの保存先" />
        <div className="space-y-3 p-4 text-sm leading-relaxed">
          <p>
            利用者が入力したデータは、<strong>利用者自身の Google ドライブ</strong>に
            <code className="mx-1 font-mono text-xs">顧客管理データ.json</code>
            という1つのファイルとして保存されます。
          </p>
          <p>
            Google ドライブに接続していない場合、データは利用しているブラウザの中
            （localStorage）にのみ保存されます。いずれの場合も、データが外部へ
            送信されることはありません。
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Google アカウントへのアクセス範囲" />
        <div className="space-y-3 p-4 text-sm leading-relaxed">
          <p>本アプリが要求する権限は次の1つだけです。</p>
          <p className="rounded-md bg-canvas px-3 py-2 font-mono text-xs">
            https://www.googleapis.com/auth/drive.file
          </p>
          <p>
            この権限で本アプリが読み書きできるのは、
            <strong>本アプリ自身が作成したファイルに限られます</strong>。
            利用者のドライブにある他のファイル、フォルダ、写真、文書などを
            参照することはできません。
          </p>
          <p>
            取得したアクセストークンはブラウザのメモリ上にのみ保持し、
            端末に保存しません。ブラウザを閉じると破棄されます。
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="第三者への提供・解析ツール" />
        <div className="space-y-3 p-4 text-sm leading-relaxed">
          <p>
            本アプリは、アクセス解析ツール、広告、トラッキングの類を一切使用していません。
            利用者のデータを第三者へ提供することもありません。
          </p>
          <p>
            住所から距離を求める機能を使った場合に限り、入力された住所が
            OpenStreetMap（Nominatim）または Google Maps API に送信されます。
            この機能を使わなければ送信は発生しません。
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="データの削除" />
        <div className="space-y-3 p-4 text-sm leading-relaxed">
          <p>
            Google ドライブ上の
            <code className="mx-1 font-mono text-xs">顧客管理データ.json</code>
            を削除すれば、保存されたデータは失われます。
            アプリへの権限は Google アカウントの
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="mx-1 text-brand underline"
            >
              サードパーティ アプリとサービス
            </a>
            からいつでも取り消せます。
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="お問い合わせ" />
        <div className="p-4 text-sm leading-relaxed">
          <p>
            本アプリは個人が自身の業務のために作成・利用しているものです。
            お問い合わせは、本アプリの配布元である GitHub リポジトリの Issue
            からお願いします。
          </p>
        </div>
      </Card>
    </div>
  );
}
