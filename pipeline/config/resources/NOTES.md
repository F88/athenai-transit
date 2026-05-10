# Resource Notes

Data source に関する注意事項や問題点をまとめるドキュメント。データの品質や利用上の注意点を把握するために参照する。

## Data source 全体にわたる注意事項/問題

### コミュニティバスの運営主体とデータ提供元の乖離

関東バスの GTFS データにはコミュニティバスが含まれるが、データ提供元 (関東バス) と利用者が認識する運営主体 (自治体) が異なる。AgencyBadge には「関東バス」と表示されるが、利用者にとっては自治体のコミュニティバスである。

| コミュニティバス | 運営主体 | データ上の agency |
| ---------------- | -------- | ----------------- |
| ムーバス         | 武蔵野市 | 関東バス          |
| すぎ丸           | 杉並区   | 関東バス          |

### 共同運行路線による停留所の重複

異なる事業者が同一路線を共同運行している場合、同じ物理的バス停が各ソースに別々の stop として存在する。地図上に同一地点が2つ表示され、stop_name も事業者間で異なる場合がある。

確認済みの共同運行路線 (`pipeline/scripts/dev/find-joint-routes.ts` で検出):

| route_short_name | ソース                              |
| ---------------- | ----------------------------------- |
| 渋66             | kobus (京王バス) + minkuru (都バス) |
| 中03             | kobus (京王バス) + ktbus (関東バス) |
| 新02             | kobus (京王バス) + ktbus (関東バス) |
| 高45             | kobus (京王バス) + ktbus (関東バス) |

stop_name の差異パターン (渋66 の調査結果):

- 「前」の有無: `渋谷駅前` (minkuru) vs `渋谷駅` (kobus) — 8カ所
- 表記揺れ: `阿佐ヶ谷` vs `阿佐谷` (小書きカタカナ「ヶ」の有無)、`堀ノ内` vs `堀の内` (カタカナ vs ひらがな)
- 「駅」の有無: `永福町駅` (kobus) vs `永福町` (ktbus) — 高45/新02 で確認。京王バスは親会社 (京王電鉄) の駅名を使い、関東バスは地名を使う事業者の立場の違いが反映されている
- 標柱の共用: 渋66 渋谷駅では京王バス管理の標柱を都バスと共用。物理的に同一標柱だがデータ上は別 stop (kobus/minkuru それぞれに存在)

### route_short_name の通称問題

ムーバスでは `route_short_name` に正式名称 (例: `1号路線 吉祥寺東循環`) が入り、`route_long_name` に略称 (例: `MU1吉祥寺駅循環(迂)`) が入る。自治体の公式案内では括弧内の名称 (例: `吉祥寺東循環`) が通称として使われている。RouteBadge に長い正式名称が表示される問題がある。

## Data source ごとの注意事項/問題

## kanto-bus (関東バス)

- Resource definition: `pipeline/config/resources/gtfs/kanto-bus.ts`
- CKAN: <https://ckan.odpt.org/dataset/kanto_bus_all_lines>
- Resource ID (使用中): `05a8cd54-0412-4921-9747-dba755d27538` (20260301版)

### route_color

- 大部分の路線で `route_color` と `route_text_color` が共に `000000`
- ムーバス (武蔵野市コミュニティバス) 系統のみカラー設定あり
- `routeColorFallbacks: { '*': 'D7251D' }` でフォールバック適用

### shapes.txt

- GTFS ZIP に shapes.txt が含まれていない

### translations.txt

- 一部の翻訳に全角スペース (U+3000) が混入している

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須 (なしだと 404)
- CKAN に複数バージョンが公開されており、date でバージョンを指定する
- 使用中: 20260301版

## keio-bus (京王バス)

- Resource definition: `pipeline/config/resources/gtfs/keio-bus.ts`
- CKAN: <https://ckan.odpt.org/dataset/keio_bus_all_lines>
- Resource ID (使用中): `7e191a71-db33-40b6-b304-72ac7405eee9` (20260126版)

### route_color

- 全路線で `route_color` と `route_text_color` が空
- `routeColorFallbacks: { '*': '00377E' }` でフォールバック適用

### trip_headsign

- 全路線で `trip_headsign` が空文字
- 行先情報がないため、NearbyStop カードに「行先が表示されない路線があります」と表示される

### stop_name

- 他ソース (minkuru 等) と比較して、駅名・施設名に「前」が付かない傾向がある (例: `渋谷駅` vs minkuru の `渋谷駅前`)
- 共同運行路線で同一バス停の stop_name が一致しない原因の1つ

### shapes.txt

- GTFS ZIP に shapes.txt が含まれていない

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260126版

## chuo-bus (江戸バス / 中央区コミュニティバス)

- Resource definition: `pipeline/config/resources/gtfs/chuo-bus.ts`
- CKAN: <https://ckan.odpt.org/dataset/tokyo_chuo_city_alldata>
- Resource ID (使用中): `6674c46b-d4aa-44a6-a427-0862df7b7189` (20250108版)

### 有効期間

- 有効期間: 2024/12/01 - 2025/11/30 (期限切れ)
- CKAN に更新版が公開されていない (2026-03-18 時点)

### route_color

- 北循環: `EE1D23` (赤), 南循環: `0072BC` (青) — 正常に設定済み

### shapes.txt

- GTFS ZIP に shapes.txt が含まれている (2路線, 301点)

### translations.txt

- 翻訳データなし (0件)

### agency

- GTFS の agency_name は「日立自動車交通株式会社」(実際の運行事業者)
- CKAN 上のデータ提供元は「中央区役所」(自治体)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20250108版

## iyotetsu-bus (伊予鉄バス)

- Resource definition: `pipeline/config/resources/gtfs/iyotetsu-bus.ts`
- CKAN: <https://ckan.odpt.org/dataset/iyotetsu_bus_all_lines>
- Resource ID (使用中): `4e0f3da7-04a3-4335-ae56-2f4a213d3631` (20260415版)

### iyotetsu-bus route_color

- 全 46 路線で `route_color` / `route_text_color` が設定されている
- `000000` や空文字は確認されず、`routeColorFallbacks` は不要
- 最多は `FBD074 / 0A0A0A` (24路線)

### iyotetsu-bus shapes.txt

- GTFS ZIP に `shapes.txt` は含まれるが、ヘッダのみでデータ行は 0 件
- `shape_dist_traveleded` という非標準列名があるが、実データがないため実害はない

### iyotetsu-bus translations.txt

- 翻訳データあり (`translations.txt` 2401 行)
- 一部の `route_long_name` に全角スペースが含まれる

### iyotetsu-bus CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- CKAN の 20260415 版リソースと対応

## kyoto-city-bus

### route_color に黒 (000000) が 43路線

京都市バスの 139路線中 43路線が route_color=000000 (黒)。地図上で路線図が見づらい。routeColorFallbacks の設定、または黒を別の色に置き換える対応が必要。

route_color 分布: 0000FF (80), 000000 (43), FF4500 (12), FC0FC0 (2), ADD8E6 (1), FFC0CB (1)

## tama-monorail (多摩モノレール)

- Resource definition: `pipeline/config/resources/gtfs/tama-monorail.ts`
- CKAN: <https://ckan.odpt.org/dataset/train-tamamonorail>
- Resource ID: `c72cc2a7-f1d5-41cf-9fac-5545237fd425`

### downloadUrl

- `https://api.odpt.org/api/v4/files/TamaMonorail/data/TamaMonorail-Train-GTFS.zip`
- `?date=YYYYMMDD` パラメータ不要 (常に最新版を返す形式、mir-train と同パターン)
- 認証必須 (`acl:consumerKey`)

### route_color

- 1路線のみ (`tmm:1` 多摩モノレール線) で `route_color=286460` (深緑) が設定済み
- `route_text_color` は空。PR #137 の auto-contrast により表示色が決定される
- 補足: theme background が白の場合、auto-contrast が選ぶ薄色とのコントラスト比が低くなることがある

### shapes.txt / 路線図対応

- GTFS ZIP に shapes.txt は含まれていない
- 国土数値情報 (MLIT N02-24 RailroadSection) の鉄道路線データに `多摩都市モノレール` (operator) / `多摩都市モノレール線` (line) が収録されているため、`mlitShapeMapping` 経由で KSJ から shape を生成する (`pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj-railway.ts`)
- mapping: `多摩都市モノレール線 → tmm:1` (37 segments, 290 points)

### translations.txt

- 翻訳あり (stop_names: 19, agency_names: 1, trip_headsigns: 4, route_long_names: 1)

## nishi-tokyo-bus (西東京バス)

- Resource definition: `pipeline/config/resources/gtfs/nishi-tokyo-bus.ts`
- CKAN: <https://ckan.odpt.org/dataset/nishi_tokyo_bus_nt_bus>
- Resource ID (使用中): `557cfca7-c73b-4dd4-9858-488808bff051` (20260324版)

### 有効期間

- 有効期間: 2026/04/13 - 2026/07/31
- feed_info.feed_version: `20260413_20260731`

### 路線

- 167 routes, 2,909 stops, 8,715 trips, 171,842 stop_times, 314 trip patterns

### route_color

- 全 167 路線で `route_color` / `route_text_color` が空
- `routeColorFallbacks: { '*': 'F01812' }` (Nishi Tokyo Bus corporate red) でフォールバック適用

### agency

- 5 agencies が同梱されている (西東京バス本体 + 4 自治体コミュニティバス):
    - `ntbus:1010101003032` 西東京バス株式会社 (本体)
    - `ntbus:1000020132012` 八王子市(はちバス) — 西東京バスが運行受託
    - `ntbus:1000020132276` 羽村市(はむらん) — 西東京バスが運行受託
    - `ntbus:1000020132284` あきる野市(るのバス) — 西東京バスが運行受託
    - `ntbus:1000020133051` 日の出町(ぐるりーんひのでちゃん) — 西東京バスが運行受託
- 関東バス + ムーバス/すぎ丸 と同じ「事業者+自治体コミュニティバス同梱」パターン
- AgencyBadge では各自治体のシンボルカラー(はちバス=緑、はむらん=スレートブルー、るのバス=クリーム、ひのでちゃん=緑) が個別に設定されている

### shapes.txt

- GTFS ZIP に shapes.txt は含まれているがヘッダのみ (データ行 0 件)
- 列名に `shape_dist_traveleded` という非標準スペル混入。データなしのため実害なし
- iyt2 と同パターン

### translations.txt

- 翻訳あり (stop_names: 2,909, stop_headsigns: 320, route_long_names: 167, agency_names: 5)
- trip_headsigns 翻訳は 0 件

### route_short_name

- `route_short_name` は系統番号(例: `16号01`, `い11`, `戸52`)、`route_long_name` は経路概要

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260324版

## tokyo-cruise-ship (東京都観光汽船 / 水上バス)

- Resource definition: `pipeline/config/resources/gtfs/tokyo-cruise-ship.ts`
- CKAN: <https://ckan.odpt.org/dataset/tokyo_cruise_ship_all_lines>
- Resource ID (使用中): `c96fa688-113d-4681-bcd9-43b21cad0cc3` (20250402版)

### route_type

- 全 5 路線が GTFS の `route_type=4` (Ferry) で 1 事業者として扱われる
- 隅田川・東京湾を航行する水上バス (浅草・お台場海浜公園・豊洲・日の出桟橋・浜離宮の 5 stop)

### 有効期間

- 有効期間: 2025/07/01 - 2026/06/30

### route_color

- 全 5 路線で `route_color` / `route_text_color` が設定済み (008000, A9A9A9 x2, FFFF00 x2)
- `routeColorFallbacks` は不要

### route_short_name

- 全路線で `route_short_name` が空 (`route_long_name` のみ提供される)
- route_id 自体が `[01]浅草～お台場海浜公園` 形式で系統番号を含む

### shapes.txt

- GTFS ZIP に shapes.txt が含まれていない (水路のため一般的な GeoJSON ベースの代替も存在しない)

### translations.txt

- 翻訳あり (stop_names: 5, trip_headsigns: 7)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20250402版

### GTFS-JP 拡張ファイル

- ZIP には GTFS 標準外の `ships.txt` / `payload.txt` / `payload_fare_attributes.txt` / `payload_fare_rules.txt` が含まれる (船舶情報・運賃詳細用の事業者拡張)
- パイプラインでは未使用 (標準テーブルのみで時刻表は再現可能)

## tokyometro (東京メトロ)

- Resource definition: `pipeline/config/resources/gtfs/tokyometro.ts`
- CKAN: <https://ckan.odpt.org/dataset/train-tokyometro>
- Resource ID: `d4f11962-1c5a-4316-9a16-7fb229c227ea`

### downloadUrl

- `https://api.odpt.org/api/v4/files/TokyoMetro/data/TokyoMetro-Train-GTFS.zip`
- `?date=YYYYMMDD` パラメータ不要 (常に最新版を返す形式、mir-train / tama-monorail / twr-rinkai と同パターン)
- 認証必須 (`acl:consumerKey`)

### 有効期間

- 有効期間: 2026/03/14 - 2026/12/31
- feed_info.feed_version: `20260314`

### 路線

- 9 路線すべて収録 (銀座線、丸ノ内線、日比谷線、東西線、千代田線、有楽町線、半蔵門線、南北線、副都心線)
- 185 stops, 9486 trips, 171,069 stop_times, 251 trip patterns

### route_color

- 全 9 路線で line color が設定済み (例: 銀座線=`FF9500`, 丸ノ内線=`F62E36`, 日比谷線=`B5B5AC`)
- `route_text_color` は空。PR #137 の auto-contrast により表示色が決定される
- `routeColorFallbacks` は不要

### shapes.txt / 路線図対応

- GTFS ZIP に shapes.txt は含まれていない
- 国土数値情報 (MLIT N02-24 RailroadSection) に `東京地下鉄` (operator) として 9 路線 + 1 分岐線 (10 ライン名) が収録されているため、`mlitShapeMapping` 経由で KSJ から shape を生成
- mapping (10 line → 9 routes、丸ノ内線本線と分岐線をまとめて `tome:2` へ):
    - `3号線銀座線 → tome:1` (38 segments, 266 points)
    - `4号線丸ノ内線` + `4号線丸ノ内線分岐線 → tome:2` (61 segments, 421 points、方南町支線含む)
    - `2号線日比谷線 → tome:3` (45 segments, 362 points)
    - `5号線東西線 → tome:4` (48 segments, 435 points)
    - `9号線千代田線 → tome:5` (43 segments, 405 points)
    - `8号線有楽町線 → tome:6` (50 segments, 394 points)
    - `11号線半蔵門線 → tome:7` (28 segments, 238 points)
    - `7号線南北線 → tome:8` (38 segments, 383 points)
    - `13号線副都心線 → tome:9` (22 segments, 103 points)
- TOTAL: 373 segments / 3,007 points / shapes.json 約 62KB

### translations.txt

- 翻訳あり (stop_names: 185, trip_headsigns: 93, route_long_names: 9, agency_names: 1)

### route_short_name

- 全路線で空。`route_long_name` のみ提供 (例: `銀座線`)

## twr-rinkai (りんかい線 / 東京臨海高速鉄道)

- Resource definition: `pipeline/config/resources/gtfs/twr-rinkai.ts`
- CKAN: <https://ckan.odpt.org/dataset/train-twr>
- Resource ID: `f1953807-47da-4540-94bd-26c391e5caef`

### downloadUrl

- `https://api.odpt.org/api/v4/files/TWR/data/TWR-Train-GTFS.zip`
- `?date=YYYYMMDD` パラメータ不要 (常に最新版を返す形式、mir-train / tama-monorail と同パターン)
- 認証必須 (`acl:consumerKey`)

### route_color

- 1 路線のみ (`twrr:1` りんかい線) で `route_color=222D65` (deep navy) が設定済み
- `route_text_color` は空。PR #137 の auto-contrast により表示色が決定される
- 補足: provider/agency のブランドカラー (`#00418E` cobalt blue) とは別。route_color は GTFS データに従い viewer 哲学のまま保持

### shapes.txt / 路線図対応

- GTFS ZIP に shapes.txt は含まれていない
- 国土数値情報 (MLIT N02-24 RailroadSection) に `東京臨海高速鉄道` (operator) / `臨海副都心線` (line、GTFS の通称「りんかい線」と異なる正式路線名) が収録されているため、`mlitShapeMapping` 経由で KSJ から shape を生成
- mapping: `臨海副都心線 → twrr:1` (15 segments, 109 points)

### stop_headsign

- 全 stop_times row で空 (8 駅 1 路線の単線往復で、中間駅で行先案内を切り替えるパターンが無いため)
- `translations.txt` にも 0 entries

### trip_headsign / JR 直通

- trip_headsign は 8 種類: りんかい線内 (大崎 / 新木場 / 東京テレポート) と JR 埼京線・川越線直通先 (大宮 / 川越 / 武蔵浦和 / 池袋 / 赤羽)
- GTFS の trip 自体は自社運行範囲 (新木場 〜 大崎) で完結するが、trip_headsign は実際の最終目的地を示す。データ上の terminal stop (大崎等) と headsign が一致しないことがある (例: stop=大崎 / headsign=川越)
- これは事業者の運行実態 (相互直通運転) を反映した正常データ

### route_type と地下鉄区間

- GTFS の `route_type=2` (Rail) で 1 路線として扱われる
- 実態は東京テレポート以南が地下区間 (= subway として認識する利用者もいる) だが、GTFS データは subway (=1) ではなく rail (=2)
- App 側 `data-source-settings.ts` の `routeTypes: [1, 2]` でメタデータ的に地下鉄/普通鉄道両方として扱う (将来の Source 選択 UI で両方のフィルタに表示するため)。実フィルタは GTFS 由来の `route_type=2` のみ

## sanwa-shosen (三和商船 / SANWASHOSEN)

- Resource definition: `pipeline/config/resources/gtfs/sanwa-shosen.ts`
- CKAN: <https://ckan.odpt.org/dataset/sanwa_merchant_vessel_all_lines>
- Resource ID (使用中): `099eb941-9f04-40b2-9a3a-0b4808cc30b1` (20260105版)

### route_type

- 1 路線が GTFS の `route_type=4` (Ferry) で 1 事業者として扱われる
- 牛深港 (熊本県天草市) と蔵之元港 (鹿児島県長島町) を結ぶ航路 (2 stop)

### 有効期間

- 有効期間: 2026/01/05 - 2026/12/31
- feed_info.feed_version: `2.0`

### route_color

- 1 路線で `route_color=0000FF` / `route_text_color=FFFFFF` が設定済み
- `routeColorFallbacks` は不要
- App 側ブランドカラーは `0844A6` (provider 指定) を別途使用

### route_id / stop_id

- route_id, stop_id, shape_id がすべて日本語 + 角括弧プレフィックス形式 (例: `[01]牛深港～蔵之元港`, `[01]牛深港`, `牛深→蔵之元`)
- GTFS spec 上は ID に Unicode 文字列を使用しても合法

### shapes.txt

- GTFS ZIP に shapes.txt が含まれている (1 route, 2 polylines, 18 points)
- shape_id は日本語 (`牛深→蔵之元`, `蔵之元→牛深`)

### translations.txt

- 翻訳あり (stop_names: 2 / ja-Hrkt のみ)
- trip_headsigns / route_long_names / agency_names は 0 件

### GTFS-JP 拡張ファイル

- ZIP には `ships.txt` / `payload.txt` / `payload_fare_attributes.txt` / `payload_fare_rules.txt` が含まれる (フェリー・運賃詳細用の事業者拡張)
- パイプラインでは未使用 (標準テーブルのみで時刻表は再現可能)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260105版

## tokai-kisen (東海汽船 / Tokai Kisen Co.,Ltd.)

- Resource definition: `pipeline/config/resources/gtfs/tokai-kisen.ts`
- CKAN: <https://ckan.odpt.org/dataset/tokai_kisen_all_lines>
- Resource ID (使用中): `30516ce5-9fcc-4bc3-ac9b-baa3e6f531ee` (20260401版)

### route_type

- 全 15 路線が GTFS の `route_type=4` (Ferry)
- 伊豆諸島 (大島・利島・新島・式根島・神津島・三宅島・御蔵島・八丈島・青ヶ島) と小笠原諸島 (父島・母島) を結ぶ航路、関東側 stop は東京・竹芝、横浜・大さん橋、久里浜、館山、下田、伊東、稲取、熱海
- 19 stops, 132 trips, 407 stop_times, 54 trip patterns

### 有効期間

- 有効期間: 2026/04/01 - 2026/06/30
- 短期間更新型のため `date=YYYYMMDD` 値を更新サイクルごとに差し替える必要がある

### route_color

- 全 15 路線で `route_color` / `route_text_color` が空
- `routeColorFallbacks: { '*': '294DA5' }` (Tokai Kisen primary navy) でフォールバック適用
- App 側ブランドカラーは primary `#294DA5` + secondary `#E60013` の 2 色構成

### shapes.txt

- GTFS ZIP に shapes.txt は含まれていない (海路のため一般的な GeoJSON ベースの代替も存在しない)

### translations.txt (旧 GTFS-JP 3 列形式)

- ヘッダが `trans_id, lang, translation` の旧 GTFS-JP v1 形式で、標準 GTFS の 6 列形式 (`table_name, field_name, language, translation, record_id, field_value`) ではない
- CKAN 側の GTFS validation でも `missing_required_column` エラーとして報告される
- `pipeline/scripts/pipeline/build-gtfs-db.ts` の dispatch でヘッダを peek し、 `isGtfsJpLegacyTranslationsHeader` 一致時かつ allowlist (`LEGACY_TRANSLATION_ALLOWLIST`) 入りの場合のみ `pipeline/scripts/pipeline/lib/gtfs-csv-converter.ts` の純変換関数 `convertGtfsJpLegacyTranslationRow` 経由で標準形式に変換しながら DB に投入する。 allowlist 外で 3 列ヘッダを検知した場合は明示的 error で fail (= 誤適用防止)
- value-based 統合 converter は `trans_id` を GTFS spec の 28 個の text-translatable column と照合し、 マッチした全 (table, field) で 1 row ずつ emit。 例えば stop_name が trip_headsign と被るケースでは両 (table, field) に翻訳が登録され、 WebApp lookup が両方で成立する
- Tokai Kisen の trans_id 19 件のうち 8 件は **`stops.stop_name` と `trips.trip_headsign` の両方にマッチ** = 旧固定マッピング時代は trip_headsign 翻訳が落ちていた (`(stops, stop_name, ...)` のみ登録) が、 統合 converter で `(trips, trip_headsign, ...)` も emit されるようになり ja / ja-Hrkt / en の trip_headsign 多言語表示が機能するようになった (取り込み 57 → 81 行)
- `lang` 列の `ja-HrKt` (script subtag が非 BCP 47 形) は `ja-Hrkt` に正規化
- 将来 Tokai Kisen が標準 6 列形式に upgrade した場合は dispatch が自動的に標準 importer にフォールバック (peek で legacy 不一致になるため)、 誤検知ログや誤適用は起きない設計

### GTFS-JP 拡張ファイル

- ZIP には GTFS 標準外の `ships.txt` / `payload.txt` / `payload_fare_attributes.txt` / `payload_fare_rules.txt` が含まれる (船舶情報 / トラック・自動車積載スペック / 運賃詳細用の事業者拡張)
- `ships.txt` の `ships_id` 列は値ありだが他のスペック列はすべて空 (Sanwa Shosen のように埋まってはいない)
- パイプラインでは未使用 (標準テーブルのみで時刻表は再現可能)

### その他のスキーマゆれ

- `fare_attributes.txt` に `cabin_name` 列が追加されている (schema 外のため import 時に warning で無視)
- `payload.txt` のヘッダに typo `paylaod_id` (※ payload_id ではない) が含まれるが、payload テーブル自体が schema 外で skip されるため影響なし
- `trips.txt` に `payload_id`, `ships_id` 列があるが schema 外のため warning で無視

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260401版

## kagoshima-maritime-bureau (鹿児島市船舶局 / 桜島フェリー)

- Resource definition: `pipeline/config/resources/gtfs/kagoshima-maritime-bureau.ts`
- CKAN: <https://ckan.odpt.org/dataset/kagoshima_city_maritime_bureau_all_lines>
- Resource ID (使用中): `2cf53e9c-e2e3-40e4-bf6f-bef08b33fa4c` (20251010版)

### route_type / 概要

- 1 路線、`route_type=4` (Ferry)、鹿児島港 ↔ 桜島港の生活航路
- 2 stops, 123 trips, 246 stop_times, 2 trip patterns

### 有効期間

- 有効期間: 2025/10/01 - 2027/03/31 (期限長め)

### route_color / route_text_color

- 1 路線で `route_color=FFFFFF` / `route_text_color=000000` がソース側で設定済
- `route_color=FFFFFF` は GTFS 上「set」扱いだが、白い地図背景に対しては polyline が見えない
- pipeline 側の routeColorFallbacks は **空欄判定でのみ発動する** ため、`FFFFFF` 値はそのまま data.json に出力される (data viewer philosophy)
- 結果: 地図上の polyline は白色 (= 視認不能) のまま。AgencyBadge / RouteBadge は WebApp 側のコントラスト補正で読める形で表示される
- 当面この挙動を許容 (`routeColorFallbacks: { '*': 'C21B7E' }` は将来 polyline 修復方針が決まった際の備えとして残してある)

### shapes.txt

- GTFS ZIP に shapes.txt が含まれている (1 route, 2 polylines, 9 points、`shape_id` は `桜島港→鹿児島港` / `鹿児島港→桜島港` の日本語)

### translations.txt

- 標準 6 列形式 (table_name, field_name, language, translation, record_id, field_value)
- ja-Hrkt 読みのみ (en 翻訳なし) — `かごしまこう` / `さくらじまこう`

### GTFS-JP 拡張ファイル

- ZIP に `ships.txt` / `payload.txt` / `payload_fare_attributes.txt` / `payload_fare_rules.txt` が含まれる
- `ships.txt` は `ships_id` 1 行のみで他スペック列は空
- パイプラインでは未使用 (標準テーブルのみで時刻表は再現可能)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20251010版

## okushiri-ferry (オクシリアイランドフェリー / Okushiri Island Ferry)

- Resource definition: `pipeline/config/resources/gtfs/okushiri-ferry.ts`
- CKAN: <https://ckan.odpt.org/dataset/okushiri_island_ferry_okushiri_esashi_ferry_route>
- Resource ID (使用中): `f96ce088-80f8-4124-985c-08799ccd3490` (20260101版)

### route_type / 概要

- 1 路線、`route_type=4` (Ferry)、江差港 (北海道本土) ↔ 奥尻港 (奥尻島) を結ぶ航路
- 2 stops, 36 trips (各方向 18 便), 72 stop_times, 2 trip patterns
- 運航事業者は北海道のフェリー事業者「オクシリアイランドフェリー株式会社」(ハートランドフェリー系列、URL は heartlandferry.jp)

### 有効期間

- 有効期間: 2026/01/01 - 2026/12/31

### route_color

- `route_color=0000FF` (青) / `route_text_color=FFFFFF` (白) がソース側で正しく設定されている
- `routeColorFallbacks` 不要

### shapes.txt

- GTFS ZIP に shapes.txt が含まれている (1 route, 2 polylines, 84 points)
- shape_id は日本語: `奥尻→江差` (47 points) / `江差→奥尻` (37 points)

### translations.txt

- 標準 6 列形式 (table_name, field_name, language, translation, record_id, field_value)
- **5 言語充実翻訳**: en (46) / ja-Hrkt (2) / ko (40) / zh-Hans (44) / zh-Hant (44) — ODPT フェリーソースの中で翻訳が最も充実
- 内訳: agency_name(1) / stops.stop_name(8) / routes.route_long_name(4) / routes.route_url(4) / trips.trip_headsign(6) / trips.trip_short_name(144) / fare_attributes.cabin_name(8) / feed_info.feed_publisher_name(1)
- なお `routes.route_url` の翻訳 (= 言語別 URL) は GTFS spec 上は valid だが、現 pipeline の `extract-translations.ts` は `route_url` を翻訳テーブルから抽出していない (URL ローカライズは未対応)

### CSV format quirks

- `payload.txt` のヘッダに typo `paylaod_id` が含まれる (Tokai Kisen と同じパターン)。payload テーブル自体が schema 外のため影響なし
- `trips.txt` に `payload_id`, `ships_id` 列あり (schema 外、warning で無視)
- `fare_attributes.txt` に `cabin_name` 列あり (schema 外、warning で無視)

### ダウンロード URL の形式

- 他の ODPT ソースと異なり `Okushiri_Esashi_Ferry_Route.zip` (路線名スコープ) という命名
- `AllLines.zip` 形式ではないので URL パスを resource 定義で固定指定する必要がある

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260101版

## orange-ferry (オレンジフェリー / Orange Ferry — 四国開発フェリー株式会社)

- Resource definition: `pipeline/config/resources/gtfs/orange-ferry.ts`
- CKAN: <https://ckan.odpt.org/dataset/orange_ferry_all_lines>
- Resource ID (使用中): `2115e2d4-dc0e-4dbf-b825-14f1da5bd841` (20250517版)

### route_type / 概要

- 3 路線、`route_type=4` (Ferry)、瀬戸内・関西を結ぶ航路
    - `[01]東予～大阪` (route_color=`008000` 緑)
    - `[02]八幡浜～臼杵` (route_color=`FFA500` オレンジ)
    - `[03]新居浜～神戸` (route_color=`0000FF` 青)
- 6 stops (東予港 / 大阪南港 / 八幡浜港 / 臼杵港 / 新居浜港 / 神戸港)
- 21 trips, 42 stop_times, 6 trip patterns

### 有効期間

- 有効期間: 2022/04/01 - **2028/03/31** (ODPT フェリー中で期限最長)

### route_color

- 全 3 路線で `route_color` / `route_text_color` がソース側で正しく設定済 (有効な可視色)
- `routeColorFallbacks` 不要

### shapes.txt

- GTFS ZIP に shapes.txt は含まれていない (海路、代替なし)

### translations.txt (旧 GTFS-JP 3 列形式)

- ヘッダが `trans_id, lang, translation` の旧 GTFS-JP v1 形式 (Tokai Kisen と同パターン)
- `pipeline/scripts/pipeline/build-gtfs-db.ts` のヘッダ peek dispatch (allowlist 必須) で legacy 検出 → `pipeline/scripts/pipeline/lib/gtfs-csv-converter.ts` の value-based 統合 converter で標準形式に変換しながら DB 投入
- 30 行: 6 stops × ja / ja-HrKt / en / zh-Hans / zh-Hant の 5 言語
- `lang=ja-HrKt` → `language=ja-Hrkt` に正規化される
- 全 6 件の trans_id が **`stops.stop_name` と `trips.trip_headsign` の両方にマッチ**。 旧固定マッピング時代は trip_headsign 翻訳が落ちていたが、 統合 converter で `(trips, trip_headsign, ...)` も emit されるようになり 5 言語の trip_headsign 多言語表示が機能 (取り込み 30 → 60 行)

### GTFS-JP 拡張ファイル

- ZIP には `ships.txt` / `payload.txt` / `payload_fare_attributes.txt` / `payload_fare_rules.txt` が含まれる
- パイプラインでは未使用 (標準テーブルのみで時刻表は再現可能)

### fare_attributes.txt

- ヘッダのみで **データ行 0 件** (運賃情報なし)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20250517版 (CKAN 上の最新で feed_end_date まで余裕あり)

## uwajima-unyu (宇和島運輸 / 宇和島運輸フェリー / Uwajima Unyu Ferries)

- Resource definition: `pipeline/config/resources/gtfs/uwajima-unyu.ts`
- CKAN: <https://ckan.odpt.org/dataset/uwajima_unyu_all_lines>
- Resource ID (使用中): `55e14d2f-0f14-41a2-80c7-de1c343ec94a` (20260401版)

### route_type / 概要

- 2 路線、`route_type=4` (Ferry)、豊予海峡を渡る四国↔九州航路
    - `[01]八幡浜～別府` (route_color=`FF0000` 赤)
    - `[02]八幡浜～臼杵` (route_color=`FF0000` 赤)
- 3 stops (八幡浜港 / 別府港 / 臼杵港、stop_id は `[03]` 欠番で `[01]` `[02]` `[04]`)
- 90 trips, 180 stop_times, 4 trip patterns

### 有効期間

- 有効期間: 2026/04/01 - 2026/06/30 (3 ヶ月のみ、頻繁な date 値更新が必要)

### route_color

- 両 route で `route_color=FF0000` / `route_text_color=FFFFFF` が有効値で設定済
- `routeColorFallbacks` 不要

### shapes.txt

- GTFS ZIP に shapes.txt は含まれていない (海路、代替なし)

### translations.txt (旧 GTFS-JP 3 列形式)

- ヘッダが `trans_id, lang, translation` の旧 GTFS-JP v1 形式 (Tokai Kisen / Orange Ferry と同パターン)
- `pipeline/scripts/pipeline/build-gtfs-db.ts` のヘッダ peek dispatch (allowlist 必須) で legacy 検出 → `pipeline/scripts/pipeline/lib/gtfs-csv-converter.ts` の value-based 統合 converter で標準形式に変換しながら DB 投入
- 6 行 = 3 stops × (`ja`, `ja-HrKt`) のみ。 **en 翻訳なし** (Okushiri / Orange Ferry と比較すると言語カバレッジは限定的)
- `lang=ja-HrKt` → `language=ja-Hrkt` に正規化される
- 全 3 件の trans_id が **`stops.stop_name` と `trips.trip_headsign` の両方にマッチ**。 統合 converter で trip_headsign 側にも emit されるようになり ja / ja-Hrkt の trip_headsign 多言語表示が機能 (取り込み 6 → 12 行)

### calendar.txt 空 / calendar_dates.txt のみ

- `calendar.txt` はヘッダのみで data 行 0 件
- 全運航日を `calendar_dates.txt` (182 行) で表現する calendar_dates-only feed
- GTFS spec 上 valid (`calendar.txt` は conditionally required)、pipeline 既対応 (PR #160)
- DataBundle validation で `calendar.data.services is empty` warning が出るが想定内

### stop_name の長さ

- stop_name に「フェリーのりば」サフィックスが含まれる長文 (例: `八幡浜港 宇和島運輸フェリーのりば`)
- 半角スペース込みで 17 文字程度
- UI の行幅で詰まる可能性 — browser 表示確認推奨

### GTFS-JP 拡張ファイル

- ZIP に `ships.txt` / `payload.txt` / `payload_fare_attributes.txt` / `payload_fare_rules.txt` が含まれる
- `payload.txt` のヘッダに typo `paylaod_id` (Tokai Kisen / Okushiri と同パターン)、payload テーブル自体が schema 外で skip されるため影響なし
- パイプラインでは未使用 (標準テーブルのみで時刻表は再現可能)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260401版

## meimon-taiyo-ferry (名門大洋フェリー / Meimon Taiyo Ferry)

- Resource definition: `pipeline/config/resources/gtfs/meimon-taiyo-ferry.ts`
- CKAN: <https://ckan.odpt.org/dataset/meimon_taiyo_ferry_all_lines>
- Resource ID (使用中): `af0e0550-8e8e-48da-8fca-274b091cccb7` (20260401版)

### route_type / 概要

- 1 路線、`route_type=4` (Ferry)、関西と九州を結ぶ夜行フェリー
    - `[01]大阪南港～新門司港` (route_color=`0000FF` 青)
- 2 stops (大阪南港 / 新門司港)
- 4 trips, 8 stop_times, 2 trip patterns
- agency 名は「名門大洋フェリー」、サービスブランドは「シティライン」(agency_url が `cityline.co.jp`)

### 有効期間

- 有効期間: 2026/04/01 - 2026/06/30 (3 ヶ月のみ、頻繁な date 値更新が必要)

### route_color

- `route_color=0000FF` (青) / `route_text_color=FFFFFF` がソース側で有効値で設定済
- `routeColorFallbacks` 不要

### shapes.txt

- GTFS ZIP に shapes.txt は含まれていない (海路、代替なし)

### translations.txt (旧 GTFS-JP 3 列形式)

- ヘッダが `trans_id, lang, translation` の旧 GTFS-JP v1 形式 (Tokai Kisen / Orange Ferry / Uwajima Unyu と同パターン)
- `pipeline/scripts/pipeline/build-gtfs-db.ts` のヘッダ peek dispatch (allowlist 必須) で legacy 検出 → `pipeline/scripts/pipeline/lib/gtfs-csv-converter.ts` の value-based 統合 converter で標準形式に変換
- 4 行 = 2 stops × (`ja`, `ja-HrKt`) のみ。 **en 翻訳なし**
- 全 2 件の trans_id が **`stops.stop_name` と `trips.trip_headsign` の両方にマッチ**。 統合 converter で trip_headsign 側にも emit されるようになり ja / ja-Hrkt の trip_headsign 多言語表示が機能 (取り込み 4 → 8 行)

### GTFS-JP 拡張ファイル

- ZIP に `ships.txt` / `payload.txt` / `payload_fare_attributes.txt` / `payload_fare_rules.txt` が含まれる
- `payload.txt` のヘッダに typo `paylaod_id` (他 ODPT フェリーと同パターン)、payload テーブル自体が schema 外で skip
- パイプラインでは未使用 (標準テーブルのみで時刻表は再現可能)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260401版

## itsukishima-kisen (斎島汽船 / Itsukishima Kisen)

- Resource definition: `pipeline/config/resources/gtfs/itsukishima-kisen.ts`
- CKAN: <https://ckan.odpt.org/dataset/itsukishima_kisen_all_lines>
- Resource ID (使用中): `4c61a823-c0b9-4262-8226-9ddf6b77d886` (20251001版)

### route_type / 概要

- 2 路線、`route_type=4` (Ferry)、広島県呉市の離島群を結ぶ生活フェリー
    - `[01]斎島～久比`
    - `[02]三角島～久比`
- 4 stops (三角港 / 久比港 / 斎島港 / 豊島港)
- 22 trips, 54 stop_times, 6 trip patterns
- agency_url が `city.kure.lg.jp/soshiki/28/koutu.html` (呉市の交通課ページ) — 事業者独自サイトを持っていない

### 有効期間

- 有効期間: 2025/10/01 - 2026/09/30 (1 年、ODPT フェリーの中では長め)

### route_color

- 両 route で `route_color=FFFFFF` (白) / `route_text_color=000000` (黒)
- `route_color=FFFFFF` は GTFS 上「set」扱いだが、白い地図背景に対しては polyline が透明同等になる
- 当該ソースに shapes.txt が無いため、polyline 描画は発生せず可視化問題は表面化しない
- `routeColorFallbacks` 設定なし (data viewer philosophy で source 値尊重)

### shapes.txt

- GTFS ZIP に shapes.txt は含まれていない (海路、代替なし)

### translations.txt

- 標準 6 列形式 (table_name, field_name, language, translation, record_id, field_value) ✅ legacy ではない
- 14 行 = stops.stop_name(4 stops × 2 言語) + trips.trip_headsign(6 行) の翻訳
- 言語: `ja-Hrkt` + `en`
- en 翻訳に注目: source data は `Itukishima Port` (訓令式)、CKAN / 本リソース定義の display name は `Itsukishima Kisen` (ヘボン式) を採用。ローマ字方式の不一致はアプリ表示で混在し得るが、data viewer philosophy に従い source 値はそのまま保持

### 斎島の英訳

- 漢字「斎島」の ja-Hrkt 読み: いつきしま (`itsukishima`)
- 一般表記 (Hepburn): `Itsukishima`
- source data 内 (translations.txt の en): `Itukishima` (訓令式)
- 本ソースの display 表記は **`Itsukishima`** (Hepburn) に統一

### GTFS-JP 拡張ファイル

- ZIP に `ships.txt` / `payload.txt` / `payload_fare_attributes.txt` / `payload_fare_rules.txt` が含まれる
- `payload.txt` のヘッダに typo `paylaod_id` (他 ODPT フェリー多数と同パターン)、payload テーブル自体が schema 外で skip
- パイプラインでは未使用 (標準テーブルのみで時刻表は再現可能)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20251001版

## kyoto-bus (京都バス / Kyoto Bus Co., Ltd.)

- Resource definition: `pipeline/config/resources/gtfs/kyoto-bus.ts`
- CKAN: <https://ckan.odpt.org/dataset/kyoto_bus_all_lines>
- Resource ID (使用中): `de92909b-8d02-4007-b89d-d9a0d9e78650` (20260507版)
- Provider URL: <https://www.kyotobus.jp/>

### 概要

- 51 routes (route_type=3 bus)、940 stops、4,306 trips、89,230 stop_times、111 trip patterns
- 京都市バス (kcbus) ではカバーされない京都市郊外路線 (大原・嵐山・岩倉・高野方面等) を補完する私鉄系バス
- 営業所 2 つ (高野営業所 / 嵐山営業所、`office_jp.txt` に記録)

### 有効期間

- 有効期間: 2026/05/07 - 2026/09/30 (約 5 ヶ月)

### route_color

- 全 51 routes で `route_color` / `route_text_color` が有効値で設定済 (`106346`/`38BA99`/`00BBCE` 等の多彩な色設定)
- `routeColorFallbacks` 不要

### shapes.txt

- ZIP に shapes.txt は含まれるが **ヘッダのみ、データ行 0** (`shape_dist_traveleded` という非標準スペル混入、iyt2/ntbus と同パターン)
- polyline 描画なし

### translations.txt

- **標準 6 列形式**で legacy auto-conversion 不要 (4,192 行)
- 言語: en / ja / ja-Hrkt / ko / **`zh-cn`** / **`zh-tw`** の 6 言語
- 内訳: stops.stop_name (315 stops × 6 lang) + stop_times.stop_headsign (281 × 5 lang) + agency.agency_name (1) + routes.route_long_name (51) など、stop_headsign 翻訳まで充実
- ⚠️ `zh-cn` / `zh-tw` は BCP 47 region tag 表記 (canonical script tag は `zh-Hans` / `zh-Hant`)。WebApp の i18n 層 (`langKeysEquivalent`、PR #191) で `zh-Hans` / `zh-Hant` の lookup と自動マッチするので user 表示には影響なし

### GTFS-JP 拡張ファイル

- `pattern_jp.txt` 154 行 (jp_pattern_id 別の経由 stop 概要)、`office_jp.txt` 2 行 (高野・嵐山)
- pipeline では未使用 (標準テーブルのみで時刻表は再現可能)

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260507版

## odakyu-bus (小田急バス / Odakyu Bus Co., Ltd.)

- Resource definition: `pipeline/config/resources/gtfs/odakyu-bus.ts`
- CKAN: <https://ckan.odpt.org/dataset/odakyu_bus_aii_lines> (※ dataset slug が `aii_lines` (ll でなく ii)、ZIP 名も `AIILines.zip` ← ODPT 表記そのまま使用)
- Resource ID (使用中): `e9018a39-8339-4e07-ad96-2fce988dac7b` (20260319版)
- Provider URL: <https://www.odakyubus.co.jp/>
- Feed publisher: NEC ネクサソリューションズ株式会社

### 概要

- 545 routes (route_type=3 bus)、3,274 stops、82,682 trips、1,287,012 stop_times、486 trip patterns
- これまでで最大級の単一 GTFS source (kytbus の約 14×、minkuru の約 1.5×)
- 多摩・武蔵野・神奈川北部の 1 都 1 県跨ぎ路線網 (新宿・吉祥寺・調布・三鷹・成城・あざみ野・新百合ヶ丘・町田等)

### 有効期間

- 有効期間: 2026/04/01 - (`feed_end_date` 空欄、version string は `20260401_20260430`)

### route_color

- 全 545 routes で `route_color` / `route_text_color` が空欄
- `routeColorFallbacks: { '*': '009BE1' }` で primary blue を全 routes に適用

### shapes.txt

- ファイル自体不存在 (ヘッダのみではなく完全に欠落)
- trips の `shape_id` も全空
- polyline 描画なし

### translations.txt: legacy 3 列形式 + value-based 統合変換

- legacy GTFS-JP 3 列形式 (`trans_id, lang, translation`、8,389 行)
- 5 言語 (en / ja / ja-Hrkt / ko / `zh-cn`)、`zh-tw` なし
- Odakyu Bus 発見の本質: **stops.stop_name + routes.route_short_name + routes.route_long_name + stop_times.stop_headsign の翻訳が単一 `translations.txt` に混在**しており、 4 ferry source の前提 (= 全 trans_id が `stops.stop_name`) では成立しない
- value-based 統合 converter (`convertGtfsJpLegacyTranslationRow`) で対応:
    - `build-gtfs-db.ts` 側で GTFS spec の 28 個の text-translatable column (`agency.agency_name` / `stops.stop_name` / `routes.route_short_name` / `routes.route_long_name` / `trips.trip_headsign` / `stop_times.stop_headsign` / `pathways.signposted_as` 等) を pre-scan して `Map<table.field, Set<string>>` を構築
    - `trans_id` をマッチした全 (table, field) で 1 row ずつ emit。 例: trans_id 「あざみ野駅」が `stops.stop_name` と `stop_times.stop_headsign` 両方に存在する場合、 `(stops, stop_name, ...)` と `(stop_times, stop_headsign, ...)` の 2 行が emit される (終点 stop は headsign としても使われるため、 翻訳が両方の lookup で必要)
    - どこにもマッチしない trans_id は orphan として skip + warn
- 取り込み結果: **8,403 件** (`stops.stop_name` 5,366 + `routes.route_long_name` 2,029 + `routes.route_short_name` 553 + `stop_times.stop_headsign` 455)
- `routes.route_short_name` 553 件は 139 distinct × 平均 3.98 lang。 系統番号 (例: 「鶴11」) の en / ko / zh-cn 翻訳がここに含まれる
- `stop_times.stop_headsign` 455 件は 91 distinct × 5 lang。 すべて `stops.stop_name` と field_value が被るケース (= 終点 stop の name = headsign)
- orphan **269 件** は **source data の不整合** (translations.txt にあるが対応する stop/route 等が存在しない、 例: 「センター南駅」 / 「成田空港待機場」 / 「多摩営業所（南観光）」)。 data viewer philosophy に従い skip + log
- 副次効果: 同 PR で旧固定マッピングを撤廃したため、 既存 4 ferry source (Tokai Kisen / Orange Ferry / Uwajima Unyu / Meimon Taiyo Ferry) の data loss も解消された (詳細は当該 source のセクションを参照)

### calendar.txt なし

- `calendar.txt` 不在、`calendar_dates.txt` 240 行のみ (28 service、`exception_type=1` のみ)
- calendar_dates-only feed として処理 (PR #160 既対応)
- validate で「`calendar.data.services is empty (0 services)`」warning が出るが既知パターン

### trip_headsign の扱い

- `trips.trip_headsign` 全空、`stop_times.stop_headsign` ほぼ全埋まり (1,287,012 / 1,287,013)
- Keio Bus (`kobus`) と同パターン (memory: `project_kobus_headsign_convention`)
- 行先表示は stop_headsign 経由

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260319 版

### GTFS-JP 拡張カラム / 未使用ファイル

- `routes.jp_parent_route_id` (全空)、`trips.jp_trip_desc` / `jp_trip_desc_symbol` / `jp_office_id` (pipeline 未使用)
- `fare_attributes.txt` / `fare_rules.txt` ヘッダのみ (空、pipeline スキップ)

### 規模インパクト

- DB サイズ 192 MB (kytbus 18 MB の約 11×)
- build-from-gtfs 処理時間 14.3s
- global-insights は 940 stop の追加で 26→28s (+2s)
- WebApp 側 data.json も大きくなる (kytbus の約 11× 想定)
