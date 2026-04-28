# V2 App Data (DataBundle)

v2 パイプラインの DataBundle (`data.json`) ビルドに関する処理フローと実装リファレンス。

型仕様は `src/types/data/transit-v2-json.ts` を参照 (TSDoc で各セクション・フィールドを詳述)。

## 処理フロー

### GTFS ソースの処理フロー

```text
SQLite DB → extractStopsV2
          → extractRoutesV2
          → extractCalendarV2
          → extractAgenciesV2
          → extractFeedInfoV2
          → extractTranslationsV2
          → extractLookupV2
          → extractTripPatternsAndTimetable
          → writeDataBundle (atomic write)
```

### ODPT Train ソースの処理フロー

```text
ODPT JSON → buildStopsV2
           → buildRoutesV2
           → buildCalendarV2
           → buildAgencyV2
           → buildFeedInfoV2
           → buildTranslationsV2
           → buildTripPatternsAndTimetableFromOdpt
           → writeDataBundle (atomic write)
```

## 実装構成

| ファイル                                                                         | 役割                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts`                       | GTFS CLI スクリプト                                           |
| `pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts`                 | ODPT Train CLI スクリプト                                     |
| `pipeline/src/lib/pipeline/app-data-v2/gtfs/extract-*.ts`                        | GTFS セクション抽出 (8ファイル)                               |
| `pipeline/src/lib/pipeline/app-data-v2/odpt-common/build-*.ts`                   | ODPT 共通セクション (Operator / FeedInfo、2 ファイル)         |
| `pipeline/src/lib/pipeline/app-data-v2/odpt-train/build-*.ts`                    | ODPT Train builders (5 ファイル)                              |
| `pipeline/src/lib/pipeline/app-data-v2/odpt-train/infer-odpt-trips-heuristic.ts` | ODPT Train 用 trip-identity 推論 heuristic (Yurikamome-tuned) |
| `pipeline/src/lib/pipeline/app-data-v2/bundle-writer.ts`                         | DataBundle 書き込み                                           |
| `src/types/data/transit-v2-json.ts`                                              | 型定義                                                        |

## Exit Code

| code | label           | 意味                |
| ---- | --------------- | ------------------- |
| 0    | ok              | 成功                |
| 1    | error / partial | 失敗 / 一部失敗     |
| 2    | all failed      | 全失敗 (バッチのみ) |
