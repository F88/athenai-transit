# Analysis Scripts

リソース定義の確認、リモートデータの更新チェック、生成済みデータの品質分析など、パイプライン運用に関する分析スクリプト群。

## スクリプト一覧

| スクリプト                | 対象データ                                       | 概要                                                                                                                   |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `describe-resources.ts`   | `pipeline/resources/` (リソース定義)             | リソース定義の一覧表示 (`npm run pipeline:describe`)                                                                   |
| `check-odpt-resources.ts` | ODPT API + `pipeline/state/` (リモート/ローカル) | ODPT Members Portal API でリソース更新チェック (`npm run pipeline:check:odpt-resources`)                               |
| `find-joint-routes.ts`    | `public/data/` (生成済み JSON)                   | 共同運行路線の検出。ソース間で route_short_name が一致する路線を検出し、停留所名の突き合わせと座標による近接分析を行う |

## 実行方法

```bash
# 入口スクリプトから選択実行
npm run pipeline:dev-tools

# 個別実行
npx tsx pipeline/scripts/analysis/describe-resources.ts
npx tsx pipeline/scripts/analysis/check-odpt-resources.ts
npx tsx pipeline/scripts/analysis/find-joint-routes.ts
```

## check-odpt-resources

ODPT Members Portal API からリソースのメタデータを取得し、ローカルのダウンロード記録 (`pipeline/state/download-meta/`) と比較する。

### 使い方

```bash
npm run pipeline:check:odpt-resources              # 追跡中ソースのみ
npx tsx pipeline/scripts/analysis/check-odpt-resources.ts kanto-bus  # 単体
npx tsx pipeline/scripts/analysis/check-odpt-resources.ts --all      # 全 ODPT ソース
npx tsx pipeline/scripts/analysis/check-odpt-resources.ts --list     # 追跡ソース一覧
```

### 警告の種類

| 警告               | 意味                                         | Exit code     |
| ------------------ | -------------------------------------------- | ------------- |
| EXPIRED            | ローカルデータが期限切れ                     | 1 (critical)  |
| REMOVED            | ローカルのリソースがリモートから削除された   | 1 (critical)  |
| NO_VALID_DATA      | 有効なリソースが一つもない                   | 1 (critical)  |
| EXPIRING_SOON      | ローカルデータが 14 日以内に期限切れ         | 2 (attention) |
| NEW_RESOURCE       | 前回チェック以降に新しいリソースが追加された | 2 (attention) |
| NO_DOWNLOAD_REPORT | ダウンロード記録がない                       | 2 (attention) |

### 出力ファイル

- `pipeline/state/check-result/{source-name}.json` — チェック実行結果 (sourceName, checkedAt, resourceUrls, result, warnings, errors)。NEW_RESOURCE 検知の差分比較にも使用

### CI

`check-transit-resources.yml` で daily (UTC 05:00) に自動実行。`update-transit-data.yml` (UTC 04:00) の 1 時間後。
