# Data Pipeline

GTFS CSV からアプリが利用するJSONファイルを生成するまでのフロー。

## 概要

```text
[ODPT API]                    [国土数値情報]
    |                              |
    v                              v
pipeline/data/gtfs/{source}/  pipeline/data/mlit/*.geojson
    |                              |
    v                              |
pipeline/build/{prefix}.db         |
    |                              |
    v                              v
pipeline/build/data/{prefix}/ pipeline/build/data/toaran/
  stops.json                    shapes.json
  routes.json                   routes.json (色補完)
  calendar.json
  timetable.json
  shapes.json
    \_______________  ______________/
                    \/
              data:sync
                    |
                    v
            public/data/
```

## Step 1: GTFSデータのダウンロード

都営交通のGTFS静的データをODPT公開APIからダウンロードする。

```bash
npm run pipeline:download:gtfs       # バッチ実行 (全 GTFS ソース)

# 単体実行
npx tsx pipeline/scripts/download-gtfs.ts toei-bus
npx tsx pipeline/scripts/download-gtfs.ts toei-train
```

- スクリプト: `pipeline/scripts/download-gtfs.ts`
- 設定: `pipeline/resources/gtfs/*.ts` (リソース定義)
- 出力: `pipeline/data/gtfs/{source}/*.txt` (GTFS CSV ファイル)
- ZIP アーカイブ: `pipeline/archives/gtfs/{source}/` に保存

## Step 2: SQLite DB生成

GTFS CSVファイルをSQLiteデータベースに変換する。

```bash
npm run pipeline:build:db
```

- スクリプト: `pipeline/scripts/build-gtfs-db.ts`
- 出力: `pipeline/build/{prefix}.db` (tobus.db, toaran.db)
- DBファイルは `.gitignore` で除外 (`pipeline/build/`)、Vercelデプロイからも除外

## Step 3: JSON生成

SQLite DBからアプリが利用するJSONファイルを生成する。

```bash
npm run pipeline:build:json
```

- スクリプト: `pipeline/scripts/build-gtfs-json.ts`
- 出力: ソースごとに `pipeline/build/data/{prefix}/` へ5ファイル
    - `stops.json` - 停留所/駅の位置情報
    - `routes.json` - 路線情報 (名称、色。GTFSに色がない路線はフォールバック色を補完)
    - `calendar.json` - 運行カレンダー
    - `timetable.json` - 時刻表
    - `shapes.json` - 路線形状 (バスのみ。電車GTFSにはshapes.txtがないため空)

## Step 4: 電車路線shape生成

都営電車のGTFSには `shapes.txt` が含まれていないため、国土数値情報の鉄道データから路線形状を生成する。

```bash
npm run pipeline:build:train-shapes
```

- スクリプト: `pipeline/scripts/build-train-shapes.ts`
- 入力: `pipeline/data/mlit/N02-24_RailroadSection.geojson`
- 出力: `pipeline/build/data/toaran/shapes.json` - 6路線の路線形状
- **Step 3の後に実行すること** (Step 3が toaran/shapes.json を空で上書きするため)

## Step 5: public/ へコピー (pipeline スコープ外)

pipeline の出力を `public/data/` にコピーし、Vite dev server やプロダクションビルドから参照できるようにする。このステップは WebApp 側のビルドフローであり、pipeline の責務外である。

```bash
npm run data:sync
```

- スクリプト: `scripts/copy-pipeline-data.ts`
- 入力: `pipeline/build/data/`
- 出力: `public/data/`

## 実行順序

フルビルド時の実行順序:

```bash
npm run pipeline:download:gtfs           # 全 GTFS ソースをダウンロード
npm run pipeline:build:db
npm run pipeline:build:json
npm run pipeline:build:train-shapes      # pipeline:build:json の後
npm run data:sync                        # public/data/ へコピー
```

## データソース

| ソース       | prefix | カテゴリ | 出典                                                                                        |
| ------------ | ------ | -------- | ------------------------------------------------------------------------------------------- |
| 都営バス     | tobus  | bus      | [ODPT API](https://ckan.odpt.org/dataset/b_bus_gtfs_jp-toei)                                |
| 都営電車     | toaran | train    | [ODPT API](https://ckan.odpt.org/dataset/train-toei)                                        |
| 鉄道路線形状 | -      | -        | [国土数値情報 鉄道データ](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v2_3.html) |

## 他地域への移植

このパイプラインはGTFS標準仕様に準拠しているため、GTFS静的データを公開している他の交通事業者にも適用できる。

移植手順:

1. `pipeline/resources/gtfs/` にリソース定義ファイルを作成 (詳細は [RESOURCE-DEFINITIONS.md](./docs/RESOURCE-DEFINITIONS.md))
2. `pipeline/targets/download-gtfs.ts` にソース名を追加
3. `npx tsx pipeline/scripts/download-gtfs.ts <source-name>` でデータをダウンロード
4. 以降のビルドステップ (Step 2-4) はソース非依存で動作する

鉄道の路線形状 (Step 4) のみ、`shapes.txt` が含まれないGTFSデータに対して個別対応が必要になる場合がある。

## JSON形式

フィールド名はファイルサイズ削減のため省略形を使用。詳細は `src/types/data/transit-json.ts` を参照。

| 省略 | 意味                        |
| ---- | --------------------------- |
| i    | id                          |
| n    | name                        |
| m    | names map (多言語)          |
| a    | lat                         |
| o    | lon                         |
| s    | short_name / start_date     |
| l    | long_name / location_type   |
| t    | route_type / exception_type |
| c    | route_color                 |
| tc   | route_text_color            |
| r    | route_id                    |
| h    | headsign                    |
| d    | days / departures / date    |
| e    | end_date                    |
