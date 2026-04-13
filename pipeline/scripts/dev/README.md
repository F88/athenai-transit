# Dev Scripts

開発/調査用スクリプト群。手動実行のみ (CI では使用しない)。

## スクリプト一覧

| スクリプト                          | 対象データ                                       | 概要                                                                                                                   |
| ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `describe-resources.ts`             | `pipeline/config/resources/` (リソース定義)      | リソース定義の一覧表示 (`npm run pipeline:describe`)                                                                   |
| `find-joint-routes.ts`              | `public/data/` (生成済み JSON)                   | 共同運行路線の検出。ソース間で route_short_name が一致する路線を検出し、停留所名の突き合わせと座標による近接分析を行う |
| `analyze-gtfs-stop-times.ts`        | `pipeline/workspace/_build/db/` (SQLite DB)      | GTFS stop_times パターン分析 (terminal-only stops, circular routes, pickup/drop-off types 等)                          |
| `analyze-odpt-station-timetable.ts` | `pipeline/workspace/data/odpt-json/` (ODPT JSON) | ODPT StationTimetable データパターン分析 (time field availability, station/direction/calendar coverage 等)             |
| `analyze-v2-name-fields.ts`         | `public/data-v2/` (生成済み V2 DataBundle)       | 定義済みの名称系調査対象について、V2 JSON 上の `nonEmpty` / `empty` 件数を source ごとに集計する                       |

## `analyze-v2-name-fields.ts`

生成済み V2 DataBundle を読み、定義済みの名称系調査対象について source ごとの件数を出力する。

- 入力: `public/data-v2/<source>/data.json`
- 出力形式: TSV (`--field-counts-tsv`), JSON (`--json`), 単一 source 用テキスト
- 最小集計列: `source`, `field`, `nonEmpty`, `empty`
- 対象一覧は固定定義で、V2 に未出力の項目も行として出す
- V2 に未出力の項目は現時点では `nonEmpty=0`, `empty=0` として扱う

主な調査対象:

- V2 primary field: `routes.s`, `routes.l`, `agency.n`, `agency.sn`, `tripPatterns.h`, `stops.n`
- V2 translations: `translations.agency_names`, `translations.route_long_names`, `translations.route_short_names`, `translations.stop_names`, `translations.trip_headsigns`, `translations.stop_headsigns`
- V2 未出力の監査対象: `trips.trip_short_name`, `stops.tts_stop_name`, `agency_jp.agency_official_name`, `trips.jp_trip_desc`, `trips.jp_trip_desc_symbol`

> **Note**: `stop_times.stop_headsign` は `tripPatterns.stops[].sh` として出力されるようになったため、未出力リストから除外した。

## 実行方法

```bash
# 入口スクリプトから選択実行
npm run pipeline:dev-tools

# 個別実行
npx tsx pipeline/scripts/dev/describe-resources.ts
npx tsx pipeline/scripts/dev/find-joint-routes.ts
npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts
npx tsx pipeline/scripts/dev/analyze-odpt-station-timetable.ts
npx tsx pipeline/scripts/dev/analyze-v2-name-fields.ts
```
