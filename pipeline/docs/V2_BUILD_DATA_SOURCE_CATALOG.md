# V2 Build Data Source Catalog (DataSourceCatalogBundle)

v2 パイプラインが生成済みの bundle 群と resource definitions を集約し、`data-source-catalog.json` (DataSourceCatalogBundle) を生成する。

型仕様は `contracts/data/transit-v2-catalog-json.ts` を参照 (TSDoc で bundle 全体と各 section を詳述)。

## 概要

| 項目       | 内容                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 入力       | `pipeline/config/resources/` + `pipeline/workspace/_build/data-v2/{prefix}/{data,insights,shapes}.json` + `pipeline/workspace/_build/data-v2/global/insights.json` |
| 出力       | `pipeline/workspace/_build/data-v2/global/data-source-catalog.json`                                                                                                |
| スクリプト | `pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts`                                                                                               |
| npm script | `npm run pipeline:build:v2-data-source-catalog`                                                                                                                    |

DataSourceCatalogBundle は per-source transit payload ではない。既に生成された v2 bundle 群から、generic consumer 向けの discovery-oriented facts を安定 schema として再構成する単一 artifact である。

`pipeline/scripts/dev/summarize-v2-outputs.ts` の監査用 text report とは目的が異なる。catalog は人手調査用の ad hoc report ではなく、他 consumer が機械的に読める wire-format bundle として扱う。

## 目的

- source ごとの概要を 1 つの安定 schema に集約する
- resource definition 由来の curated metadata と bundle 由来の factual summary を同じ artifact にまとめる
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
- resource definitions (`pipeline/config/resources/`)

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --help
       npm run pipeline:build:v2-data-source-catalog
```

| 引数/オプション    | 説明                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| `--targets <file>` | 対象 source-name 一覧を指定し、その source 群だけで catalog を構築する |
| `--help, -h`       | ヘルプ表示                                                             |

`<prefix>` 単体モードは持たない。

理由:

- 出力は単一の global artifact である
- `global/insights.json` と同じく、対象 source 群全体を明示して構築する方が責務に合う
- 単体 source のみを指定した場合も、それは「1 source だけを含む catalog」を作る batch の特例として表現できる

## 入力

### 1. Resource Definitions

`pipeline/config/resources/` の定義を読み、catalog の curated source metadata を構築する。

主に参照する情報:

- `resource.nameEn`, `resource.nameJa`
- `resource.dataFormat`
- `resource.license`
- `resource.catalog`
- `resource.provider`
- `resource.authentication`
- `pipeline.prefix`
- `pipeline.outDir`

ただし、catalog schema には editorial / operational fields をそのまま無制限に写さない。schema に必要なものだけを抽出する。

### 2. Per-source bundles

各 source prefix について、次の bundle を読む。

| ファイル        | 状態     | 用途                                  |
| --------------- | -------- | ------------------------------------- |
| `data.json`     | required | source-level summary と counts の構築 |
| `insights.json` | required | bundle-backed summary の構築          |
| `shapes.json`   | optional | shape volume summary の構築           |

### 3. Global artifact

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

`summary` は source-level の curated facts を保持する。値の由来は主に `data.json` だが、resource definitions でしか得られない curated metadata を今後追加できる余地を残す。

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

### source.bundles

`bundles` は file-backed facts のみを保持する。

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

1. `--targets` で対象 source-name 群を決定する
2. resource definitions を読み、対象 source-name から `prefix` / `outDir` / curated metadata を解決する
3. 各 source について `data.json` と `insights.json` の存在を確認する
4. `shapes.json` が存在すれば shapes summary を構築する
5. `data.json` を読み、`summary` と `dataBundle` summary を構築する
6. `insights.json` を読み、`insightsBundle` summary を構築する
7. `global/insights.json` を読み、`globalInsights` summary を構築する
8. `writeDataSourceCatalogBundle()` で `global/data-source-catalog.json` に atomic write する

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

現時点の `build-data-source-catalog.ts` は placeholder 実装であり、top-level では schema-valid な `DataSourceCatalogBundle` を出力するが、`sources.data` はまだ空である。

つまり、現段階で保証しているのは次である。

- `global/data-source-catalog.json` が生成される
- `bundle_version`, `kind`, section wrappers が正しい
- `pipeline:validate:v2` から top-level structure を検証できる

source-level の `summary` / `bundles` を実データで埋めるのは次段の実装範囲とする。

## 確認観点

初期実装では少なくとも次を確認対象とする。

- `pipeline/workspace/_build/data-v2/global/data-source-catalog.json` が生成される
- `bundle_version = 3`, `kind = "data-source-catalog"`
- `sources.data` に対象 prefix が入る
- `data.json` / `insights.json` がある source で `dataBundle` / `insightsBundle` が埋まる
- `shapes.json` がない source で `shapesBundle` が省略される
- `globalInsights` が `global/insights.json` 由来で埋まる
- `data:sync` 後に `public/next-dev/global/data-source-catalog.json` へ同期される
