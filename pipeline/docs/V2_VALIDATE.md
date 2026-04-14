# V2 Validate Bundles

v2 パイプラインが出力したバンドルファイルを検証する。

## 設計方針

Validator の役割は**パイプライン全体の出力が揃っているかの最終確認**である。各バンドルの出力内容の正しさは builder 側のテストで担保する。

- **ファイル存在チェック**: メインの検証。必須バンドルが全て出力されているか
- **構造チェック**: bundle_version, kind, section versions が正しいか
- **安全網チェック**: builder のバグで壊れたデータがアプリに渡らないための最低限の検証 (座標範囲、参照整合性、配列長一致など)

Validator でデータの中身を深く検証しすぎると builder のテストと重複し、validator 自体が複雑になる。データ品質の徹底的な検証は builder のユニットテスト/統合テストの責務とする。

## 概要

| 項目       | 内容                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------ |
| 入力       | `pipeline/workspace/_build/data-v2/{prefix}/` (各ソース) + `global/insights.json` (cross-source) |
| 出力       | 検証結果のログ                                                                                   |
| スクリプト | `pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts`                                   |

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts <prefix>
       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --list
       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --help
       npm run pipeline:validate:v2
```

| 引数/オプション    | 説明                                  |
| ------------------ | ------------------------------------- |
| `<prefix>`         | 単体実行。prefix を指定 (例: minkuru) |
| `--targets <file>` | ターゲットリストファイルで一括検証    |
| `--list`           | 利用可能な prefix 一覧表示            |
| `--help, -h`       | ヘルプ表示                            |

### ソース識別子

V1 と同様、prefix (出力ディレクトリ名) を識別子とする。ディスク上のディレクトリ名を直接指定するため、リソース定義の解決が不要で堅牢。

## バンドルファイル

| ファイル        | Bundle 型      | 存在 |
| --------------- | -------------- | ---- |
| `data.json`     | DataBundle     | 必須 |
| `insights.json` | InsightsBundle | 必須 |
| `shapes.json`   | ShapesBundle   | 任意 |

`data.json` と `insights.json` はアプリが両方存在する前提で動作するため必須。`shapes.json` は shapes データが無いソース (ODPT 等) では生成されないため任意。

## 検証ステップ

`--targets` モード (バッチ実行) では4ステップ、単体実行では3ステップを実行する。

| Step | 名称                          | 対象モード       | 目的                                            |
| ---- | ----------------------------- | ---------------- | ----------------------------------------------- |
| 1    | Unvalidated directory check   | `--targets` のみ | ターゲット外ディレクトリの検出 (data:sync 保護) |
| 2    | File existence check          | 全モード         | 必須バンドルの存在確認                          |
| 3    | Validate each bundle          | 全モード         | 各バンドルの構造、データ品質、参照整合性を検証  |
| 4    | Validate GlobalInsightsBundle | 全モード         | `global/insights.json` の構造検証               |

### Step 1: Unvalidated directory check

V1 と同じ。`--targets` モードでのみ実行。`data-v2/` 内にターゲットリストに含まれないディレクトリが存在する場合、エラー (exit 2)。`global/` ディレクトリは Step 4 で別途検証するため除外される。

### Step 2: File existence check

必須バンドル (`data.json`, `insights.json`) の存在を確認する。任意バンドル (`shapes.json`) は存在しなければスキップ。

### Step 3: Validate each bundle

存在する各バンドルの中身を検証する。内部的には以下の順で実行し、structure が invalid なら後続をスキップする。

1. **Structure** — bundle_version, kind, section versions
2. **Data quality** — 座標範囲、非空、calendar 有効期限、配列長一致など
3. **Referential integrity** — セクション間の FK 参照整合性

## バンドル別の検証内容

### DataBundle (`data.json`)

#### DataBundle Structure

| チェック                                                                                                                                 | レベル |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `bundle_version = 3                                                                                                                      | error  |
| `kind` = "data"                                                                                                                          | error  |
| 9セクション全て存在 (stops, routes, agency, calendar, feedInfo, timetable, tripPatterns, translations, lookup)                           | error  |
| 各セクションの `v` が期待値 (stops=2, routes=2, agency=1, calendar=1, feedInfo=1, timetable=2, tripPatterns=2, translations=1, lookup=2) | error  |

#### DataBundle Data quality

| チェック                                                            | レベル |
| ------------------------------------------------------------------- | ------ |
| stops 非空                                                          | warn   |
| routes 非空                                                         | warn   |
| calendar services 非空                                              | warn   |
| calendar 有効期限 (最も早い end_date が30日以内 or 期限切れ)        | warn   |
| stops 座標範囲 (lat: -90..90, lon: -180..180)                       | error  |
| timetable d/a 配列長一致 (同一 service_id の `d` と `a` が同じ長さ) | error  |

#### DataBundle Referential integrity

| チェック                                       | レベル |
| ---------------------------------------------- | ------ |
| timetable の `tp` が tripPatterns に存在するか | error  |
| tripPattern の `r` が routes に存在するか      | error  |
| tripPattern の `stops` が stops に存在するか   | error  |

### ShapesBundle (`shapes.json`)

任意バンドル。存在する場合のみ検証する。

#### ShapesBundle Structure

| チェック                         | レベル |
| -------------------------------- | ------ |
| `bundle_version = 3              | error  |
| `kind` = "shapes"                | error  |
| `shapes.v` = 2                   | error  |
| `shapes.data` が non-null object | error  |

#### ShapesBundle Data quality

| チェック                                | レベル |
| --------------------------------------- | ------ |
| shapes 非空                             | warn   |
| 座標範囲 (lat: -90..90, lon: -180..180) | error  |
| polyline 2ポイント以上                  | warn   |
| shape_dist_traveled 非負                | error  |
| shape_dist_traveled 単調非減少          | error  |

### InsightsBundle (`insights.json`)

#### InsightsBundle Structure

| チェック                                  | レベル |
| ----------------------------------------- | ------ |
| `bundle_version = 3                       | error  |
| `kind` = "insights"                       | error  |
| 必須セクション `serviceGroups` が存在する | error  |
| `serviceGroups.v` = 1                     | error  |
| `serviceGroups.data` が配列である         | error  |

#### InsightsBundle Data quality

現在は structure チェックのみ。optional セクション (tripPatternStats, tripPatternGeo, stopStats) の実装に合わせて追加予定。

## 出力形式

問題がなければ1行で完結し、問題があるときだけ詳細行を出力する。

### 警告のみの例 (exit code: 1)

```plain
=== Validate v2 bundles (/path/to/pipeline/workspace/_build/data-v2) ===

  Validating 2 sources: minkuru, kobus

--- [1/3] Unvalidated directory check ---

  Result: All directories are covered by targets.

--- [2/3] File existence check ---

  minkuru:
    data.json ......... OK
    insights.json ..... OK
    shapes.json ....... OK
  kobus:
    data.json ......... OK
    insights.json ..... OK
    shapes.json ....... not found (optional, skipped)
  Result: 5/6 files present (1 optional skipped).

--- [3/3] Validate each bundle ---

  minkuru:
    [DataBundle]
      Structure:     OK (bundle_version = 3, kind=data, 9 sections)
      Sections:
        stops:           3695 stops, OK
        routes:          134 routes, OK
        calendar:        2 services, OK
        tripPatterns:    512 patterns, OK
        timetable:       3695 stops, OK
    [InsightsBundle]
      Structure:     OK (3 service groups)
    [ShapesBundle]
      shapes:        134 routes, 267 polylines, 18340 points, OK
  kobus:
    [DataBundle]
      Structure:     OK (bundle_version = 3, kind=data, 9 sections)
      Sections:
        stops:           2100 stops, OK
        routes:          89 routes, OK
        calendar:        3 services, 1 warning(s)
          ⚠️ WARN:  Calendar expires within 30 days (earliest end_date approaching)
        tripPatterns:    340 patterns, OK
        timetable:       2100 stops, OK
    [InsightsBundle]
      Structure:     OK (3 service groups)

## V2 Bundle Validation

Checked on: 2026-03-22

### ⚠️ Expiring within 30 days

| Prefix | Service ID | End Date | Days Left |
|--------|-----------|----------|-----------|
| kobus | `kobus:O_0001_1` | 2026-03-31 | 9 |
| kobus | `kobus:O_0001_2` | 2026-03-31 | 9 |

⚠️ Validation passed with warnings.

Done in 42ms. (exit code: 1)
```

### エラーありの例 (exit code: 2)

```plain
=== Validate v2 bundles (/path/to/pipeline/workspace/_build/data-v2) ===

  Validating 3 sources: minkuru, kobus, unknown

--- [1/3] Unvalidated directory check ---

  ❌ ERROR: Unvalidated directory: broken/
  Result: 1 unvalidated directory found.

--- [2/3] File existence check ---

  minkuru:
    data.json ......... OK
    insights.json ..... OK
    shapes.json ....... OK
  kobus:
    data.json ......... OK
    insights.json ..... ❌ MISSING (required)
    shapes.json ....... not found (optional, skipped)
  unknown:
    data.json ......... ❌ MISSING (required)
    insights.json ..... ❌ MISSING (required)
    shapes.json ....... not found (optional, skipped)
  Result: 4/9 files present (2 optional skipped).

❌ Validation failed (required files missing).

Done in 12ms. (exit code: 2)
```

参照整合性エラーがある場合、Step 3 で以下のように表示される:

```plain
  kobus:
    [DataBundle]
      Structure:     OK (bundle_version = 3, kind=data, 9 sections)
      Sections:
        stops:           2100 stops, OK
        routes:          89 routes, OK
        calendar:        3 services, OK
        tripPatterns:    340 patterns, 2 error(s)
          ❌ ERROR: tripPattern kobus:P42: route "kobus:R_OLD" not found in routes
          ❌ ERROR: tripPattern kobus:P42: stop "kobus:S999" not found in stops
        timetable:       2100 stops, OK
```

### Step 4: Validate GlobalInsightsBundle

`global/insights.json` (GlobalInsightsBundle) の構造を検証する。per-prefix ではなく、全ソース横断の空間分析データ。

- ファイルが存在しない場合は warning (未ビルドの可能性)
- 存在する場合: bundle_version = 3, kind='global-insights' を確認
- stopGeo セクション (optional): v=1, data が Record であること、nr が number であることを spot-check
- stopGeo セクションが存在しない場合は warning (意図的であれば問題ないが、空間メトリクスが利用不可)

## Exit Code

| code | label   | 意味                                                   |
| ---- | ------- | ------------------------------------------------------ |
| 0    | ok      | 全チェック通過                                         |
| 1    | warning | 警告あり (calendar 期限切れ/間近、空データなど)        |
| 2    | error   | エラー (ファイル欠損、構造不正、参照整合性違反、fatal) |

## 実装構成

各バンドルの検証ロジックは lib に配置し、スクリプトは CLI + 結果表示のみ担当する。

| ファイル                                                            | 役割                                      |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `pipeline/src/lib/pipeline/app-data-v2/validate-data.ts`            | DataBundle 検証 (pure function)           |
| `pipeline/src/lib/pipeline/app-data-v2/validate-shapes.ts`          | ShapesBundle 検証 (pure function)         |
| `pipeline/src/lib/pipeline/app-data-v2/validate-insights.ts`        | InsightsBundle 検証 (pure function)       |
| `pipeline/src/lib/pipeline/app-data-v2/validate-global-insights.ts` | GlobalInsightsBundle 検証 (pure function) |
| `pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts`      | CLI スクリプト                            |
