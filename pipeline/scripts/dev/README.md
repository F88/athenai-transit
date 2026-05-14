# Dev Scripts

開発/調査用スクリプト群。手動実行のみ (CI では使用しない)。

## スクリプト一覧

| スクリプト                          | 対象データ                                                   | 概要                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `describe-resources.ts`             | `pipeline/config/resources/` (リソース定義)                  | リソース定義の一覧表示 (`npm run pipeline:describe`)                                                                                  |
| `find-joint-routes.ts`              | `public/data/` (生成済み JSON)                               | 共同運行路線の検出。ソース間で route_short_name が一致する路線を検出し、停留所名の突き合わせと座標による近接分析を行う                |
| `analyze-gtfs-stop-times.ts`        | `pipeline/workspace/_build/db/` (SQLite DB)                  | GTFS stop_times パターン分析 (terminal-only stops, circular routes, pickup/drop-off types 等)                                         |
| `analyze-gtfs-routes.ts`            | `pipeline/workspace/data/gtfs/` (`routes.txt`)               | GTFS `routes.txt` の names / route_type / colors / cEMV / continuous fields 等を source ごとに集計する                                |
| `analyze-odpt-station-timetable.ts` | `pipeline/workspace/data/odpt-json/` (ODPT JSON)             | ODPT StationTimetable データパターン分析 (time field availability, station/direction/calendar coverage 等)                            |
| `analyze-v2-name-fields.ts`         | `public/data-v2/` (生成済み V2 DataBundle)                   | 定義済みの名称系調査対象について、V2 JSON 上の `nonEmpty` / `empty` 件数を source ごとに集計する                                      |
| `analyze-v2-insights.ts`            | `public/data-v2/<source>/insights.json` (InsightsBundle)     | InsightsBundle の 4 セクション (serviceGroups / tripPatternStats / tripPatternGeo / stopStats) を source 別に集計する                 |
| `analyze-v2-global-insights.ts`     | `public/data-v2/global/insights.json` (GlobalInsightsBundle) | GlobalInsightsBundle の `stopGeo` を source 別に集計する (stop 件数、`wp`/`cn` カバレッジ、`nr` 分布)                                 |
| `summarize-v2-outputs.ts`           | `public/data-v2/<source>/{data,insights,shapes}.json`        | V2 pipeline 出力を bundle 横断で source 別に要約する (file size / gzip size / DataBundle 件数 / InsightsBundle tripsTotal / tripsMax) |

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

## `summarize-v2-outputs.ts`

生成済み V2 pipeline 出力 (`public/data-v2/<source>/`) を bundle 横断で source 別に要約する text report を出す。
構造は **entry → main lib → sub libs** の 3 層:

- entry: `pipeline/scripts/dev/summarize-v2-outputs.ts` (I/O のみ)
- main lib: `pipeline/scripts/dev/dev-lib/v2-outputs-summary.ts` (section dispatch、 union 化、 全体整形)
- sub libs (per data source):
    - `pipeline/scripts/dev/dev-lib/v2-data-summary.ts` (DataBundle + file-sizes / gzip-sizes)
    - `pipeline/scripts/dev/dev-lib/v2-insights-summary.ts` (InsightsBundle 由来の trip-volume)
    - `pipeline/scripts/dev/dev-lib/v2-shapes-summary.ts` (ShapesBundle 由来の geometry 件数)
- sub lib (per all data sources):
    - `pipeline/scripts/dev/dev-lib/v2-global-insights-summary.ts` (GlobalInsightsBundle 由来、 single artifact)

各 sub lib は 1 bundle に責務を持ち、 main lib は sub lib を組み合わせて section を直列出力する。 global-insights は per-source ではない単一 artifact なので main lib の dispatch が分岐 (rows ではなく単一値オブジェクトを受ける render を呼ぶ)。 sub libs だけでは作れない合成派生指標 (例: bytes-per-trip) は main lib に置ける。

- 入力: `public/data-v2/<source>/data.json`、 `insights.json` (任意)、 `shapes.json` (任意)、 `public/data-v2/global/insights.json` (任意)
- 出力形式: text report
- 引数: 0 個で全 source、 1 個以上で指定 source 群のみ、 `--list-sources`、 `--list-sections`、 `--section <name>`
- 主な section:
    - `file-sizes` ・・・ data.json / insights.json / shapes.json の raw byte 数
    - `gzip-sizes` ・・・ 同 3 ファイルの gzip 圧縮後 byte 数 (配信ペイロードの目安)
    - `counts` ・・・ DataBundle 由来の件数 (stops / routes / agency / calendar / feedInfo / timetable / tripPatterns / translations / lookup)。 配列 → length、 オブジェクト → top-level キー数の generic ルール。 schema 変更に追従
    - `feed-info` ・・・ FeedInfoJson のみから抽出した feed 識別情報 (publisher / lang / feedValidity)。 `pu` / `v` は summary では割愛
    - `agencies` ・・・ AgencyV2Json 由来の事業者 identity (count / names / timezones)。 多 agency source (ntbus=5 等) は names を `, ` 結合、 timezones は重複除去
    - `routes` ・・・ RouteV2Json 由来の route inventory。 detail sub-section (Route types / Naming / Colors / Description) + roll-up Summary 構造。 各 facet は presence count のみ (組合せ分類は analyze-gtfs-routes 担当)
    - `stops` ・・・ StopV2Json 由来の per-stop 属性集約。 detail sub-section (Location types / Hierarchy / Accessibility / Supplementary fields / Geography) + roll-up Summary 構造。 location_type 分布・lat/lon bbox を Summary に、 parent_station coverage・`wheelchair_boarding === 1` 件数・supplementary fields (platform_code / stop_desc / stop_url の coverage) は個別 sub-section に出す。 stop_desc / stop_url は `lookup` セクション在住だが stop_id キーの per-stop 属性なので stops 側で集計する
    - `trip-patterns` ・・・ TripPatternJson 由来の trip pattern inventory。 tripPattern は GTFS 標準ではなく Athenai 内部の抽象 (route + headsign + direction + stop 列のユニーク組合せ)。 TripPatternJson は summarize 対象の情報が少ないので単一 Summary テーブル (sub-section 化しない)。 `directionCounts` は direction_id の `0:X, 1:Y, none:Z` breakdown (ODPT 系は direction_id を持たず全て none)、 `withTripHeadsign` / `withStopHeadsign` は trip-level (`h`) / stop-level (`stops[].sh`) headsign を持つパターン数 (両者で source の headsign 慣習が分かる ── kobus 等は trip_headsign が空で stop_headsign 慣習)
    - `i18n-coverage` ・・・ TranslationsJson 由来の多言語カバレッジ (`langs` union + 6 マップそれぞれの entry 件数)
    - `periods` ・・・ 期間に関する情報を統合 (feedValidity / servicePeriod / exceptionRange)。 feedInfo + calendar.services + calendar.exceptions の 3 軸を 1 行で横並びにし、 「feedInfo は空でも calendar が補う」等の対応関係が見える
    - `trip-volume` ・・・ InsightsBundle 由来の trip 量 2 値: `tripsTotal` (= 全 sg × pattern の freq 合算 = trips.txt 行数、 day-agnostic) と `tripsMax` (= 最も賑わう sg の便数 = peak day)。 sg 分布が heavy-tailed な source (vagfr 等) で median が破綻していた問題を解消した max 寄り 2 値
    - `shapes-counts` ・・・ ShapesBundle 由来の routes / polylines / points / totalLengthKm (allocation-free Haversine 合計)
    - `global-insights` ・・・ GlobalInsightsBundle (`global/insights.json`) の stopGeo カバレッジ ── `wp` (parent_station 距離) / `cn` (300m connectivity、 service group 別) を持つ stop の割合。 per-source ではない単一ブロック。 stopGeo の entry 数自体は `global-insights-counts` に出す
- `shapes.json` / `insights.json` / `global/insights.json` が存在しない場合は対応欄を `-` で表示する (`0` は空ファイルを意味する別状態)
- `global-insights` セクションは datasource-id 指定の有無に関わらず常時処理される (single artifact のため source 軸でフィルタする概念がない)
- byte 表記は 1024 進数 (>=1 MiB は MB、 >=1 KiB は KB、 それ未満は B)

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
npx tsx pipeline/scripts/dev/summarize-v2-outputs.ts
```
