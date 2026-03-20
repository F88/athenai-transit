# JSON for App (Build JSON)

パイプラインの Stage 3。per-source SQLite DB から WebApp が利用する JSON ファイルを生成する。

## 概要

`build-app-data-from-gtfs.ts` は `build-gtfs-db.ts` が生成した SQLite DB (`pipeline/workspace/_build/db/{outDir}.db`) を読み込み、ソースごとに8つの JSON ファイルを出力する。ID フィールドにはソースプレフィックスが付与される (例: `minkuru:0001-01`)。

| スクリプト                    | 入力                                       | 出力                                             |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `build-app-data-from-gtfs.ts` | `pipeline/workspace/_build/db/{outDir}.db` | `pipeline/workspace/_build/data/{prefix}/*.json` |

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts <source-name>
       npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts --list
       npm run pipeline:build:json
```

| 引数/オプション    | 説明                                                            |
| ------------------ | --------------------------------------------------------------- |
| `<source-name>`    | 単一ソースを処理 (後述の「ソース名の解決」を参照)               |
| `--targets <file>` | ターゲットリストファイルで一括処理 (ソースごとに子プロセス実行) |
| `--list`           | 利用可能なソース名を一覧表示                                    |
| `--help`           | ヘルプメッセージを表示                                          |

`npm run pipeline:build:json` は `--targets pipeline/config/targets/build-json.ts` で一括処理する。

### ソース名の解決

`<source-name>` は `pipeline/config/resources/gtfs/` 内のリソース定義ファイル名 (拡張子なし) を指定する。

```plain
npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts toei-bus
                                             ^^^^^^^^
                                             pipeline/config/resources/gtfs/toei-bus.ts を読み込む
```

リソース定義ファイルには `pipeline.outDir` と `pipeline.prefix` が含まれており、入出力パスはこれらから決定される。

```plain
toei-bus.ts → { pipeline: { outDir: "toei-bus", prefix: "minkuru", ... } }
              │
              ├─ Input:  pipeline/workspace/_build/db/toei-bus.db
              └─ Output: pipeline/workspace/_build/data/minkuru/*.json
```

`--list` で利用可能なソース名を確認できる。

## 入出力パス

- **入力**: `pipeline/workspace/_build/db/{outDir}.db` (SQLite、ソースごと)
- **出力**: `pipeline/workspace/_build/data/{prefix}/` (JSON、ソースごと8ファイル)

入力 DB ファイルが存在しない場合はエラー終了する (exit code 1)。事前に `build-gtfs-db.ts` で DB を構築しておく必要がある。

## 出力ファイル一覧

ソースごとに `pipeline/workspace/_build/data/{prefix}/` に8ファイルを出力する。`data:sync` で `public/data/` にコピーされ、WebApp から fetch される。

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

## 出力の書き込み戦略

### 原則

1ソースの出力 (8ファイル) は**全て同一ビルドからの完全なセット**でなければならない。新旧ファイルの混在は許容しない。

### 既存データの置き換え方式: ステージング + アトミックスワップ

既存の出力ディレクトリを直接上書きしない。ステージングディレクトリに全ファイルを書き出し、全て成功した場合のみ既存データと差し替える。

```plain
1. ステージング準備
   - {prefix}.tmp/ が残存していれば削除 (前回失敗の残骸)
   - {prefix}.tmp/ を新規作成

2. ファイル書き出し (順次)
   - 8ファイルを {prefix}.tmp/ に writeFileSync で順次書き出し

3-A. 全ファイル書き出し成功
   - {prefix}/ を削除 (既存データ)
   - {prefix}.tmp/ を {prefix}/ にリネーム
   → 出力は最新の完全なセット

3-B. 途中でエラー発生 (例: 4ファイル書き出し後に例外)
   - {prefix}.tmp/ を削除 (不完全なステージング)
   - {prefix}/ はそのまま残る (前回の正常データを保持)
   → 出力は前回の完全なセット、不整合なし
```

```plain
pipeline/workspace/_build/data/
├── minkuru/           ← 最終出力 (常に完全な8ファイルセット)
├── minkuru.tmp/       ← 書き込み中のみ一時的に存在
```

### エラー発生時の状態

| フェーズ                | エラー例                 | ステージング            | 既存出力             | スクリプト終了状態 |
| ----------------------- | ------------------------ | ----------------------- | -------------------- | ------------------ |
| DB 読み込み (Phase 1)   | SQL エラー、DB 破損      | 未作成                  | そのまま保持         | exit 1             |
| JSON 書き出し (Phase 2) | ディスクフル、I/O エラー | 削除される              | そのまま保持         | exit 1             |
| ディレクトリ swap       | rename 失敗              | 残存 (次回実行時に削除) | 削除済みの可能性あり | exit 1             |

**初回実行時** (既存の `{prefix}/` が存在しない場合): 失敗すると出力ディレクトリは存在しない状態になる。これは正常であり、WebApp 側は fetch エラーとして当該ソースをスキップする。

### バッチ実行時のソース間独立性

バッチ実行 (`--targets`) では各ソースが独立した子プロセスで実行される。あるソースの成功/失敗は他のソースに影響しない。

| 状態                                     | 結果                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| minkuru: 成功、toaran: 失敗、sggsm: 成功 | minkuru/sggsm は最新データ、toaran は前回データを保持 |
| 全ソース成功                             | 全て最新データ                                        |
| 全ソース失敗                             | 全て前回データを保持                                  |

## DB → JSON の変換フロー

### stops.json

```plain
stops テーブル (location_type = 0)
  + translations テーブル (table_name='stops', field_name='stop_name')
  → StopJson[]
```

- `stop_id` → `{prefix}:{stop_id}` (プレフィックス付与)
- translations は record_id (GTFS-JP) または field_value (標準 GTFS) で JOIN

### routes.json

```plain
routes テーブル
  + translations テーブル (table_name='routes', field_name='route_long_name')
  → RouteJson[]
```

- `route_id` → `{prefix}:{route_id}`
- `agency_id` → `{prefix}:{agency_id}` (NULL の場合は空文字)
- `m` (route_names): route_long_name の多言語翻訳マップ
- `route_color` が NULL の場合はリソース定義の `routeColorFallbacks` を参照

### calendar.json

```plain
calendar テーブル + calendar_dates テーブル → CalendarJson
```

- `service_id` → `{prefix}:{service_id}`

### timetable.json

```plain
trips テーブル + stop_times テーブル → TimetableJson
```

- 全 ID (stop_id, route_id, service_id) にプレフィックス付与
- departure_time (HH:MM:SS) → 深夜0時からの分数 (整数) に変換
- stop_id → route_id → headsign → service_id → minutes[] の4階層構造

### shapes.json

```plain
trips テーブル (route_id → shape_id 対応) + shapes テーブル → ShapesJson
```

- `route_id` → `{prefix}:{route_id}`
- 座標は小数点以下5桁に丸め (約1m精度)

### agency.json

```plain
agency テーブル
  + translations テーブル (table_name='agency', field_name='agency_name')
  → AgencyJson[]
```

- `agency_id` → `{prefix}:{agency_id}`
- `m` (agency_names): agency_name の多言語翻訳マップ
- `agency_url`/`agency_lang` が NULL → 空文字

### feed-info.json

```plain
feed_info テーブル (LIMIT 1) → FeedInfoJson | null
```

- テーブルが空の場合は `null` を出力 (ファイルは常に存在)
- NULL フィールド → 空文字

### translations.json

```plain
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

## Exit Code

### 単体実行

| code | label | 意味                                                 |
| ---- | ----- | ---------------------------------------------------- |
| 0    | ok    | 成功                                                 |
| 1    | error | 失敗 (DB なし / 抽出エラー / 書き込みエラー / fatal) |

### バッチ実行

| code | label           | 意味     |
| ---- | --------------- | -------- |
| 0    | ok              | 全て成功 |
| 1    | partial failure | 一部失敗 |
| 2    | all failed      | 全て失敗 |

## バリデーション

`validate-app-data.ts` が全8ファイルの存在チェックと calendar の鮮度チェックを行う。

```bash
npm run pipeline:validate
```
