# Validate Generated Data

パイプラインの Stage 3。生成されたアプリ用 JSON ファイルを検証する。

## 概要

| 項目   | 内容                                                 |
| ------ | ---------------------------------------------------- |
| 入力   | `pipeline/workspace/_build/data/{prefix}/` (各ソースの JSON)    |
| 出力   | 検証結果のログ + Markdown サマリ (GitHub Actions 用) |
| ソース | `pipeline/targets/validate.ts` (prefix リスト)       |

`--targets` モードでは3つ、単体実行では2つの検証ステップを実行する (詳細は後述の「検証ステップ」セクションを参照)。

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/app-data/validate-app-data.ts <prefix>
       npx tsx pipeline/scripts/app-data/validate-app-data.ts --targets <file>
       npx tsx pipeline/scripts/app-data/validate-app-data.ts --list
       npx tsx pipeline/scripts/app-data/validate-app-data.ts --help
       npm run pipeline:validate
```

| 引数/オプション    | 説明                                                       |
| ------------------ | ---------------------------------------------------------- |
| `<prefix>`         | 単体実行。prefix (出力ディレクトリ名) を指定 (例: minkuru) |
| `--targets <file>` | ターゲットリストファイルで一括検証                         |
| `--list`           | 利用可能な prefix 一覧表示                                 |
| `--help, -h`       | ヘルプ表示                                                 |

`npm run pipeline:validate` は `--targets pipeline/targets/validate.ts` で一括検証する。

### ソース識別子

他のパイプラインスクリプトはリソース定義のファイル名 (ソース名) を識別子とするが、validate は **prefix** (出力ディレクトリ名) を識別子とする。これは validate の検証対象が `pipeline/workspace/_build/data/{prefix}/` ディレクトリであり、複数のリソース定義が同一 prefix を共有する場合 (例: ODPT JSON の tokyu-bus-busstop, tokyu-bus-busroute → 共に `tkbus`) があるためである。

### Targets ファイル

`string[]` を `export default` する TypeScript ファイル。各エントリは prefix (出力ディレクトリ名)。

```typescript
// pipeline/targets/validate.ts
export default [
    'minkuru', // toei-bus
    'toaran', // toei-train
    'sggsm', // suginami-gsm
    'yurimo', // yurikamome
    // 'tkbus', // tokyu-bus (app data JSON 未実装)
];
```

## 検証ステップ

`--targets` モード (バッチ実行) では3ステップ、単体実行では2ステップを実行する。

| Step | 名称                        | 対象モード       | 目的                                                            |
| ---- | --------------------------- | ---------------- | --------------------------------------------------------------- |
| 1    | Unvalidated directory check | `--targets` のみ | ターゲットリストに含まれないディレクトリの検出 (data:sync 保護) |
| 2    | File existence check        | 全モード         | 各ソースの必須 JSON ファイルの存在確認                          |
| 3    | Calendar freshness check    | 全モード         | サービスの有効期限チェック                                      |

### Unvalidated directory check

`--targets` モードでのみ実行。`pipeline/workspace/_build/data/` 内にターゲットリストに含まれないディレクトリが存在する場合、エラー (exit 2) とする。

後続の `data:sync` で未検証のデータが `public/` にコピーされることを防ぐためのチェック。単体実行時は他のディレクトリが存在するのが通常であるため、このチェックは実行しない。

## 検証対象ファイル

各ソースに対して以下の7ファイル (必須) + 1ファイル (オプション) の存在を確認する:

**必須**:

- `stops.json`
- `routes.json`
- `calendar.json`
- `timetable.json`
- `agency.json`
- `feed-info.json`
- `translations.json`

**オプション** (存在しなくてもエラーにならない):

- `shapes.json`

## カレンダー鮮度チェック

`calendar.json` の各サービスの `end_date` (YYYYMMDD) を確認する。

| 状態                      | 判定    | exit code への影響 |
| ------------------------- | ------- | ------------------ |
| `end_date` < 今日         | expired | EXIT_WARN (1)      |
| `end_date` <= 今日 + 30日 | warning | EXIT_WARN (1)      |
| `end_date` > 今日 + 30日  | ok      | なし               |

## 出力例

```plain
=== Validate generated data (pipeline/workspace/_build/data) ===

  Validating 4 sources: sggsm, minkuru, toaran, yurimo

--- [1/3] Unvalidated directory check ---

  Result: All directories are covered by targets.

--- [2/3] File existence check ---

  sggsm:
    stops.json ......... OK
    routes.json ........ OK
    ...
  Result: 28/28 files present.

--- [3/3] Calendar freshness check ---

  sggsm (calendar.json):
    1 services found.
    Earliest end_date: 2026-05-31 (79 days left)
    Result: OK - all 1 services valid.
  ...
  Result: 65 services checked, 0 expired, 0 expiring soon.

## Generated Data Validation

Checked on: 2026-03-13

✅ All checks passed.

Done in 6ms. (exit code: 0)
```

## Exit Code

| code | label   | 意味                                                                             |
| ---- | ------- | -------------------------------------------------------------------------------- |
| 0    | ok      | 全チェック通過                                                                   |
| 1    | warning | 警告 (期限切れ / 期限間近のサービスあり)                                         |
| 2    | error   | エラー (ファイル欠損 / ターゲット外ディレクトリ検出 / calendar 読込失敗 / fatal) |

`runMain` の fatal error 時も exit code 2 を使用する (スクリプト固有の `EXIT_ERROR` 定数に合わせるため)。

## GitHub Actions 連携

`GITHUB_ACTIONS=true` 環境変数が設定されている場合、ワークフローコマンドを出力する:

- 警告: `::warning::` アノテーション
- エラー: `::error::` アノテーション

出力にはワークフローコマンドインジェクション対策のサニタイズ処理が含まれる (`%`, `\r`, `\n` のエスケープ)。

## Markdown サマリ

検証結果を Markdown 形式でも出力する。GitHub Actions の Job Summary に使用可能。
