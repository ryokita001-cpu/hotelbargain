# hotel-bargain (Next.js版) — 運用終了

**このリポジトリのコードは本番では使われていない。** 実体は
[ryokita001-cpu/hotel-bargain-php](https://github.com/ryokita001-cpu/hotel-bargain-php)
（PHP / ConoHa WING、本番 https://bargain.hotelx.tech ）に完全移行済み。

## ⚠️ 再稼働させないこと

2026-08-30、この構成が「終了したはず」なのに実際には動き続けていたことが判明した。

- `.github/workflows/cron.yml` が `state: active` のまま3時間おきに実行され続け、
  `https://hotel-bargain.vercel.app/api/cron/*` を叩いていた
  （最終実行 2026-08-29T23:34Z、レスポンス `{"deals":88,"errors":[]}`）
- `src/lib/rakuten/client.ts` の Referer は `https://hotel-bargain.com`＝**楽天app1の登録URL**。
  つまり旧環境がapp1の1日あたり累積リクエスト上限を消費し続けていた
- これはPHP版の「app1が2026-08-26以降ブロックされたまま復旧しない」という
  未解明の問題（hotel-bargain-php の CLAUDE.md 4章）の原因とみられる

そのため、このコミットで cron ワークフローと `vercel.json` の crons を削除した。

**再稼働させる場合は、必ず楽天アプリを新規に取得してから行うこと。**
app1/app2 の資格情報を流用すると、PHP版本番のAPI枠を奪い合うことになる。

## このリポジトリを残している理由

Next.js/Vercel/Supabase構成での実装履歴と、楽天Web ServiceのAPI仕様に関する
実機検証の記録（`src/lib/rakuten/client.ts` のコメント）を参照できるようにするため。
コードの変更は不要で、参照専用。
