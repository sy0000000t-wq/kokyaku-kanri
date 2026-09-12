"use client";

import { useEffect, useState } from "react";
import { Caution, Section, Steps, Table, Tip, Where } from "./pieces";

const REPO = "https://github.com/sy0000000t-wq/kokyaku-kanri";

/**
 * 自分用のコピーを作って、自分で運用するための手引き。
 * 「フォーク」のような言葉は使わず、何が起きるかを普通の言葉で書く。
 */
export function OwnCopyHelp() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="space-y-4">
      <Section
        title="自分用のコピーとは"
        description="配られたものをそのまま使うか、自分の手元に写して自分で育てるか"
      >
        <p>
          いま開いているこのアプリは、配った人の置き場にある1つのものを、みんなで見ています。
          <strong>自分用のコピー</strong>とは、その中身をそっくり自分の置き場に写して、
          自分だけのアプリとして動かすことです。
        </p>
        <div className="rounded-md border border-line bg-canvas p-3 font-mono text-xs leading-6">
          配った人の置き場 ──→ みんなが見る（いまここ）
          <br />
          　　│ 写す
          <br />
          　　↓
          <br />
          自分の置き場 ────→ 自分だけが見る（自分用のコピー）
        </div>
        <p>
          写したあとは<strong>完全に別物</strong>です。自分がいくら直しても、
          配った人のアプリは変わりません。逆もそうです。
        </p>
        <Caution>
          写した時点で、<strong>配った人の更新は届かなくなります</strong>。
          直したいところが少しだけなら、写さずに配った人へ伝えるほうが楽です。
        </Caution>
      </Section>

      <Section title="写すと、何が変わるか">
        <Table
          head={["", "そのまま使う", "自分用のコピー"]}
          rows={[
            ["自分で中身を直す", "できない", "できる"],
            ["配った人の更新", "お知らせが届く", "届かない"],
            ["データの置き場", "自分のドライブ", "自分のドライブ（変わらない）"],
            ["開くときの住所", "配った人の住所", "自分の住所に変わる"],
            ["用意するもの", "なし", "GitHub のアカウント"],
            ["費用", "無料", "無料"],
          ]}
        />
        <Tip>
          データはどちらでも自分のドライブに入ります。写しても顧客データは消えません。
          ただし住所が変わるので、Google の設定を1か所だけ直します（あとで説明します）。
        </Tip>
      </Section>

      <Section
        title="用意するもの"
        description="GitHub という、プログラムの置き場を借ります。無料です"
      >
        <Steps
          items={[
            <>
              <a
                href="https://github.com/signup"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline"
              >
                github.com/signup
              </a>{" "}
              でアカウントを作る（メールアドレスとパスワードだけ）
            </>,
            "メールに届く確認コードを入れて、登録を終える",
          ]}
        />
        <p className="text-xs text-muted">
          お金の登録は要りません。公開の置き場は無料で使えます。
        </p>
      </Section>

      <Section title="1. 中身を自分の置き場に写す">
        <Steps
          items={[
            <>
              <a href={REPO} target="_blank" rel="noreferrer" className="text-brand underline">
                {REPO}
              </a>{" "}
              を開く
            </>,
            <>
              右上の <Where key="a">Fork</Where> を押す（「写す」という意味のボタンです）
            </>,
            "次の画面でそのまま「Create fork」を押す",
            "少し待つと、自分の名前が付いた同じものができます",
          ]}
        />
        <Tip>
          <Where>Fork</Where> は英語のままですが、やっていることは「コピーを作る」だけです。
          元の置き場には何も起きません。
        </Tip>
      </Section>

      <Section title="2. 自分のアプリとして公開する">
        <Steps
          items={[
            "写してできた自分の置き場を開く",
            <>
              上の <Where key="b">Settings</Where>（設定）を押す
            </>,
            <>
              左の一覧から <Where key="c">Pages</Where> を選ぶ
            </>,
            <>
              Source（どこから作るか）を <Where key="d">GitHub Actions</Where> にする
            </>,
            <>
              上の <Where key="e">Actions</Where> を押し、
              「I understand my workflows, go ahead and enable them」を押して有効にする
            </>,
            <>
              左の一覧から「デプロイ」を選び、<Where key="f">Run workflow</Where> を押す
            </>,
            "5分ほど待つと、自分のアプリが公開されます",
          ]}
        />
        <p>
          公開されると、住所は次の形になります（
          <span className="font-mono">自分の名前</span> の部分が入れ替わります）。
        </p>
        <div className="rounded-md bg-canvas px-3 py-2 font-mono text-xs break-all">
          https://自分の名前.github.io/kokyaku-kanri/
        </div>
      </Section>

      <Section
        title="3. Google の設定を直す"
        description="住所が変わるので、ここだけ入れ替えが要ります"
      >
        <p>
          サインインに使う接続口には「どの住所から使うか」が登録されています。
          新しい住所を足さないと、サインインで弾かれます。
        </p>
        <Steps
          items={[
            <>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline"
              >
                Google Cloud の「認証情報」
              </a>{" "}
              を開く
            </>,
            "使っているクライアントIDを選ぶ",
            <>
              <strong>承認済みの JavaScript 生成元</strong>に、自分の住所を足す
              <div className="mt-1.5 rounded-md bg-canvas px-3 py-2 font-mono text-xs break-all">
                https://自分の名前.github.io
              </div>
              <span className="text-xs text-muted">
                末尾のスラッシュや、その先は付けません
              </span>
            </>,
            "保存する（反映に数分かかることがあります）",
            <>
              自分の住所でアプリを開き、<Where key="g">設定 → データ管理</Where>{" "}
              の接続口に同じクライアントIDを貼る
            </>,
          ]}
        />
        <Caution>
          元の住所（{origin || "配った人の住所"}）の登録は消さないでください。
          消すと、そちらで開いている端末がサインインできなくなります。
        </Caution>
      </Section>

      <Section title="4. 中身を直す" description="直し方は人それぞれですが、道具は同じです">
        <p>
          自分の置き場の中身を手元のパソコンに落とし、直して、置き場に戻す、という流れです。
          Claude Code のような道具を使うなら、落としたフォルダを開いて「ここをこう直して」と
          頼めば進みます。
        </p>
        <Table
          head={["段階", "やること"]}
          rows={[
            ["落とす", "自分の置き場の緑の Code ボタン → Download ZIP、または git clone"],
            ["直す", "手元で中身を書き換える"],
            ["確かめる", "npm install のあと npm run dev で、手元の画面で動かす"],
            ["戻す", "git で自分の置き場に送る（送ると自動で公開し直されます）"],
          ]}
        />
        <Caution>
          直す前に、必ず 設定 → データ管理 → JSON 一括エクスポート で控えを取ってください。
          データの形に関わる直しを入れると、いまのデータが読めなくなることがあります。
        </Caution>
        <Tip>
          何がどこにあるかは、置き場の中の <span className="font-mono">README.md</span>{" "}
          に書いてあります。まずそれを読むよう頼むと話が早いです。
        </Tip>
      </Section>

      <Section title="やっぱり元に戻したくなったら">
        <p>
          配った人のアプリの住所をもう一度開くだけです。データはドライブにあるので、
          そのまま続きから使えます。自分用のコピーは消しても残しても構いません。
        </p>
        <Table
          head={["やりたいこと", "やること"]}
          rows={[
            ["配った人のアプリに戻る", "元の住所を開き、接続口を貼るだけ"],
            ["自分用のコピーを消す", "自分の置き場の Settings → 下の Delete this repository"],
            ["両方を使い分ける", "住所が違うだけなので、両方をブックマークしておけます"],
          ]}
        />
      </Section>
    </div>
  );
}
