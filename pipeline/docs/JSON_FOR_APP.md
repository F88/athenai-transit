# JSON for App (Build JSON)

パイプラインの Step 3。per-source SQLite DB から WebApp が利用する JSON ファイルを生成する。

## 概要

`build-gtfs-json.ts` は `build-gtfs-db.ts` が生成した SQLite DB (`pipeline/build/{outDir}.db`) を読み込み、ソースごとに8つの JSON ファイルを出力する。ID フィールドにはソースプレフィックスが付与される (例: `tobus:0001-01`)。

| スクリプト           | 入力                         | 出力                                  |
| -------------------- | ---------------------------- | ------------------------------------- |
| `build-gtfs-json.ts` | `pipeline/build/{outDir}.db` | `pipeline/build/data/{prefix}/*.json` |

## CLI インターフェース

```
Usage: npx tsx pipeline/scripts/build-gtfs-json.ts
       npm run pipeline:build:json
```

引数なし。全ソースを処理する。DB ファイルが存在しないソースはスキップされる。

## 出力ファイル一覧

ソースごとに `pipeline/build/data/{prefix}/` に8ファイルを出力する。`data:sync` で `public/data/` にコピーされ、WebApp から fetch される。

| ファイル            | DB テーブル                       | 型定義 (transit-json.ts) | 内容                               |
| ------------------- | --------------------------------- | ------------------------ | ---------------------------------- |
| `stops.json`        | stops + translations              | `StopJson[]`             | 停留所 + 多言語名                  |
| `routes.json`       | routes + translations             | `RouteJson[]`            | 路線 + 多言語名 + 事業者ID         |
| `calendar.json`     | calendar + calendar_dates         | `CalendarJson`           | 運行カレンダー + 例外日            |
| `timetable.json`    | trips + stop_times                | `TimetableJson`          | 時刻表 (stop -> route/headsign)    |
| `shapes.json`       | trips + shapes                    | `ShapesJson`             | 路線形状ポリライン                 |
| `agency.json`       | agency + translations             | `AgencyJson[]`           | 事業者情報 + 多言語名              |
| `feed-info.json`    | feed_info                         | `FeedInfoJson \| null`   | フィード情報 (有効期間/バージョン) |
| `translations.json` | translations + trips + stop_times | `TranslationsJson`       | 行先翻訳ルックアップテーブル       |

## DB → JSON の変換フロー

### stops.json

```
stops テーブル (location_type = 0)
  + translations テーブル (table_name='stops', field_name='stop_name')
  → StopJson[]
```

- `stop_id` → `{prefix}:{stop_id}` (プレフィックス付与)
- translations は record_id (GTFS-JP) または field_value (標準 GTFS) で JOIN

### routes.json

```
routes テーブル
  + translations テーブル (table_name='routes', field_name='route_long_name')
  → RouteJson[]
```

- `route_id` → `{prefix}:{route_id}`
- `agency_id` → `{prefix}:{agency_id}` (NULL の場合は空文字)
- `m` (route_names): route_long_name の多言語翻訳マップ
- `route_color` が NULL の場合はリソース定義の `routeColorFallbacks` を参照

### calendar.json

```
calendar テーブル + calendar_dates テーブル → CalendarJson
```

- `service_id` → `{prefix}:{service_id}`

### timetable.json

```
trips テーブル + stop_times テーブル → TimetableJson
```

- 全 ID (stop_id, route_id, service_id) にプレフィックス付与
- departure_time (HH:MM:SS) → 深夜0時からの分数 (整数) に変換
- stop_id → route_id → headsign → service_id → minutes[] の4階層構造

### shapes.json

```
trips テーブル (route_id → shape_id 対応) + shapes テーブル → ShapesJson
```

- `route_id` → `{prefix}:{route_id}`
- 座標は小数点以下5桁に丸め (約1m精度)

### agency.json

```
agency テーブル
  + translations テーブル (table_name='agency', field_name='agency_name')
  → AgencyJson[]
```

- `agency_id` → `{prefix}:{agency_id}`
- `m` (agency_names): agency_name の多言語翻訳マップ
- `agency_url`/`agency_lang` が NULL → 空文字

### feed-info.json

```
feed_info テーブル (LIMIT 1) → FeedInfoJson | null
```

- テーブルが空の場合は `null` を出力 (ファイルは常に存在)
- NULL フィールド → 空文字

### translations.json

```
translations テーブル
  + trips テーブル (trip_headsign の解決)
  + stop_times テーブル (stop_headsign の解決)
  → TranslationsJson
```

行先テキストをキーとした翻訳ルックアップテーブル。**プレフィックスは付与しない** (文字列ルックアップのため)。

- `headsigns`: trip_headsign → { language → translation }
- `stop_headsigns`: stop_headsign → { language → translation }

GTFS-JP (record_id ベース) と標準 GTFS (field_value ベース) の2形式を統一して処理する。

## 略語マッピング

JSON ファイルサイズ削減のため、フィールド名は略語を使用する。

| 略語 | 元のフィールド名                              |
| ---- | --------------------------------------------- |
| `i`  | id (stop_id, route_id, agency_id, service_id) |
| `n`  | name (stop_name, agency_name)                 |
| `m`  | names map (多言語翻訳マップ)                  |
| `a`  | lat (stop_lat)                                |
| `o`  | lon (stop_lon)                                |
| `l`  | location_type / long_name / lang              |
| `s`  | short_name / start_date                       |
| `e`  | end_date                                      |
| `t`  | route_type / exception_type                   |
| `r`  | route_id                                      |
| `h`  | headsign                                      |
| `d`  | days / departures / date                      |
| `c`  | route_color                                   |
| `tc` | route_text_color                              |
| `ai` | agency_id                                     |
| `u`  | url                                           |
| `pn` | feed_publisher_name                           |
| `pu` | feed_publisher_url                            |
| `v`  | feed_version                                  |

## WebApp での利用

JSON ファイルは `FetchDataSource` が `/data/{prefix}/{file}.json` から fetch する。

- **必須ファイル** (5): stops, routes, calendar, timetable, shapes — 失敗時はソース全体をスキップ
- **オプショナルファイル** (3): agency, feed-info, translations — 404 は graceful に処理 (`fetchOptional`)

`GtfsRepository.create()` が複数ソースの JSON をマージし、略語フィールドを App 型 (`Stop`, `Route` 等) に変換する。

## バリデーション

`validate-generated-data.ts` が全8ファイルの存在チェックと calendar の鮮度チェックを行う。

```bash
npm run pipeline:validate
```
