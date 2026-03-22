# V2 Build Insights (InsightsBundle)

DataBundle から分析データを導出し、`insights.json` (InsightsBundle) を生成する。

## 概要

| 項目       | 内容                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| 入力       | `pipeline/workspace/_build/data-v2/{prefix}/data.json` (DataBundle)                            |
| 出力       | `pipeline/workspace/_build/data-v2/{prefix}/insights.json` (InsightsBundle)                    |
| スクリプト | `pipeline/scripts/pipeline/app-data-v2/build-insights.ts`                                      |
| lib        | `pipeline/src/lib/pipeline/app-data-v2/build-service-groups.ts`, `bundle-writer.ts`            |
| テスト     | `build-service-groups.test.ts` (10), `bundle-writer.test.ts` (4), `build-insights.test.ts` (5) |

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts <prefix>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --list
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --help
       npm run pipeline:build:v2-insights
```

| 引数/オプション    | 説明                                   |
| ------------------ | -------------------------------------- |
| `<prefix>`         | 単体実行。prefix を指定 (例: minkuru)  |
| `--targets <file>` | ターゲットリストファイルで一括ビルド   |
| `--list`           | data.json が存在する prefix 一覧を表示 |
| `--help, -h`       | ヘルプ表示                             |

### data.json が存在しない場合

単体実行時、指定 prefix の `data.json` が存在しない場合はスキップ (exit 0)。バッチ実行時は `runBatch` による子プロセス実行。

## InsightsBundle 構成

InsightsBundle は per-source の分析データを格納する。必須セクション1つ + 任意セクション3つ。

| セクション       | 状態   | キー構造                       | 内容                                   |
| ---------------- | ------ | ------------------------------ | -------------------------------------- |
| serviceGroups    | 実装済 | —                              | 曜日パターンによるサービスグルーピング |
| tripPatternStats | 未実装 | service group key → pattern ID | 運行頻度、残り所要時間                 |
| tripPatternGeo   | 未実装 | pattern ID                     | 直線距離、経路距離、循環フラグ         |
| stopStats        | 未実装 | service group key → stop ID    | 運行頻度、路線数、最早/最終出発時刻    |

## serviceGroups 導出アルゴリズム

`buildServiceGroups(calendar: CalendarJson): ServiceGroupEntry[]`

### 処理フロー

1. 各 service の `d` 配列 (例: `[1,1,1,1,1,0,0]`) を文字列キーに変換
2. 同じパターンの service_id をグループにまとめる
3. パターンから短縮キーを自動生成
4. 優先度順にソート

### キー命名規則

| パターン          | キー      | 説明           |
| ----------------- | --------- | -------------- |
| `[1,1,1,1,1,0,0]` | `wd`      | weekday        |
| `[0,0,0,0,0,1,0]` | `sa`      | saturday       |
| `[0,0,0,0,0,0,1]` | `su`      | sunday         |
| `[0,0,0,0,0,1,1]` | `wk`      | weekend        |
| `[1,1,1,1,1,1,1]` | `all`     | every day      |
| その他            | `d{bits}` | 例: `d1010100` |

### 優先度順ソート

1. 既知キー: `wd` → `sa` → `su` → `wk` → `all`
2. 未知キー: アルファベット順

### 制約

- 各 service_id は正確に1つのグループにのみ所属する
- 配列の順序が優先度 (先頭が最も一般的な曜日タイプ)
- `calendar_dates` exceptions はグルーピングに影響しない (実行時のマッチングで処理)

### 実データの例

| ソース名     | service groups   |
| ------------ | ---------------- |
| toei-bus     | wd, sa, su       |
| suginami-gsm | all              |
| yurikamome   | wd, wk           |
| toei-train   | wd, sa, su, wk   |
| chiyoda-bus  | wd, wk, d0011111 |

## 出力形式

```json
{
  "bundle_version": 2,
  "kind": "insights",
  "serviceGroups": {
    "v": 1,
    "data": [
      { "key": "wd", "serviceIds": ["minkuru:01-170", "minkuru:06-170", ...] },
      { "key": "sa", "serviceIds": ["minkuru:02-170", ...] },
      { "key": "su", "serviceIds": ["minkuru:03-170", ...] }
    ]
  }
}
```

optional セクション (tripPatternStats, tripPatternGeo, stopStats) は実装時に追加される。アプリ側は各セクションの有無で表示機能を切り替える。

## 実装構成

| ファイル                                                        | 役割                                |
| --------------------------------------------------------------- | ----------------------------------- |
| `pipeline/src/lib/pipeline/app-data-v2/build-service-groups.ts` | serviceGroups 導出 (pure function)  |
| `pipeline/src/lib/pipeline/app-data-v2/bundle-writer.ts`        | InsightsBundle の atomic write      |
| `pipeline/scripts/pipeline/app-data-v2/build-insights.ts`       | CLI スクリプト (単体/バッチ/リスト) |
| `pipeline/config/targets/build-v2-insights.ts`                  | バッチ対象ソースリスト              |
