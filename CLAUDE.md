@AGENTS.md

# hotel-bargain — 開発ガイド

**重要: このディレクトリのコード(Next.js)は現在使われていない。**
実体は `/Users/kitaryo/Projects/hotel-bargain-php`（PHP、ConoHa WING）に完全移行済み。
本番は `https://bargain.hotelx.tech`。このディレクトリはVercel版として最初に作ったが、
「もともとこのアプリで実現したかったこと」をConoHa WING上のPHPで作り直すことになり、
役目を終えた。新しいセッションがこのディレクトリを開いた場合、まず
`/Users/kitaryo/Projects/hotel-bargain-php` の状態を確認すること。

**hotel-bargain-php は GitHub の [ryokita001-cpu/hotel-bargain-php](https://github.com/ryokita001-cpu/hotel-bargain-php)（Private）でGit管理されている**（2026-08-29にgit init & 初回push済み）。
`main`が本番相当。変更はfeatureブランチを切ってPR経由で`main`にマージする運用にした
（詳細は6章）。

---

## 1. プロジェクトの目的・全体概要

hotel-bargain.com は、楽天トラベルの空室検索APIをもとに「過去の相場と比べて
いま価格が下がっているホテル」を検出し、エリア・日付・下落率で探せるポータル。
収益源は楽天トラベルへのアフィリエイト。安さの推定理由はLLM(Gemini)で1〜2文生成する。

## 2. これまでに完了したこと

- Next.js/Vercel/Supabase/GitHub Actions構成で一度MVPを構築し、実際に本番稼働まで
  持っていった（Vercel Hobbyのcron頻度制限・関数実行時間制限に何度もぶつかった）
- その後、常時稼働サーバーでcrontabを自由に使える方が本質的に楽という判断で、
  ConoHa WING上のPHP + MySQLへ完全移行（`hotel-bargain-php`）
- 楽天Web ServiceのAPI仕様をドキュメントに頼らず実機検証し、`hotel-bargain-php/lib/RakutenClient.php`
  に反映（詳細は3章）
- 2つの楽天アプリ(app1/app2)を交互利用してAPI呼び出し元を分散する仕組みを実装
- レビュー数によるホテルの事前スクリーニング(`cron/discover_hotels.php`)を実装。
  当初`fetch_prices.php`/`detect_deals.php`が選外ホテルにもAPI/計算コストを使い
  続ける不具合があったが、`hotels.last_selected_at`で絞り込む形に修正済み(3章参照)
- Gemini 2.5 Flash(無料枠)で「安さの推定理由」を生成する仕組みを実装
- SEO対応(robots.txt, 動的sitemap.xml, canonical, 薄いページのnoindex, JSON-LD)
- トップページに「今週のイチオシ宿」セクションを追加
- hotel-bargain-phpをGitHub(Private)でGit管理下に置いた(3章参照)
- GA4(測定ID `G-3MTPE9C50K`)のトラッキングタグを`index.php`/`deals.php`に設置。
  トップページの検索フォーム送信時に`find_deals`カスタムイベント
  (`area`/`checkin`/`min_discount`をパラメータ化)を発火する仕組みを追加、本番デプロイ済み

## 3. 技術構成・設計方針・重要なルール

### 実体はhotel-bargain-php

- 本番: `https://bargain.hotelx.tech`（ConoHa WINGアカウント `c2870339`）
- DB: MySQL (`mysql68.conoha.ne.jp` / `c9qmf_bargain`)
- LLM: Gemini API (`gemini-2.5-flash`)
- ローカル開発: `config.php`（gitignore済み）にDB/API資格情報を書く。
  本番用は `deploy/config.production.php`（同じくgitignore済み）に書き、
  `bash deploy/conoha-sync.sh` でrsyncデプロイする

### Git運用

- リポジトリ: [ryokita001-cpu/hotel-bargain-php](https://github.com/ryokita001-cpu/hotel-bargain-php)(Private)
- `config.php` / `deploy/config.production.php`は`.gitignore`済み(資格情報を含むため)
- 変更は`main`に直接コミットせず、featureブランチ→PR→マージの流れで行う
  (2026-08-29にGA4タグ導入をこの流れで実施)
- git init時点のコード(GA4タグ導入前)がベースラインとして`main`の初回コミットに
  なっている

### 楽天Web Service APIの実機検証済み仕様(ドキュメントに無い部分)

- `applicationId`・`accessKey`はクエリパラメータとして両方必須
- **Refererヘッダーが、使用するアプリの登録済みApplication URLと完全一致しないと
  403(`REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING`)になる。** アプリごとに登録URLが
  違う点に注意(app1は`https://hotel-bargain.com`名義のまま、app2は`https://bargain.hotelx.tech/`)
- レスポンス(`VacantHotelSearch`, `formatVersion=2`)の`hotels`は「1ホテル分のエントリ配列」が
  そのまま要素になった配列の配列。`{hotel: [...]}`という包み方ではない
- `roomInfo`配下は`{roomBasicInfo}`と`{dailyCharge}`が**別要素として交互に**並ぶ
  (1プランにroomBasicInfoが1つ、宿泊日数分のdailyChargeが続く)。1つのオブジェクトに
  両方入っているわけではない
- 緯度経度は標準の10進度ではなく、**度*3600の秒単位**で返る
  (`rakuten_coord_to_degrees()`で必ず/3600すること。しないとDBのDECIMAL(9,6)が桁あふれする)

### 楽天APIのレート制限と2アプリ運用(変えてはいけない設計)

- 秒間1リクエストは公式に明記されているが、**それとは別に、未審査アプリには
  非公開の1日あたり累積リクエスト上限がある**(2026-08-26に実際に確認)。超えると
  `HTTP_REFERRER_NOT_ALLOWED`という紛らわしいエラーを返す(Refererの設定ミスではなく、
  量的な一時ブロック)。継続すればアプリID自体が停止するリスクもあるとされる
- 対策として`RAKUTEN_APP1_*`/`RAKUTEN_APP2_*`の2アプリをconfig.phpに持ち、
  `rakuten_pick_credentials($index)`でバッチ・エリアごとに交互選択している
  (`lib/RakutenClient.php`)。**片方が本番稼働中にブロックされることは前提として
  起こりうる。** その場合は`deploy/config.production.php`のAPP1側を一時的にAPP2と
  同じ値に書き換えて凌ぎ、復旧を確認したら必ず元の値に戻すこと（2026-08-26に実際にこの
  手順で対応した。戻し忘れると2アプリ運用の意味が無くなる）

### 「割引」「OFF」「セール」は使わない(景品表示法対応、変えてはいけない)

比較対象(`baseline_price`)はホテルの実売価格ではなく、自社算出の相場推定値
(過去60日・同一曜日の中央値)。これを「割引」と表示すると、消費者庁の二重価格表示
規制(有利誤認表示)に抵触するリスクがある。UI文言・LLM生成テキストとも
「相場より○%安い」で統一する。LLMのシステムプロンプト(`lib/LlmClient.php`)にも
明示的に禁止語として指定済み。

### baseline判定の最低サンプル数(`MIN_BASELINE_SAMPLES = 6`, `lib/Pricing.php`)

運用開始直後やホテル入れ替え直後は、同じ曜日のログが1〜2件しかなく、たまたま離れた
日付同士の自然な価格差を「値下がり」と誤って判定してしまう(実際に128件の誤検知が
発生した)。曜日別サンプル数がこの値未満のうちはdeal判定自体をスキップする。

### Gemini 2.5 Flashのthinking機能に注意

デフォルトでthinkingが有効なため、`maxOutputTokens`を使い切ってJSON本文が
出力される前に切れる(`finishReason: MAX_TOKENS`)。`generationConfig.thinkingConfig.thinkingBudget = 0`
で無効化している(`lib/LlmClient.php`)。1〜2文の短文生成に深い推論は不要なため、
再度有効化する意味は無い。

### デプロイ構成とパス解決の罠

- `deploy/conoha-sync.sh`は、borutomoプロジェクトのSSH鍵(`~/.ssh/conoha-borutomo.pem`)・
  ホスト(`www323.conoha.ne.jp:8022`)・ユーザー(`c2870339`)をそのまま流用している
  (同じConoHa WINGアカウントを使っているため)
- `public/`の中身**だけ**が`~/public_html/bargain.hotelx.tech/`に物理コピーされ、
  アプリ本体(`config.php`/`db.php`/`lib/`)は`~/hotel-bargain/`に別置きになる。
  そのため`public/*.php`から`../db.php`のような相対パスではアプリ本体に届かない。
  `public/bootstrap.php`が、デプロイスクリプトの生成する`public/_app_root.php`
  経由でAPP_ROOTを解決する仕組みになっている。**この仕組みを壊すと本番の全ページが
  Fatal Errorになる**(実際に一度発生させて気づいた)
- シンボリックリンクは使わない。borutomo側でCageFSサンドボックスがシンボリックリンクを
  辿れず403になった実績があるため、同じ物理コピー方式を踏襲している

### ホテルのスクリーニングは last_selected_at で絞り込む(変えてはいけない設計)

`discover_hotels.php`はエリアごとレビュー数上位12件だけを選び、選んだ行に
`hotels.last_selected_at = NOW()`を書く。`fetch_prices.php`・`detect_deals.php`は
**`last_selected_at`がこの2日以内(`SELECTION_FRESHNESS_DAYS`)のホテルだけ**を対象にする。
選外になったホテルの行自体は削除しない(price_logs等の外部キー制約があり、
過去の価格履歴も残しておきたいため)。

**この列を見ずに`SELECT * FROM hotels`のような全件取得に戻すと、選外ホテルにも
無限にAPIを叩き続ける不具合が再発する。** 2026-08-26に実際にこれで気づかないまま
270件全部にAPIを叩いていた実績がある(discover_hotelsが108件に絞っても、
fetch_pricesは絞り込みを見ていなかった)。

### ConoHa WINGアカウントの共有リスク(変えてはいけない設計)

このアカウント(`c2870339`)は`borutomo.com`含む16ドメインと共有の共有ホスティング。
PHPプロセス枠はアカウント単位で共有されており、2026-08-24に同居WordPress
(`hotelx.tech`)への大量クロール(1日16.8万リクエスト)でborutomo.comが503を起こした
実績がある。**この経緯を踏まえ、hotel-bargainのcrontabは3時間おきではなく
1日1回・深夜帯(4:00〜5:30)にまとめて実行する設計にしている。**
頻度を上げる場合はborutomo.com側への影響を必ず考慮すること。

現在のcrontab(`crontab -l`で確認可能。borutomoの既存行の下に追記してある):
```
0 4 * * *  discover_hotels.php   （エリアごとにレビュー数上位ホテルを発見）
0 5 * * *  fetch_prices.php      （14日分の価格取得）
30 5 * * * detect_deals.php      （ベースライン算出・Deal判定・理由文生成）
```
`crontab -e`で編集する際は必ず`crontab -l`で既存分(borutomoの`schedule:run`)を
確認してから追記すること。上書きするとborutomoの自動実行が消える。

## 4. 現在直面している課題

### 楽天アプリapp1のブロック状況は要再確認

app1(`3be1fc2f-...`)は2026-08-26中ブロックされ、同日夜になっても復旧しなかった
(discover_hotels.phpを再実行して確認済み)。次回セッションでまず
`rakuten_get_area_class()`をapp1単体で試すなどして復旧を確認し、2アプリ交互利用が
実際に機能する状態に戻っているか確かめること。復旧するまでは実質app2だけが
9エリア中app2担当分(4エリア・48件)しかカバーできていない。

### Dealはまだ0件

サンプル数が閾値(6)未満のため、まだ一件もDealが検出されていない(想定通りの挙動)。
数日運用してから、実際にDealが出るか・LLMの理由文が正しく入るかを確認する必要がある
(理由文生成自体はローカルで単体テスト済みだが、detect_deals.php経由での本番動作は
Dealが0件のため未確認)。

### GA4の`find_deals`イベントは受信未確認

タグ設置・本番デプロイ・`window.gtag`が読み込まれていることまでは確認したが、
GA4管理画面のリアルタイムレポートで実際にイベントが届くところまではまだ確認して
いない。次回セッションでフォーム送信→リアルタイムレポート確認を行うこと。

## 5. 次に着手すべきタスク(Next Actions)

優先度順。

1. app1の復旧確認と、2アプリ交互利用の本番動作再確認(復旧したら残り5エリアも
   discover_hotels.phpで拾えるか確認する)
2. GA4のリアルタイムレポートで`find_deals`イベントの受信を確認。届いていたら
   `area`/`checkin`/`min_discount`をカスタムディメンションとして登録し、必要なら
   `find_deals`をコンバージョンとしてマークする
3. 数日後、実際にDealが検出されるか・LLM理由文が正しく入るかを確認
4. Google Search Consoleへの登録・サイトマップ(`https://bargain.hotelx.tech/sitemap.xml`)送信
5. 楽天デベロッパーズの各アプリのApplication URLを実際の本番ドメインに統一するか検討
   (app1は`https://hotel-bargain.com`名義のまま)

## 6. 作業の進め方(このプロジェクトでの約束)

- 本番反映(`deploy/conoha-sync.sh`の実行)は必ず事前に確認を取る
- GitHubへのpush・PR作成・マージも必ず事前に確認を取る
- 「割引」「OFF」「セール」は使わない。「相場より○%安い」で統一する
- `config.php` / `deploy/config.production.php`はGit管理外。値を一時的に書き換えて
  凌いだ場合は、作業完了後に必ず元の値へ戻す
