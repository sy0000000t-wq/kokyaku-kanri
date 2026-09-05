import Link from "next/link";
import { DataFlowDiagram, ScreenMapDiagram } from "./diagrams";
import { Caution, Section, Table, Tip, Where } from "./pieces";

export function Overview() {
  return (
    <div className="space-y-4">
      <Section
        title="このツールは何をするものか"
        description="電気管理技術者ひとりの仕事を、顧客・点検・請求の3本立てで回すための道具です"
      >
        <p>
          顧客の設備から<strong>保安管理点数</strong>を出し、その点数に紐づく料金と、
          年間の点検・請求の予定を1か所で管理します。
          紙や表計算に散らばっていたものを、同じ物件の情報としてつなげるのが狙いです。
        </p>
        <ScreenMapDiagram />
        <Table
          head={["画面", "ここで何をするか"]}
          rows={[
            ["ダッシュボード", "今月の点検・請求・未入金をひと目で見る"],
            ["顧客マスタ", "物件を登録する。設備・料金・連絡先・点検月・請求月"],
            ["点検スケジュール", "点検を実施したか、報告書を出したかを記録する"],
            ["請求・入金", "請求を立てたか、入金があったかを記録する"],
            ["設定", "マスタの値、Google への接続、バックアップ、更新履歴"],
          ]}
        />
      </Section>

      <Section
        title="データはどこにあるか"
        description="このツールにはサーバーがありません。データは自分の Google ドライブに入ります"
      >
        <DataFlowDiagram />
        <p>
          データの本体は、自分のドライブにある{" "}
          <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs">
            顧客管理データ.json
          </code>{" "}
          ひとつだけです。パソコンでもスマホでも同じファイルを読み書きするので、
          どちらで直しても両方に反映されます。
        </p>
        <Tip>
          パソコンが壊れても、別の端末でサインインすれば続きから使えます。
          データはドライブに残っているためです。
        </Tip>
        <Caution>
          ドライブは「いまの状態」しか持ちません。間違えて消したものも、そのまま同期されます。
          巻き戻したいときのために{" "}
          <Link href="/help?tab=backup" className="underline">
            バックアップ
          </Link>
          を取っておいてください。
        </Caution>
        <p className="text-xs text-muted">
          圏外でも開けます。通信が戻ったときにドライブへ書き戻します。
        </p>
      </Section>

      <Section title="はじめてのときにやること">
        <p>上から順に進めれば使える状態になります。</p>
        <Table
          head={["順番", "やること", "場所"]}
          rows={[
            [
              "1",
              <Link key="a" href="/help?tab=setup" className="text-brand underline">
                Google への接続口を作る
              </Link>,
              <Where key="b">設定 → データ管理</Where>,
            ],
            ["2", "ドライブに接続してサインインする", <Where key="c">設定 → データ管理</Where>],
            ["3", "基準住所と税率を入れる", <Where key="d">設定 → 基本設定</Where>],
            [
              "4",
              <Link key="e" href="/help?tab=customers" className="text-brand underline">
                顧客を登録する
              </Link>,
              <Where key="f">顧客マスタ → ＋ 新規登録</Where>,
            ],
          ]}
        />
      </Section>
    </div>
  );
}
