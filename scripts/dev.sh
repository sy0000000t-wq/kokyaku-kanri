#!/bin/sh
# 開発サーバー起動。呼び出し元の cwd に依存しないよう絶対パスへ移動する
cd "/Users/dokosyota/Claude/開発/顧客管理" || exit 1
exec npm run dev
