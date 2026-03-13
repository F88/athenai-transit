# Resource Notes

Data source ごとの注意事項をまとめる。

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

### shapes.txt

- GTFS ZIP に shapes.txt が含まれていない

### CKAN リソースの date パラメータ

- downloadUrl に `?date=YYYYMMDD` が必須
- 使用中: 20260126版
