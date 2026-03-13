# Describe Resources

全リソース定義を人間可読な形式で出力する。

## 概要

| 項目 | 内容                                                                |
| ---- | ------------------------------------------------------------------- |
| 入力 | `pipeline/resources/gtfs/*.ts`, `pipeline/resources/odpt-json/*.ts` |
| 出力 | stdout (テキスト / TSV)                                             |

GTFS ソースと ODPT JSON ソースの全リソース定義を読み込み、一覧を出力する。データの変換や検証は行わない。

## CLI インターフェース

```
Usage: npx tsx pipeline/scripts/describe-resources.ts [options]
       npm run pipeline:describe
```

| 引数/オプション | 説明                          |
| --------------- | ----------------------------- |
| (引数なし)      | サマリ表示 (--summary と同じ) |
| `--summary`     | サマリテーブル                |
| `--verbose`     | 詳細表示                      |
| `--format tsv`  | TSV 形式で出力                |
| `--help, -h`    | ヘルプ表示                    |

## 出力モード

### Summary (デフォルト)

```
=== Resource Definitions (6 total) ===

GTFS Sources (3):

  suginami-gsm  sggsm   杉並区グリーンスローモビリティ (...)  GTFS-JP      auth:no  [bus]
  toei-bus      tobus   都営バス (Toei Bus)                   GTFS-JP 3.0  auth:no  [bus]
  toei-train    toaran  都営電車 (Toei Train)                 GTFS-JP 3.0  auth:no  [tram, subway, ...]

ODPT JSON Sources (3):
  ...
```

### Verbose

各ソースの詳細情報 (名前、プレフィックス、フォーマット、プロバイダ、ライセンス、URL 等) を表示する。

### TSV

ヘッダー付きのタブ区切り出力。スプレッドシートや他ツールへの連携に使用する。

## Exit Code

| code | 意味                        |
| ---- | --------------------------- |
| 0    | 成功                        |
| 1    | エラー (不正な引数 / fatal) |
