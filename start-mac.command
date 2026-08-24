#!/bin/bash
# 顧客管理ツールを起動する（ダブルクリックで実行）
# 停止するときはこのウィンドウで Control + C を押すか、ウィンドウを閉じます。

cd "$(dirname "$0")" || exit 1

PORT=3100

echo "=============================================="
echo " 電気保安管理 顧客管理ツール"
echo "=============================================="
echo ""

# 初回や依存追加後だけインストールする
if [ ! -d node_modules ]; then
  echo "初回セットアップ中です。数分かかります…"
  npm install || { echo "インストールに失敗しました"; read -r; exit 1; }
  echo ""
fi

echo "データベースを準備しています…"
npm run db:migrate || { echo "データベースの準備に失敗しました"; read -r; exit 1; }
echo ""

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
HOST=$(scutil --get LocalHostName 2>/dev/null)

echo "----------------------------------------------"
echo " このMacから      : http://localhost:$PORT"
if [ -n "$HOST" ]; then
  echo ""
  echo " スマホ・タブレット（おすすめ・ブックマーク可）"
  echo "   http://$HOST.local:$PORT"
  echo "   ※ この名前は Mac の IP が変わっても使えます"
fi
if [ -n "$IP" ]; then
  echo ""
  echo " 上がだめなときの予備（今の IP）"
  echo "   http://$IP:$PORT"
fi
echo ""
echo " どちらも同じ Wi-Fi に繋がっていることが条件です。"
echo "----------------------------------------------"
echo ""
echo "停止するには Control + C を押してください。"
echo ""

# サーバーが立ち上がってからブラウザを開く
( sleep 4; open "http://localhost:$PORT" ) &

npm run dev
