# V2 Build Data Source Catalog (DataSourceCatalogBundle)

v2 パイプラインが生成済みの bundle 群を集約し、`data-source-catalog.json` (DataSourceCatalogBundle) を生成する。

型仕様は `contracts/data/transit-v2-catalog-json.ts` を参照 (TSDoc で bundle 全体と各 section を詳述)。

## 概要

| 項目       | 内容                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 入力       | `pipeline/workspace/_build/data-v2/{prefix}/{data,insights,shapes}.json` + `pipeline/workspace/_build/data-v2/global/insights.json` |
| 出力       | `pipeline/workspace/_build/data-v2/global/data-source-catalog.json`                                                                 |
| スクリプト | `pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts`                                                                |
| npm script | `npm run pipeline:build:v2-data-source-catalog`                                                                                     |

DataSourceCatalogBundle は per-source transit payload ではない。既に生成された v2 bundle 群から、generic consumer 向けの discovery-oriented facts を安定 schema として再構成する単一 artifact である。

`pipeline/scripts/dev/summarize-v2-outputs.ts` の監査用 text report とは目的が異なる。catalog は人手調査用の ad hoc report ではなく、他 consumer が機械的に読める wire-format bundle として扱う。

## 目的

- source ごとの概要を 1 つの安定 schema に集約する
- WebApp 固有の enable state や UI 表示都合を持ち込まず、pipeline 出力として完結した catalog を生成する
- 将来 WebApp や dev tools が source discovery に使える共通入力を用意する

## 非目標

- 現時点では WebApp はこの bundle を消費しない
- `summarize-v2-outputs.ts` の全出力を JSON 化することは目的ではない
- route color, branding, display priority, default enabled state など UI / editorial 都合の情報は含めない
- per-route / per-stop の詳細データを再配布することはしない

## 出力先

```text
pipeline/workspace/_build/data-v2/
└── global/
    ├── insights.json
    └── data-source-catalog.json
```

`data-source-catalog.json` は `global/` 配下の単一 artifact とする。source prefix ごとのディレクトリには置かない。

理由:

- catalog 自体が全 source 横断 artifact である
- `global/insights.json` と同じく、全 source の build 完了後に初めて確定する
- `data:sync` の既存コピー対象 (`pipeline/workspace/_build/data-v2/` 全体) に自然に含まれる

## 実行タイミング

生成順序は次を想定する。

```bash
npm run pipeline:build:v2-data
npm run pipeline:build:v2-odpt-train
npm run pipeline:build:v2-shapes:gtfs
npm run pipeline:build:v2-shapes:ksj
npm run pipeline:build:v2-insights
npm run pipeline:build:v2-global-insights
npm run pipeline:build:v2-data-source-catalog
npm run pipeline:validate:v2
npm run data:sync
```

DataSourceCatalogBundle は以下に依存するため、`build:v2-global-insights` の後に生成する。

- per-source `data.json`
- per-source `insights.json`
- per-source `shapes.json` (optional)
- `global/insights.json`

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --help
       npm run pipeline:build:v2-data-source-catalog
```

| 引数/オプション    | 説明                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `--targets <file>` | 対象 prefix 一覧を指定し、その source 群だけで catalog を構築する |
| `--help, -h`       | ヘルプ表示                                                        |

`<prefix>` 単体モードは持たない。

`--targets` 内の prefix 重複は許容するが、catalog build では first-seen order を保ったまま dedupe する。同じ source を複数回読み込まず、最終的な `sources.data` も各 prefix 1 entry に正規化される。

理由:

- 出力は単一の global artifact である
- `global/insights.json` と同じく、対象 source 群全体を明示して構築する方が責務に合う
- 単体 source のみを指定した場合も、それは「1 source だけを含む catalog」を作る batch の特例として表現できる

## 入力

### 1. Per-source bundles

各 source prefix について、次の bundle を読む。

prefix 妥当性検証では `loadAllGtfsSources()` / `discoverOdptTrainSources()` を通じて resource 定義も間接参照する。ただし、catalog 内の curated metadata を抽出する用途では使わず、あくまで target prefix の検証に限る。

| ファイル        | 状態     | 用途                                  |
| --------------- | -------- | ------------------------------------- |
| `data.json`     | required | source-level summary と counts の構築 |
| `insights.json` | required | bundle-backed summary の構築          |
| `shapes.json`   | optional | shape volume summary の構築           |

### 2. Global artifact

| ファイル               | 状態     | 用途                          |
| ---------------------- | -------- | ----------------------------- |
| `global/insights.json` | required | `globalInsights` section 構築 |

## schema へのマッピング方針

### metadata

`metadata.createdAt` には catalog build 時刻を UTC ISO 8601 / RFC 3339 形式で書き込む。

### sources

`sources.data` は source prefix を key とする object とする。

```json
{
    "sources": {
        "v": 1,
        "data": {
            "minkuru": { "summary": { "...": "..." }, "bundles": { "...": "..." } },
            "kobus": { "summary": { "...": "..." }, "bundles": { "...": "..." } }
        }
    }
}
```

key は output directory 名ではなく prefix とする。これは既存 v2 bundle 内の ID namespace と一致させるためである。

### source.summary

`summary` は source-level semantic facts を保持する。UI や source comparison で使う場合は、可能な限りこちらを優先する。

`bundles` が emitted bundle の構造や storage shape に結びついた metadata を持つのに対し、`summary` は underlying bundle layout に依存しすぎない意味的な値を持つことを意図する。

初期実装では少なくとも次を含める。

- `periods`
    - `feedValidity` ← `feedInfo.data`
    - `servicePeriod` ← `calendar.services`
    - `exceptionRange` ← `calendar.exceptions`
- `agencies`
    - `agency.data` の name / lang / timezone
- `i18n.languages`
    - translations 各 map の言語 union
- `routes.typeCounts`
    - `routes.data[].t` の集計
- `stops.locationTypes`
    - `stops.data[].l` と `ps` の集計
- `stops.geo.bbox`
    - stop 座標の bbox
- `service.maxTripsPerDay`
    - service group ごとの trip 合計の最大値
- `shapes.available`, `shapes.routeCount`
    - route shape 利用可否と shape 付き route 数

### source.bundles

`bundles` は emitted bundle に対する structural metadata を保持する。diagnostics や validation には有用だが、値の単位が bundle 構造に依存する項目も含まれるため、UI 向き指標としては `summary` を優先する。

- `dataBundle`
    - `file.sizeBytes`
    - top-level section counts
- `insightsBundle`
    - `file.sizeBytes`
    - section counts
- `shapesBundle?`
    - `file.sizeBytes`
    - route count, polyline count, point count, totalLengthKm

`shapes.json` が存在しない source では `shapesBundle` 自体を省略する。

#### `bundles.dataBundle.counts.*` の counting unit

`bundles.dataBundle.counts.*` は UI 向きの意味評価ではなく、`data.json` bundle をどう数えるかを固定した structural counts として扱う。

| field          | 実際に数えるもの                                                  | 備考                                                   |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `stops`        | `stops.data.length`                                               | parent station / entrance を含む stop entry 総数       |
| `routes`       | `routes.data.length`                                              | route entry 数                                         |
| `agency`       | `agency.data.length`                                              | agency entry 数                                        |
| `calendar`     | `calendar.data.services.length + calendar.data.exceptions.length` | service と exception の合算                            |
| `feedInfo`     | `1`                                                               | valid bundle では常に 1                                |
| `timetable`    | `Object.keys(timetable.data).length`                              | timetable stop key 数。group 数や stop-time 数ではない |
| `tripPatterns` | `Object.keys(tripPatterns.data).length`                           | trip pattern ID 数                                     |
| `translations` | translation 各 map の top-level entry 数の総和                    | semantic UI 値ではなく structural aggregate            |
| `lookup`       | lookup 各 map の top-level entry 数の総和                         | semantic UI 値ではなく structural aggregate            |

#### `bundles.insightsBundle.counts.*` の counting unit

| field              | 実際に数えるもの                            | 備考                    |
| ------------------ | ------------------------------------------- | ----------------------- |
| `serviceGroups`    | `serviceGroups.data.length`                 | service group entry 数  |
| `tripPatternStats` | `Object.keys(tripPatternStats.data).length` | service-group bucket 数 |
| `tripPatternGeo`   | `Object.keys(tripPatternGeo.data).length`   | trip pattern ID 数      |
| `stopStats`        | `Object.keys(stopStats.data).length`        | service-group bucket 数 |

このため、`bundles.*.counts` を source comparison や UI 指標へ直接流用するのではなく、意味的な比較値は `summary` で別に持つ方針を採る。

### globalInsights

`globalInsights` は `global/insights.json` に由来する cross-source summary とする。

初期実装では少なくとも次を含める。

- `file.sizeBytes`
- `counts.stopGeo`

## required / optional の扱い

| 入力                       | 扱い     | 理由                                           |
| -------------------------- | -------- | ---------------------------------------------- |
| per-source `data.json`     | required | catalog の source summary の基礎入力である     |
| per-source `insights.json` | required | catalog schema で `insightsBundle` が required |
| per-source `shapes.json`   | optional | source によって shape source を持たない        |
| `global/insights.json`     | required | catalog schema で `globalInsights` が required |
| resource definition        | required | source identity / provenance の基礎入力である  |

catalog builder は required 入力の欠損を error として扱う。

## 処理フロー

1. `--targets` で対象 prefix 群を決定する
2. 対象 prefix ごとに `data.json` と `insights.json` の存在を確認する
3. `shapes.json` が存在すれば shapes summary を構築する
4. `data.json` を読み、`summary` と `dataBundle` summary を構築する
5. `insights.json` を読み、`insightsBundle` summary を構築する
6. `global/insights.json` を読み、`globalInsights` summary を構築する
7. `writeDataSourceCatalogBundle()` で `global/data-source-catalog.json` に atomic write する

## 実装構成

| ファイル                                                               | 役割                             |
| ---------------------------------------------------------------------- | -------------------------------- |
| `pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts`   | CLI entry (I/O と引数処理のみ)   |
| `pipeline/src/lib/pipeline/app-data-v2/build-data-source-catalog.ts`   | main orchestration               |
| `pipeline/src/lib/pipeline/app-data-v2/build-data-source-catalog-*.ts` | summary 抽出 helper 群           |
| `pipeline/src/lib/pipeline/app-data-v2/bundle-writer.ts`               | atomic write helper の再利用候補 |
| `contracts/data/transit-v2-catalog-json.ts`                            | DataSourceCatalogBundle の型定義 |

実装スタイルは既存の v2 builders と同様に、entry は薄く保ち、集約ロジックは lib 側に寄せる。

## Exit Code

| code | label           | 意味                            |
| ---- | --------------- | ------------------------------- |
| 0    | ok              | 成功                            |
| 1    | error / partial | 失敗 / 一部失敗                 |
| 2    | all failed      | 全失敗 (`--targets` バッチのみ) |

単体 global artifact builder であっても、既存 build scripts の exit code 慣習に合わせる。

## Validate との関係

`global/data-source-catalog.json` は `pipeline:validate:v2` の global artifact step で検証する。

ただし validator の責務は catalog の business correctness を深掘りすることではなく、既存方針どおり以下に留める。

- file existence
- `bundle_version` / `kind` / section versions
- 必須 section の存在
- 最低限の shape / count 整合

詳細な summary 内容の正しさは builder 側テストの責務とする。

## CI 組み込み方針

`Update Transit Data` 系 workflow では、少なくとも次の順序で実行する想定:

```bash
npm run pipeline:build:v2-data
npm run pipeline:build:v2-odpt-train
npm run pipeline:build:v2-shapes:gtfs
npm run pipeline:build:v2-shapes:ksj
npm run pipeline:build:v2-insights
npm run pipeline:build:v2-global-insights
npm run pipeline:build:v2-data-source-catalog
npm run pipeline:validate:v2
npm run data:sync
```

catalog builder を CI に組み込むことで、次を早期検知できる。

- target list 登録漏れ
- required bundle 欠損
- resource definition と generated bundle の不整合
- catalog artifact 自体の未生成

## 現在の実装段階

現時点の `build-data-source-catalog.ts` は、target に含まれる各 prefix について既存 bundle を読み、`sources.data` と `globalInsights` を実データで構築する。

現段階で保証しているのは次である。

- `global/data-source-catalog.json` が生成される
- `bundle_version`, `kind`, section wrappers が正しい
- `sources.data[prefix]` に `summary` / `bundles` が実データで出力される
- `globalInsights` に `global/insights.json` 由来の file size / `stopGeo` count が出力される
- `pipeline:validate:v2` から top-level structure を検証できる

一方で validator は現在も top-level structure 中心であり、`summary` 各 field の business correctness や counts 再計算までは担わない。詳細な内容検証は builder 側テストの責務とする。

## 確認観点

初期実装では少なくとも次を確認対象とする。

- `pipeline/workspace/_build/data-v2/global/data-source-catalog.json` が生成される
- `bundle_version = 3`, `kind = "data-source-catalog"`
- target に含まれる prefix ごとに `sources.data[prefix]` が出力される
- `globalInsights` は `global/insights.json` の実測値で出力される
- `pipeline:validate:v2` で top-level structure を検証できる
- `data:sync` 後に `public/<PIPELINE_TRANSIT_DATA_DIR>/global/data-source-catalog.json` へ同期される
