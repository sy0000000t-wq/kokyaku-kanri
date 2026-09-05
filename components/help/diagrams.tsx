/**
 * 説明用の図。
 * 色は画面のトークンをそのまま使い、文字は SVG の中に置いて拡大しても崩れないようにする。
 */

const BOX = "fill-[var(--color-surface)] stroke-[var(--color-line)]";
const BRAND = "fill-[var(--color-brand-soft)] stroke-[var(--color-brand)]";
const OK = "fill-[var(--color-ok-soft)] stroke-[var(--color-ok)]";
const WARN = "fill-[var(--color-warn-soft)] stroke-[var(--color-warn)]";
const TEXT = "fill-[var(--color-ink)]";
const MUTED = "fill-[var(--color-muted)]";
const LINE = "stroke-[var(--color-line)]";

function Frame({
  children,
  viewBox,
  label,
}: {
  children: React.ReactNode;
  viewBox: string;
  label: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-canvas p-3">
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={label}
        className="mx-auto block h-auto w-full min-w-[30rem]"
      >
        {children}
      </svg>
    </div>
  );
}

/** データがどこにあるか */
export function DataFlowDiagram() {
  return (
    <Frame viewBox="0 0 640 230" label="端末とGoogleドライブの関係の図">
      <rect x="20" y="30" width="150" height="70" rx="8" className={`${BOX} stroke-2`} />
      <text x="95" y="60" textAnchor="middle" className={`${TEXT} text-[13px] font-medium`}>
        パソコン
      </text>
      <text x="95" y="80" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        ブラウザで開く
      </text>

      <rect x="20" y="130" width="150" height="70" rx="8" className={`${BOX} stroke-2`} />
      <text x="95" y="160" textAnchor="middle" className={`${TEXT} text-[13px] font-medium`}>
        スマホ・iPad
      </text>
      <text x="95" y="180" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        ブラウザで開く
      </text>

      <rect x="380" y="70" width="230" height="90" rx="8" className={`${OK} stroke-2`} />
      <text x="495" y="100" textAnchor="middle" className={`${TEXT} text-[13px] font-medium`}>
        自分の Google ドライブ
      </text>
      <text x="495" y="122" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        顧客管理データ.json
      </text>
      <text x="495" y="142" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        （データの本体はここ1つだけ）
      </text>

      <path d="M175 65 L375 105" className={`${LINE} stroke-2`} markerEnd="url(#arrow)" />
      <path d="M175 165 L375 125" className={`${LINE} stroke-2`} markerEnd="url(#arrow)" />
      <text x="272" y="78" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        読み書き
      </text>
      <text x="272" y="160" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        読み書き
      </text>

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="fill-[var(--color-line)]" />
        </marker>
      </defs>
    </Frame>
  );
}

/** 画面の並びと役割 */
export function ScreenMapDiagram() {
  const screens: [string, string, string][] = [
    ["ダッシュボード", "今月やること", "点検・請求・未入金"],
    ["顧客マスタ", "物件を登録する", "設備・料金・連絡先"],
    ["点検スケジュール", "点検を進める", "点検・報告のチェック"],
    ["請求・入金", "お金を追う", "請求・入金のチェック"],
    ["設定", "土台を決める", "マスタ・接続・履歴"],
  ];
  return (
    <Frame viewBox="0 0 640 150" label="5つの画面の役割の図">
      {screens.map(([name, role, detail], i) => {
        const x = 12 + i * 125;
        return (
          <g key={name}>
            <rect x={x} y="25" width="112" height="100" rx="8" className={`${BOX} stroke-2`} />
            <rect x={x} y="25" width="112" height="26" rx="8" className={BRAND} />
            <text x={x + 56} y="43" textAnchor="middle" className={`${TEXT} text-[11px] font-medium`}>
              {name}
            </text>
            <text x={x + 56} y="75" textAnchor="middle" className={`${TEXT} text-[11px]`}>
              {role}
            </text>
            <text x={x + 56} y="100" textAnchor="middle" className={`${MUTED} text-[10px]`}>
              {detail}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

/** 保安管理契約の請求の流れ（隔月・翌月入金） */
export function BillingTimelineDiagram() {
  const months = [3, 4, 5, 6, 7];
  return (
    <Frame viewBox="0 0 640 200" label="隔月請求・翌月入金の流れの図">
      {months.map((m, i) => (
        <g key={m}>
          <line x1={70 + i * 130} y1="30" x2={70 + i * 130} y2="175" className={`${LINE}`} />
          <text x={70 + i * 130} y="22" textAnchor="middle" className={`${MUTED} text-[12px]`}>
            {m}月
          </text>
        </g>
      ))}

      <rect x="20" y="45" width="230" height="34" rx="6" className={`${BOX} stroke-2`} />
      <text x="135" y="67" textAnchor="middle" className={`${TEXT} text-[12px]`}>
        3月・4月の2ヶ月ぶんが対象
      </text>

      <rect x="145" y="95" width="110" height="34" rx="6" className={`${BRAND} stroke-2`} />
      <text x="200" y="117" textAnchor="middle" className={`${TEXT} text-[12px] font-medium`}>
        4月に請求
      </text>

      <rect x="275" y="145" width="110" height="34" rx="6" className={`${OK} stroke-2`} />
      <text x="330" y="167" textAnchor="middle" className={`${TEXT} text-[12px] font-medium`}>
        5月に入金
      </text>

      <path d="M200 131 L325 145" className={`${LINE} stroke-2`} markerEnd="url(#arrow2)" />

      <defs>
        <marker id="arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="fill-[var(--color-line)]" />
        </marker>
      </defs>
    </Frame>
  );
}

/** 保安管理契約外の請求の流れ（当月分・翌月入金） */
export function BillingExternalDiagram() {
  const months = [5, 6, 7, 8, 9];
  return (
    <Frame viewBox="0 0 640 170" label="保安管理契約外の当月分請求の流れの図">
      {months.map((m, i) => (
        <g key={m}>
          <line x1={70 + i * 130} y1="30" x2={70 + i * 130} y2="150" className={`${LINE}`} />
          <text x={70 + i * 130} y="22" textAnchor="middle" className={`${MUTED} text-[12px]`}>
            {m}月
          </text>
        </g>
      ))}

      <rect x="15" y="45" width="110" height="32" rx="6" className={`${WARN} stroke-2`} />
      <text x="70" y="66" textAnchor="middle" className={`${TEXT} text-[12px]`}>
        5月に実施
      </text>

      <rect x="15" y="88" width="110" height="32" rx="6" className={`${BRAND} stroke-2`} />
      <text x="70" y="109" textAnchor="middle" className={`${TEXT} text-[12px]`}>
        5月分を請求
      </text>

      <rect x="145" y="88" width="110" height="32" rx="6" className={`${OK} stroke-2`} />
      <text x="200" y="109" textAnchor="middle" className={`${TEXT} text-[12px]`}>
        6月に入金
      </text>

      <rect x="275" y="45" width="110" height="32" rx="6" className={`${WARN} stroke-2`} />
      <text x="330" y="66" textAnchor="middle" className={`${TEXT} text-[12px]`}>
        8月に実施
      </text>

      <rect x="275" y="88" width="110" height="32" rx="6" className={`${BRAND} stroke-2`} />
      <text x="330" y="109" textAnchor="middle" className={`${TEXT} text-[12px]`}>
        8月分を請求
      </text>

      <rect x="405" y="88" width="110" height="32" rx="6" className={`${OK} stroke-2`} />
      <text x="460" y="109" textAnchor="middle" className={`${TEXT} text-[12px]`}>
        9月に入金
      </text>

      <text x="320" y="145" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        点検した月 ＝ 請求月。何ヶ月ぶんもまとめません
      </text>
    </Frame>
  );
}

/** 点数の出し方 */
export function PointsDiagram() {
  return (
    <Frame viewBox="0 0 640 190" label="保安管理点数の出し方の図">
      <rect x="15" y="40" width="140" height="60" rx="8" className={`${BOX} stroke-2`} />
      <text x="85" y="65" textAnchor="middle" className={`${TEXT} text-[12px] font-medium`}>
        設備容量
      </text>
      <text x="85" y="85" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        300kVA など
      </text>

      <rect x="185" y="40" width="140" height="60" rx="8" className={`${BOX} stroke-2`} />
      <text x="255" y="65" textAnchor="middle" className={`${TEXT} text-[12px] font-medium`}>
        換算係数
      </text>
      <text x="255" y="85" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        係数表から引く
      </text>

      <rect x="355" y="40" width="140" height="60" rx="8" className={`${BOX} stroke-2`} />
      <text x="425" y="65" textAnchor="middle" className={`${TEXT} text-[12px] font-medium`}>
        周期の倍率
      </text>
      <text x="425" y="85" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        2ヶ月に1回 → 0.6
      </text>

      <rect x="500" y="115" width="125" height="50" rx="8" className={`${BRAND} stroke-2`} />
      <text x="562" y="137" textAnchor="middle" className={`${TEXT} text-[12px] font-medium`}>
        設備の点数
      </text>
      <text x="562" y="155" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        設備ごとに出して合計
      </text>

      <text x="170" y="76" textAnchor="middle" className={`${MUTED} text-[16px]`}>
        →
      </text>
      <text x="340" y="76" textAnchor="middle" className={`${MUTED} text-[16px]`}>
        ×
      </text>
      <path d="M495 85 L555 115" className={`${LINE} stroke-2`} markerEnd="url(#arrow3)" />

      <text x="255" y="150" textAnchor="middle" className={`${MUTED} text-[11px]`}>
        「保安管理契約外」の設備は、この計算に入りません（0点）
      </text>

      <defs>
        <marker id="arrow3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="fill-[var(--color-line)]" />
        </marker>
      </defs>
    </Frame>
  );
}

/** 配布したときの独立性 */
export function ShareDiagram() {
  const people: [string, string][] = [
    ["あなた", "自分のドライブ"],
    ["仲間 A", "A のドライブ"],
    ["仲間 B", "B のドライブ"],
  ];
  return (
    <Frame viewBox="0 0 640 210" label="配布したときのデータの分かれ方の図">
      <rect x="200" y="15" width="240" height="42" rx="8" className={`${BRAND} stroke-2`} />
      <text x="320" y="41" textAnchor="middle" className={`${TEXT} text-[12px] font-medium`}>
        同じ URL のアプリ（画面の材料だけ共通）
      </text>

      {people.map(([who, where], i) => {
        const x = 25 + i * 200;
        return (
          <g key={who}>
            <path d={`M320 60 L${x + 90} 95`} className={`${LINE} stroke-2`} markerEnd="url(#arrow4)" />
            <rect x={x} y="100" width="180" height="42" rx="8" className={`${BOX} stroke-2`} />
            <text x={x + 90} y="126" textAnchor="middle" className={`${TEXT} text-[12px]`}>
              {who}
            </text>
            <rect x={x} y="152" width="180" height="42" rx="8" className={`${OK} stroke-2`} />
            <text x={x + 90} y="178" textAnchor="middle" className={`${TEXT} text-[12px]`}>
              {where}
            </text>
          </g>
        );
      })}

      <defs>
        <marker id="arrow4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="fill-[var(--color-line)]" />
        </marker>
      </defs>
    </Frame>
  );
}
