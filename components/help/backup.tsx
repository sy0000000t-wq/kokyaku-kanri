import { Caution, Section, Steps, Table, Tip, Where } from "./pieces";

export function BackupHelp() {
  return (
    <div className="space-y-4">
      <Section
        title="何がどこまで守られるか"
        description="ドライブとバックアップは、守る相手が違います"
      >
        <Table
          head={["起きたこと", "助けてくれるもの"]}
          rows={[
            ["パソコンが壊れた・失くした", "ドライブ（何もしなくても大丈夫）"],
            ["顧客を間違って削除した", "JSON バックアップ"],
            ["一括変更をミスした", "JSON バックアップ"],
            ["ドライブのファイルを消した・壊した", "JSON バックアップ"],
          ]}
        />
        <Caution>
          ドライブは「いまの状態」しか持ちません。間違いもそのまま同期されます。
          巻き戻せるのはバックアップだけです。
        </Caution>
      </Section>

      <Section title="バックアップを取る" description="設定 → データ管理 → JSON 一括エクスポート">
        <p>アプリが持っているデータまるごと1ファイルです。</p>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          <li>顧客・設備・点検の実施月・請求月</li>
          <li>点検実績（実施／報告書提出／開閉器操作申込／応援）</li>
          <li>請求実績（請求済・入金済・金額・日付）</li>
          <li>重点実施項目</li>
          <li>マスタ一式（設備区分・換算係数表・訪問周期・請求サイクル）</li>
          <li>基準住所や税率などの設定</li>
        </ul>
        <Caution>
          落としたファイルは<strong>その端末のダウンロードフォルダ</strong>に入ります。
          そこに置いたままだと、端末が壊れたとき一緒に失われます。
          ドライブなど別の場所に移してください。
        </Caution>
        <Tip>
          ファイル名に日付が入るので、重ねて置いても上書きされません。
          大きな作業の前と、月1回くらい取っておけば十分です。
        </Tip>
      </Section>

      <Section title="戻す" description="設定 → データ管理 → JSON インポート">
        <Steps
          items={[
            "念のため、いまの状態も JSON 一括エクスポートで取っておく",
            "「JSON インポート」でバックアップファイルを選ぶ",
            "現在のデータがすべて置き換わります",
          ]}
        />
        <Caution>
          インポートは<strong>すべて置き換え</strong>です。一部だけ戻すことはできません。
        </Caution>
      </Section>

      <Section title="CSV で書き出す">
        <Table
          head={["書き出すもの", "場所"]}
          rows={[
            ["顧客マスタ（表示している行）", <Where key="a">顧客マスタ → CSV エクスポート</Where>],
            ["顧客マスタ・点検実績・請求実績", <Where key="b">設定 → データ管理</Where>],
          ]}
        />
        <p className="text-xs text-muted">
          CSV は表計算で見るためのものです。戻すのには使えないので、
          復元用には JSON を取ってください。
        </p>
      </Section>

      <Section title="契約を解除するとき">
        <Table
          head={["やり方", "どうなるか"]}
          rows={[
            [
              "稼働トグルを OFF（解除日を入れる）",
              "解除日以降のスケジュール・請求から外れる。実績はすべて残る",
            ],
            [
              "顧客編集の「削除」",
              "顧客と関連実績を削除。削除前に控えを自動で書き出す",
            ],
          ]}
        />
        <Tip>
          解除で足ります。削除は本当に要らないときだけにしてください。
          解除済みの物件は、稼働状態を「すべて」にすれば見えます。
        </Tip>
      </Section>
    </div>
  );
}
