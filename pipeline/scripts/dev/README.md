# Dev Scripts

開発/調査用スクリプト群。手動実行のみ (CI では使用しない)。

## スクリプト一覧

| スクリプト                          | 対象データ                                                   | 概要                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `describe-resources.ts`             | `pipeline/config/resources/` (リソース定義)                  | リソース定義の一覧表示 (`npm run pipeline:describe`)                                                                   |
| `find-joint-routes.ts`              | `public/data/` (生成済み JSON)                               | 共同運行路線の検出。ソース間で route_short_name が一致する路線を検出し、停留所名の突き合わせと座標による近接分析を行う |
| `analyze-gtfs-stop-times.ts`        | `pipeline/workspace/_build/db/` (SQLite DB)                  | GTFS stop_times パターン分析 (terminal-only stops, circular routes, pickup/drop-off types 等)                          |
| `analyze-gtfs-routes.ts`            | `pipeline/workspace/data/gtfs/` (`routes.txt`)               | GTFS `routes.txt` の names / route_type / colors / cEMV / continuous fields 等を source ごとに集計する                 |
| `analyze-odpt-station-timetable.ts` | `pipeline/workspace/data/odpt-json/` (ODPT JSON)             | ODPT StationTimetable データパターン分析 (time field availability, station/direction/calendar coverage 等)             |
| `analyze-v2-name-fields.ts`         | `public/data-v2/` (生成済み V2 DataBundle)                   | 定義済みの名称系調査対象について、V2 JSON 上の `nonEmpty` / `empty` 件数を source ごとに集計する                       |
| `analyze-v2-insights.ts`            | `public/data-v2/<source>/insights.json` (InsightsBundle)     | InsightsBundle の 4 セクション (serviceGroups / tripPatternStats / tripPatternGeo / stopStats) を source 別に集計する  |
| `analyze-v2-global-insights.ts`     | `public/data-v2/global/insights.json` (GlobalInsightsBundle) | GlobalInsightsBundle の `stopGeo` を source 別に集計する (stop 件数、`wp`/`cn` カバレッジ、`nr` 分布)                  |

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

## `analyze-gtfs-routes.ts`

GTFS source ごとの `routes.txt` を読み、routes.txt 単独で把握できる current-state section を source ごとに出力する。

- 入力: `pipeline/workspace/data/gtfs/<source>/routes.txt`
- 出力形式: text report
- 引数: 0 個で全 source、1 個以上で指定 source 群のみ、`--list-sources`、`--list-sections`、`--section <name>`
- 主な section: - `Identity and names` - `Route types` - `Color fields` - `cEMV support` - `Continuous service fields` - `Optional presentation / operational fields`
- routes.txt 単独の current-state 集計に限定し、stop_times や他 file との突合はまだ行わない
- CSV は quoted field を考慮して既存の GTFS CSV parser を使う

## `analyze-gtfs-stop-times.ts`

GTFS source ごとの build 済み DB を読み、stop_times/current trip structure から把握できる section を source ごとに出力する。

- 入力: `pipeline/workspace/_build/db/<source>.db`
- 出力形式: text report
- 引数: 0 個で全 source、1 個以上で指定 source 群のみ、`--list-sources`、`--list-sections`、`--section <name>`
- 主な section: - `stop-position-summary` - `terminal-only-stops` - `circular-routes` - `dwell-time-stops` - `terminal-time-pattern` - `pickup-drop-off-type-usage` - `pass-through-stops` - `interpolation` - `headsign-coverage`

## `analyze-odpt-station-timetable.ts`

ODPT Train source ごとの `StationTimetable` JSON を読み、時刻 field / coverage / destination / train type などの section を source ごとに出力する。

- 入力: `pipeline/workspace/data/odpt-json/<source>/odpt_StationTimetable.json`
- 出力形式: text report
- 引数: 0 個で全 source、1 個以上で指定 source 群のみ、`--list-sources`、`--list-sections`、`--section <name>`
- 主な section: - `time-field-availability` - `station-coverage` - `direction-coverage` - `calendar-coverage` - `destination-distribution` - `train-type-distribution` - `flags` - `unknown-keys`

## `analyze-v2-insights.ts`

生成済み `insights.json` を source prefix ごとに読み、所要時間統計を text report として出力する。

- 入力: `public/data-v2/<source>/insights.json`
- 出力形式: text report
- 引数: 0 個で全 source、1 個以上で指定 source 群のみ、`--list-sources`、`--list-sections`、`--section <name>`
- 主な section: - `service-groups` - `trip-pattern-stats` - `trip-pattern-geo` - `stop-stats`

## `analyze-v2-global-insights.ts`

生成済み `global/insights.json` を読み、`stopGeo` の各 section を text report として出力する。

- 入力: `public/data-v2/global/insights.json`
- 出力形式: text report
- 引数: `--list-sections`、`--section <name>`
- 主な section: - `summary` - `nr-distribution` - `isolation-buckets` - `connectivity` - `hub-counts` - `walkable-portal` - `most-isolated-stops` - `most-connected-stops` - `busiest-neighborhoods`

## 実行方法

```bash
# 入口スクリプトから選択実行
npm run pipeline:dev-tools

# 個別実行
npx tsx pipeline/scripts/dev/describe-resources.ts
npx tsx pipeline/scripts/dev/find-joint-routes.ts
npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts
npx tsx pipeline/scripts/dev/analyze-gtfs-routes.ts
npx tsx pipeline/scripts/dev/analyze-odpt-station-timetable.ts
npx tsx pipeline/scripts/dev/analyze-v2-name-fields.ts
npx tsx pipeline/scripts/dev/analyze-v2-insights.ts
npx tsx pipeline/scripts/dev/analyze-v2-global-insights.ts
```
