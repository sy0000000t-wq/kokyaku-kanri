import Link from "next/link";
import { ShareDiagram } from "./diagrams";
import { Caution, Section, Steps, Table, Tip, Where } from "./pieces";

export function ShareHelp() {
  return (
    <div className="space-y-4">
      <Section
        title="仲間に配る"
        description="同じ URL を渡すだけです。データはお互いに見えません"
      >
        <ShareDiagram />
        <p>
          共通なのは画面の材料だけです。データはそれぞれのドライブに入り、
          Google への接続口も各自のものなので、配布元をまったく通りません。
        </p>
        <Table
          head={["渡すもの", "中身"]}
          rows={[
            ["このサイトの URL", "ブラウザで開くだけ。インストールは不要"],
            [
              "設定手順",
              <>
                この画面の{" "}
                <Link href="/help?tab=setup" className="text-brand underline">
                  はじめの設定
                </Link>{" "}
                を見てもらう
              </>,
            ],
          ]}
        />
        <Steps
          items={[
            "相手が URL を開く",
            "自分の Google Cloud でクライアントIDを作る（10分ほど）",
            <>
              <Where key="a">設定 → データ管理</Where> の接続口に貼る
            </>,
            "ドライブに接続してサインイン。以後は自分のデータだけを扱う",
          ]}
        />
        <Caution>
          クライアントIDを作るとき、承認済みの JavaScript 生成元にこのサイトの住所を
          登録してもらってください。ここを飛ばすとサインインで弾かれます。
        </Caution>
      </Section>

      <Section title="スマホで使う" description="ホーム画面に置くとアプリのように開けます">
        <Table
          head={["端末", "やり方"]}
          rows={[
            ["iPhone・iPad", "Safari で開き、共有ボタン →「ホーム画面に追加」"],
            ["Android", "Chrome で開き、メニュー →「ホーム画面に追加」"],
          ]}
        />
        <Tip>
          圏外でも開けます。通信が戻ったときにドライブへ書き戻します。
          接続口は端末ごとの設定なので、スマホでも一度貼る必要があります。
        </Tip>
      </Section>

      <Section
        title="バージョンアップ"
        description="更新するかどうかは自分で決められます。古い版のまま使い続けても構いません"
      >
        <p>
          新しい版が出ると、画面の上にお知らせが出ます。3つから選べます。
        </p>
        <Table
          head={["選ぶもの", "どうなるか"]}
          rows={[
            ["更新する", "控えを保存してから、新しい版で開き直す"],
            ["あとで", "1日ほど黙る。次に開いたときにまた出る"],
            ["この版のまま使う", "その版についてはもう知らせない。今の版のまま使い続ける"],
          ]}
        />
        <Tip>
          「更新する」を押すと、先に
          <span className="mx-1 font-mono">顧客管理_更新前バックアップ_日付.json</span>
          が保存されます。更新後におかしくなっても、これで元に戻せます。
        </Tip>
        <Caution>
          ホーム画面から開いている端末では、ダウンロードが保存されないことがあります。
          そのときは 設定 → データ管理 の「JSON 一括エクスポート」で先に控えを取ってください。
        </Caution>
        <p>
          お知らせを閉じたあとでも、<Where>設定 → 更新履歴</Where>{" "}
          の「更新の確認」からいつでも更新できます。何が変わったかもそこで見られます。
        </p>
        <Tip>
          いま使っている版は画面のいちばん下に出ています。
          「更新したのに変わらない」ときは、まずここを見てください。
        </Tip>
      </Section>
    </div>
  );
}
