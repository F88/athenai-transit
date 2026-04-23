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

### shapes.txt

- GTFS ZIP に shapes.txt が含まれていない (路線図非対応)

### translations.txt

- 翻訳あり (stop_names: 19, agency_names: 1, trip_headsigns: 4, route_long_names: 1)
