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
