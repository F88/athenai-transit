# V2 Validate Bundles

v2 パイプラインが出力したバンドルファイルを検証する。

## 設計方針

Validator の役割は**パイプライン全体の出力が揃っているかの最終確認**である。各バンドルの出力内容の正しさは builder 側のテストで担保する。

- **ファイル存在チェック**: メインの検証。必須バンドルが全て出力されているか
- **構造チェック**: bundle_version, kind, section versions が正しいか
- **安全網チェック**: builder のバグで壊れたデータがアプリに渡らないための最低限の検証 (座標範囲、参照整合性、配列長一致など)

Validator でデータの中身を深く検証しすぎると builder のテストと重複し、validator 自体が複雑になる。データ品質の徹底的な検証は builder のユニットテスト/統合テストの責務とする。

## 概要

| 項目       | 内容                                                               |
| ---------- | ------------------------------------------------------------------ |
| 入力       | `pipeline/workspace/_build/data-v2/{prefix}/` (各ソースのバンドル) |
| 出力       | 検証結果のログ                                                     |
| スクリプト | `pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts`     |

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts <source-name>
       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --list
       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --help
       npm run pipeline:validate:v2
```

| 引数/オプション    | 説明                                    |
| ------------------ | --------------------------------------- |
| `<source-name>`    | 単体実行。ソース名を指定 (例: toei-bus) |
| `--targets <file>` | ターゲットリストファイルで一括検証      |
| `--list`           | 利用可能なソース名一覧表示              |
| `--help, -h`       | ヘルプ表示                              |

### ソース識別子

V1 は prefix (出力ディレクトリ名) を識別子としたが、V2 はソース名を識別子とする。スクリプト内部でソース名から prefix を解決する。

## バンドルファイル

| ファイル        | Bundle 型      | 存在 |
| --------------- | -------------- | ---- |
| `data.json`     | DataBundle     | 必須 |
| `insights.json` | InsightsBundle | 必須 |
| `shapes.json`   | ShapesBundle   | 任意 |

`data.json` と `insights.json` はアプリが両方存在する前提で動作するため必須。`shapes.json` は shapes データが無いソース (ODPT 等) では生成されないため任意。

## 検証ステップ

`--targets` モード (バッチ実行) では3ステップ、単体実行では2ステップを実行する。

| Step | 名称                        | 対象モード       | 目的                                            |
| ---- | --------------------------- | ---------------- | ----------------------------------------------- |
| 1    | Unvalidated directory check | `--targets` のみ | ターゲット外ディレクトリの検出 (data:sync 保護) |
| 2    | File existence check        | 全モード         | 必須バンドルの存在確認                          |
| 3    | Validate each bundle        | 全モード         | 各バンドルの構造、データ品質、参照整合性を検証  |

### Step 1: Unvalidated directory check

V1 と同じ。`--targets` モードでのみ実行。`data-v2/` 内にターゲットリストに含まれないディレクトリが存在する場合、エラー (exit 2)。

### Step 2: File existence check

必須バンドル (`data.json`, `insights.json`) の存在を確認する。任意バンドル (`shapes.json`) は存在しなければスキップ。

### Step 3: Validate each bundle

存在する各バンドルの中身を検証する。内部的には以下の順で実行し、structure が invalid なら後続をスキップする。

1. **Structure** — bundle_version, kind, section versions
2. **Data quality** — 座標範囲、非空、calendar 有効期限、配列長一致など
3. **Referential integrity** — セクション間の FK 参照整合性

## バンドル別の検証内容

### DataBundle (`data.json`)

#### Structure

| チェック                                                                                                                                 | レベル |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `bundle_version` = 2                                                                                                                     | error  |
| `kind` = "data"                                                                                                                          | error  |
| 9セクション全て存在 (stops, routes, agency, calendar, feedInfo, timetable, tripPatterns, translations, lookup)                           | error  |
| 各セクションの `v` が期待値 (stops=2, routes=2, agency=1, calendar=1, feedInfo=1, timetable=2, tripPatterns=2, translations=1, lookup=2) | error  |

#### Data quality

| チェック                                                            | レベル |
| ------------------------------------------------------------------- | ------ |
| stops 非空                                                          | warn   |
| routes 非空                                                         | warn   |
| calendar services 非空                                              | warn   |
| calendar 有効期限 (最も早い end_date が30日以内 or 期限切れ)        | warn   |
| stops 座標範囲 (lat: -90..90, lon: -180..180)                       | error  |
| timetable d/a 配列長一致 (同一 service_id の `d` と `a` が同じ長さ) | error  |

#### Referential integrity

| チェック                                       | レベル |
| ---------------------------------------------- | ------ |
| timetable の `tp` が tripPatterns に存在するか | error  |
| tripPattern の `r` が routes に存在するか      | error  |
| tripPattern の `stops` が stops に存在するか   | error  |

### ShapesBundle (`shapes.json`)

任意バンドル。存在する場合のみ検証する。

#### Structure

| チェック                         | レベル |
| -------------------------------- | ------ |
| `bundle_version` = 2             | error  |
| `kind` = "shapes"                | error  |
| `shapes.v` = 2                   | error  |
| `shapes.data` が non-null object | error  |

#### Data quality

| チェック                                | レベル |
| --------------------------------------- | ------ |
| shapes 非空                             | warn   |
| 座標範囲 (lat: -90..90, lon: -180..180) | error  |
| polyline 2ポイント以上                  | warn   |
| shape_dist_traveled 非負                | error  |
| shape_dist_traveled 単調非減少          | error  |

### InsightsBundle (`insights.json`)

TODO: pipeline 完成後に検証内容を定義する。

## 出力形式

問題がなければ1行で完結し、問題があるときだけ詳細行を出力する。

```plain
=== Validate v2 bundles (2 sources) ===

--- [1/3] Unvalidated directory check ---

  Result: OK

--- [2/3] File existence check ---

  toei-bus (minkuru):
    data.json ........ OK
    insights.json .... OK
    shapes.json ...... OK
  keio-bus (keibus):
    data.json ........ OK
    insights.json .... OK
    shapes.json ...... not found (optional, skipped)
  Result: 5/6 files present (1 optional skipped).

--- [3/3] Validate each bundle ---

  toei-bus (minkuru):
    [DataBundle]
      Structure:     OK (bundle_version=2, kind=data, 9 sections)
      Sections:
        stops:         3695 stops, OK
        routes:        134 routes, OK
        calendar:      2 services, OK
        tripPatterns:  512 patterns, OK
        timetable:     3695 stops, OK
    [ShapesBundle]
      shapes:        134 routes, 267 polylines, 18340 points, OK
  keio-bus (keibus):
    [DataBundle]
      Structure:     OK (bundle_version=2, kind=data, 9 sections)
      Sections:
        stops:         2100 stops, OK
        routes:        89 routes, OK
        calendar:      3 services, WARN: expires within 30 days
        tripPatterns:  340 patterns, 2 errors
          ERROR: pattern "keibus:P42": route "keibus:R_OLD" not found
          ERROR: pattern "keibus:P42": stop "keibus:S999" not found
        timetable:     2100 stops, OK

Result: FAILED (errors found)
Done in 42ms. (exit code: 2)
```

## Exit Code

| code | label   | 意味                                                   |
| ---- | ------- | ------------------------------------------------------ |
| 0    | ok      | 全チェック通過                                         |
| 1    | warning | 警告あり (calendar 期限切れ/間近、空データなど)        |
| 2    | error   | エラー (ファイル欠損、構造不正、参照整合性違反、fatal) |

## 実装構成

各バンドルの検証ロジックは lib に配置し、スクリプトは CLI + 結果表示のみ担当する。

| ファイル                                                       | 役割                                |
| -------------------------------------------------------------- | ----------------------------------- |
| `pipeline/src/lib/pipeline/app-data-v2/validate-data.ts`       | DataBundle 検証 (pure function)     |
| `pipeline/src/lib/pipeline/app-data-v2/validate-shapes.ts`     | ShapesBundle 検証 (pure function)   |
| `pipeline/src/lib/pipeline/app-data-v2/validate-insights.ts`   | InsightsBundle 検証 (pure function) |
| `pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts` | CLI スクリプト                      |
