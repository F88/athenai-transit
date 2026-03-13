# Validate Generated Data

パイプラインの Stage 3。生成されたアプリ用 JSON ファイルを検証する。

## 概要

| 項目   | 内容                                                 |
| ------ | ---------------------------------------------------- |
| 入力   | `pipeline/build/data/{prefix}/` (各ソースの JSON)    |
| 出力   | 検証結果のログ + Markdown サマリ (GitHub Actions 用) |
| ソース | `pipeline/resources/gtfs/*.ts` + `odpt-json/*.ts` (全ソース) |

2つの検証ステップを実行する:

1. **ファイル存在チェック** - 各ソースに必要な JSON ファイルがすべて存在するか
2. **カレンダー鮮度チェック** - サービスの `end_date` が期限切れまたは期限間近でないか

## CLI インターフェース

```
Usage: npx tsx pipeline/scripts/app-data/validate-app-data.ts
       npx tsx pipeline/scripts/app-data/validate-app-data.ts --help
       npm run pipeline:validate
```

| 引数         | 説明       |
| ------------ | ---------- |
| (引数なし)   | 実行       |
| `--help, -h` | ヘルプ表示 |

バッチモードなし。全ソースを一括検証する。

## 検証対象ファイル

各ソースに対して以下の8ファイルの存在を確認する:

- `stops.json`
- `routes.json`
- `calendar.json`
- `timetable.json`
- `shapes.json`
- `agency.json`
- `feed-info.json`
- `translations.json`

## カレンダー鮮度チェック

`calendar.json` の各サービスの `end_date` (YYYYMMDD) を確認する。

| 状態                      | 判定    | exit code への影響 |
| ------------------------- | ------- | ------------------ |
| `end_date` < 今日         | expired | EXIT_ERROR (2)     |
| `end_date` <= 今日 + 30日 | warning | EXIT_WARN (1)      |
| `end_date` > 今日 + 30日  | ok      | なし               |

## 出力例

```
=== Validate generated data (pipeline/build/data) ===

Loading source definitions...
  Found 4 sources: sggsm, tobus, toaran, yrkm

--- [1/2] File existence check ---

  sggsm:
    stops.json ......... OK
    routes.json ........ OK
    ...
  Result: 24/24 files present.

--- [2/2] Calendar freshness check ---

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

| code | label   | 意味                                     |
| ---- | ------- | ---------------------------------------- |
| 0    | ok      | 全チェック通過                           |
| 1    | warning | 警告のみ (期限間近のサービスあり)        |
| 2    | error   | エラー (ファイル欠損 / 期限切れ / fatal) |

`runMain` の fatal error 時も exit code 2 を使用する (スクリプト固有の `EXIT_ERROR` 定数に合わせるため)。

## GitHub Actions 連携

`GITHUB_ACTIONS=true` 環境変数が設定されている場合、ワークフローコマンドを出力する:

- 警告: `::warning::` アノテーション
- エラー: `::error::` アノテーション

出力にはワークフローコマンドインジェクション対策のサニタイズ処理が含まれる (`%`, `\r`, `\n` のエスケープ)。

## Markdown サマリ

検証結果を Markdown 形式でも出力する。GitHub Actions の Job Summary に使用可能。
