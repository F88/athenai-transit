# Dev Scripts

開発/調査用スクリプト群。手動実行のみ (CI では使用しない)。

## スクリプト一覧

| スクリプト                          | 対象データ                                       | 概要                                                                                                                   |
| ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `describe-resources.ts`             | `pipeline/config/resources/` (リソース定義)      | リソース定義の一覧表示 (`npm run pipeline:describe`)                                                                   |
| `find-joint-routes.ts`              | `public/data/` (生成済み JSON)                   | 共同運行路線の検出。ソース間で route_short_name が一致する路線を検出し、停留所名の突き合わせと座標による近接分析を行う |
| `analyze-gtfs-stop-times.ts`        | `pipeline/workspace/_build/db/` (SQLite DB)      | GTFS stop_times パターン分析 (terminal-only stops, circular routes, pickup/drop-off types 等)                          |
| `analyze-odpt-station-timetable.ts` | `pipeline/workspace/data/odpt-json/` (ODPT JSON) | ODPT StationTimetable データパターン分析 (time field availability, station/direction/calendar coverage 等)             |

## 実行方法

```bash
# 入口スクリプトから選択実行
npm run pipeline:dev-tools

# 個別実行
npx tsx pipeline/scripts/dev/describe-resources.ts
npx tsx pipeline/scripts/dev/find-joint-routes.ts
npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts
npx tsx pipeline/scripts/dev/analyze-odpt-station-timetable.ts
```
