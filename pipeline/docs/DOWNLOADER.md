# Downloader

パイプラインの Stage 1。リソース定義に基づき、外部 API からデータを取得してローカルに保存する。

## 概要

ダウンローダーはデータフォーマットごとに独立したスクリプトとして実装されている。

| スクリプト              | 対象      | 入力                                       | 出力                                 |
| ----------------------- | --------- | ------------------------------------------ | ------------------------------------ |
| `download-gtfs.ts`      | GTFS ZIP  | `pipeline/config/resources/gtfs/*.ts`      | `pipeline/workspace/data/gtfs/`      |
| `download-odpt-json.ts` | ODPT JSON | `pipeline/config/resources/odpt-json/*.ts` | `pipeline/workspace/data/odpt-json/` |

**ダウンローダーの責務はデータの取得と保存のみ**。バリデーションや変換は後続の build ステップが行う。

## CLI インターフェース

両スクリプトは同一の CLI インターフェースを持つ。

```
Usage: npx tsx pipeline/scripts/pipeline/download-<format>.ts <source-name>
       npx tsx pipeline/scripts/pipeline/download-<format>.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/download-<format>.ts --list
       npx tsx pipeline/scripts/pipeline/download-<format>.ts --help
```

| 引数               | 説明                                            |
| ------------------ | ----------------------------------------------- |
| `<source-name>`    | 単体実行。リソース定義のファイル名 (拡張子なし) |
| `--targets <file>` | バッチ実行。targets ファイルのパスを指定        |
| `--list`           | 利用可能なソース名を一覧表示                    |
| `--help`           | ヘルプ表示                                      |

## 単体実行

```bash
# GTFS (認証不要のソース)
npx tsx pipeline/scripts/pipeline/download-gtfs.ts toei-bus

# ODPT JSON (認証必要)
npx tsx --env-file=pipeline/.env.pipeline.local pipeline/scripts/pipeline/download-odpt-json.ts yurikamome-station
```

### 出力例

```
=== yurikamome-station [START] ===

  Format: ODPT-JSON
  Name: ゆりかもめ 駅情報 (Yurikamome Station)
  Provider: ゆりかもめ
  License: CC BY 4.0
  Output: yurikamome/ (prefix: yurimo)

Downloading https://api.odpt.org/api/v4/odpt:Station?odpt:operator=odpt.Operator:Yurikamome
  Filename: odpt_Station.json
  Size: 15,822 bytes
  Content-Type: application/json; charset=utf-8
  Duration: 0.1s
  Archived: pipeline/workspace/_archives/odpt-json/yurikamome/odpt_Station_20260312-130308.json

Saved to pipeline/workspace/data/odpt-json/yurikamome/
  odpt_Station.json            15,822 bytes

Exit code: 0 (ok)
=== yurikamome-station [END] ===
```

## バッチ実行

`--targets` オプションで targets ファイルに定義されたソースを順次実行する。

```bash
# npm script (ローカル開発用、--env-file-if-exists 付き)
npm run pipeline:download:gtfs
npm run pipeline:download:odpt-json

# 直接実行
npx tsx pipeline/scripts/pipeline/download-gtfs.ts --targets pipeline/config/targets/download-gtfs.ts
```

### Targets ファイル

`string[]` を `export default` する TypeScript ファイル。コメントアウトでソースを一時スキップできる。

```typescript
// pipeline/config/targets/download-gtfs.ts
export default [
    'toei-bus',
    'toei-train',
    // 'suginami-gsm',  // 一時スキップ
];
```

### エラー分離

各ソースは独立した子プロセスで実行される。1つのソースが失敗しても後続のソースは継続する。

### バッチ出力例

```
=== Batch download (3 targets) ===

=== toei-bus [START] ===
  ...
Exit code: 0 (ok)
=== toei-bus [END] ===

=== toei-train [START] ===
  ...
Exit code: 0 (ok)
=== toei-train [END] ===

=== suginami-gsm [START] ===
  ...
Exit code: 1 (error)
=== suginami-gsm [END] ===

=== Batch Summary ===

  toei-bus                       OK       3.2s
  toei-train                     OK       2.8s
  suginami-gsm                   FAILED   4.1s

  Total: 3 sources, 2 succeeded, 1 failed (10.1s)

Exit code: 1 (partial failure)
```

## Exit Code

### 単体実行

| code | label | 意味 |
| ---- | ----- | ---- |
| 0    | ok    | 成功 |
| 1    | error | 失敗 |

### バッチ実行

| code | label           | 意味     | CI での挙動    |
| ---- | --------------- | -------- | -------------- |
| 0    | ok              | 全て成功 | 続行           |
| 1    | partial failure | 一部失敗 | 続行 (warning) |
| 2    | all failed      | 全て失敗 | 停止           |

## 認証

ODPT API の認証が必要なソースは `ODPT_ACCESS_TOKEN` 環境変数を参照する。リソース定義の `authentication.required` が `true` の場合にトークンが要求される。

### ローカル開発

`pipeline/.env.pipeline.local` にトークンを記述する (gitignored)。

```bash
# pipeline/.env.pipeline.local
ODPT_ACCESS_TOKEN=your-token-here
```

npm script は `--env-file-if-exists=pipeline/.env.pipeline.local` で自動読み込みする。ファイルが存在しない場合はエラーにならず無視される (Node.js 21.7+ の機能)。

### CI (GitHub Actions)

secrets から環境変数として注入する。`.env` ファイルは使わない。

```yaml
- name: Download ODPT JSON data
  env:
      ODPT_ACCESS_TOKEN: ${{ secrets.ODPT_ACCESS_TOKEN }}
  run: npx tsx pipeline/scripts/pipeline/download-odpt-json.ts --targets pipeline/config/targets/download-odpt-json.ts
```

### セキュリティ

エラーメッセージにアクセストークンが露出しないよう、ログには認証パラメータを含まないエンドポイント URL のみを表示する。認証済み URL は fetch にのみ使用され、ログや例外メッセージには渡されない。

## リトライ

ネットワークエラー時に exponential backoff で最大3回リトライする。

| 試行  | 待機時間 |
| ----- | -------- |
| 1回目 | 即時     |
| 2回目 | 1秒後    |
| 3回目 | 2秒後    |

タイムアウトは1リクエストあたり60秒。

## アーカイブ

ダウンロードしたファイルはタイムスタンプ付きで `pipeline/workspace/_archives/` にも保存される。データの履歴を追跡するため。

```
pipeline/workspace/_archives/
├── gtfs/
│   └── toei-bus/
│       ├── ToeiBus-GTFS_20260312-130000.zip
│       └── ToeiBus-GTFS_20260311-130000.zip
└── odpt-json/
    └── yurikamome/
        ├── odpt_Station_20260312-130308.json
        └── odpt_Station_20260311-130000.json
```

`pipeline/workspace/_archives/` は gitignored。

## 共有ユーティリティ

ダウンローダーが使用するユーティリティは2つのモジュールに分かれている。

### `pipeline/src/lib/download-utils.ts`

ダウンロード固有のユーティリティ。

| export              | 説明                                    |
| ------------------- | --------------------------------------- |
| `downloadWithRetry` | HTTP ダウンロード + リトライ + 進捗表示 |
| `withRetry`         | exponential backoff リトライ            |
| `wrapTimeoutError`  | タイムアウトエラーへのコンテキスト付与  |
| `archiveFilename`   | タイムスタンプ付きファイル名生成        |
| `timestamp`         | `YYYYMMDD-HHmmss` タイムスタンプ        |
| `FETCH_TIMEOUT_MS`  | タイムアウト定数 (60秒)                 |
| `MAX_RETRIES`       | リトライ回数定数 (3回)                  |

### `pipeline/src/lib/download-meta.ts`

ダウンロードジョブの結果を `pipeline/workspace/state/download-meta/{source-name}.json` に記録する。成功時はファイルサイズ、Content-Type、展開ファイル一覧、feed_info 情報を含む。エラー時はエラーメッセージを記録する。

記録されたメタデータは `check-odpt-resources.ts` がリモートリソースとの比較に使用する。

### `pipeline/src/lib/gtfs-feed-info.ts`

GTFS の展開済み `feed_info.txt` をパースして構造化データに変換する。`download-meta.ts` がダウンロード後の記録に使用する。

### `pipeline/src/lib/pipeline-utils.ts`

全パイプラインスクリプト共通のユーティリティ。

| export                   | 説明                                 |
| ------------------------ | ------------------------------------ |
| `runMain`                | トップレベルエラーハンドラ           |
| `parseCliArg`            | CLI 引数パース (discriminated union) |
| `runBatch`               | バッチ実行 (子プロセス分離)          |
| `printBatchSummary`      | バッチ結果サマリ表示                 |
| `determineBatchExitCode` | バッチ結果から exit code を決定      |
| `formatExitCode`         | exit code のラベル付き文字列         |
| `formatBytes`            | バイト数の人間可読フォーマット       |
| `ensureDir`              | ディレクトリ作成                     |
| `loadTargetFile`         | targets ファイルの読み込み           |
