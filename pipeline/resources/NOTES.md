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

確認済みの共同運行路線 (`pipeline/scripts/analysis/find-joint-routes.ts` で検出):

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

### route_short_name の通称問題

ムーバスでは `route_short_name` に正式名称 (例: `1号路線 吉祥寺東循環`) が入り、`route_long_name` に略称 (例: `MU1吉祥寺駅循環(迂)`) が入る。自治体の公式案内では括弧内の名称 (例: `吉祥寺東循環`) が通称として使われている。RouteBadge に長い正式名称が表示される問題がある。

## Data source ごとの注意事項/問題

## kanto-bus (関東バス)

- Resource definition: `pipeline/resources/gtfs/kanto-bus.ts`
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

- Resource definition: `pipeline/resources/gtfs/keio-bus.ts`
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
