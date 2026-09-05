"use client";

import { useEffect, useState } from "react";
import { Caution, Section, Steps, Table, Tip, Where } from "./pieces";

/** Google 側の設定手順。アプリを開けばここで全部わかるようにする */
export function Setup() {
  // 登録してもらう住所は、いま開いているサイトのもの。
  // 書き出し時には分からないので、開いてから当てる
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="space-y-4">
      <Section
        title="なぜこの作業が要るのか"
        description="自分のドライブにデータを置くため、Google に「このアプリを使う」と登録します"
      >
        <p>
          このツールは配布元のサーバーを持たないので、Google への接続口
          （クライアントID）を<strong>使う人が自分で用意</strong>します。
          こうすると Google との通信は必ず自分の枠を通り、配布元には一切かかりません。
        </p>
        <p>一度やれば以後は不要です。10分ほどで終わります。</p>
        <Tip>
          このアプリが求める権限は <strong>drive.file</strong> ひとつだけです。
          <strong>このアプリが作ったファイル</strong>しか読み書きできません。
          写真も他の書類も、アプリからは見えません。
        </Tip>
      </Section>

      <Section
        title="1. プロジェクトを作る"
        description="作業する場所は Google Cloud Console（console.cloud.google.com）です"
      >
        <Steps
          items={[
            <>
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline"
              >
                console.cloud.google.com
              </a>{" "}
              を開き、自分の Google アカウントで入る
            </>,
            "画面上部のプロジェクト選択をクリック",
            "右上の「新しいプロジェクト」",
            "名前に「顧客管理ツール」と入れて「作成」",
            "上部の表示が「顧客管理ツール」になっているか確認",
          ]}
        />
      </Section>

      <Section title="2. Drive API を有効にする">
        <Steps
          items={[
            "左のメニューから「API とサービス」→「ライブラリ」",
            "検索欄に Google Drive API と入れる",
            "出てきた「Google Drive API」をクリック",
            "「有効にする」",
          ]}
        />
      </Section>

      <Section
        title="3. 同意画面を用意する"
        description="サインインのときに出る画面の設定です"
      >
        <Steps
          items={[
            "「API とサービス」→「OAuth 同意画面」",
            "ユーザーの種類は「外部」を選んで「作成」",
            "アプリ名（例：顧客管理ツール）、サポートメール、開発者の連絡先に自分のアドレスを入れる",
            "スコープの追加で drive.file を選ぶ（他は追加しない）",
            "作成後、公開ステータスを「本番環境」にする",
          ]}
        />
        <Caution>
          公開ステータスが「テスト中」のままだと、7日ごとにサインインし直しになります。
          必ず「本番環境」にしてください。drive.file だけなら Google の審査は不要です。
        </Caution>
      </Section>

      <Section
        title="4. クライアントIDを作る"
        description="ここで作った文字列をアプリに貼ります"
      >
        <Steps
          items={[
            "「API とサービス」→「認証情報」",
            "「＋ 認証情報を作成」→「OAuth クライアント ID」",
            "アプリケーションの種類は「ウェブ アプリケーション」",
            "名前は分かるもの（例：顧客管理ツール Web）",
            <>
              <strong>承認済みの JavaScript 生成元</strong>に、いま開いているこのサイトの住所を登録する
              <div className="mt-1.5 rounded-md bg-canvas px-3 py-2 font-mono text-xs break-all">
                {origin || "読み込み中…"}
              </div>
              <span className="text-xs text-muted">
                末尾のスラッシュや、その先のパスは付けません
              </span>
            </>,
            "「承認済みのリダイレクト URI」は空のままで構いません",
            "「作成」",
          ]}
        />
        <Caution>
          ここを登録し忘れると、サインインのときに弾かれます。いちばん多いつまずきです。
        </Caution>
      </Section>

      <Section title="5. アプリに貼る">
        <Steps
          items={[
            <>
              作成後に出る
              <code className="mx-1 rounded bg-canvas px-1.5 py-0.5 font-mono text-xs">
                ……apps.googleusercontent.com
              </code>
              をコピーする
            </>,
            <>
              このアプリの <Where key="w">設定 → データ管理</Where> を開く
            </>,
            <>
              <Where key="w2">Google への接続口（この端末）</Where> に貼って「この端末で使う」
            </>,
            "自動で開き直したら「ドライブに接続する」を押してサインイン",
          ]}
        />
        <Tip>
          「クライアントシークレット」のほうは使いません。どこにも書く必要はありません。
          クライアントIDは公開して問題のない値です。
        </Tip>
        <Caution>
          接続口は<strong>端末ごと</strong>の設定です。パソコンとスマホでそれぞれ貼ってください。
          同じクライアントIDを使い回して構いません。
        </Caution>
      </Section>

      <Section title="つまずいたときは">
        <Table
          head={["症状", "たいていの原因"]}
          rows={[
            ["サインインで弾かれる", "承認済みの JavaScript 生成元が未登録、または末尾にスラッシュが付いている"],
            ["「このアプリは確認されていません」と出る", "公開ステータスが「テスト中」のまま"],
            ["7日ごとにサインインを求められる", "同じく「テスト中」のまま"],
            ["貼ったのに接続口が設定されない", "「この端末で使う」を押し忘れ"],
            ["審査が必要と表示される", "スコープを広く取りすぎ。drive.file だけにする"],
          ]}
        />
      </Section>
    </div>
  );
}
