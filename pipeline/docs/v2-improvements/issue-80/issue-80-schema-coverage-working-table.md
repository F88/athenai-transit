# Issue #80 Schema Coverage Working Table

Issue: #80 `Audit GTFS/GTFS-JP Schema Coverage In V2 Output`

これは full schema audit 用の作業台である。まず table 単位の field inventory を固定し、分類が確認できた field から埋める。

## 分類ルール

- `emitted-primary`
- `emitted-translations`
- `emitted-lookup`
- `derived-not-direct`
- `intentionally-excluded`
- `not-emitted`
- `unknown-needs-review`

## 先に確定してよい field

| Field                            | Classification                            | Evidence summary                                                                       |
| -------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `routes.route_short_name`        | `emitted-primary`                         | `RouteV2Json.s` として出力される。                                                     |
| `routes.route_long_name`         | `emitted-primary`, `emitted-translations` | `RouteV2Json.l` と `translations.route_names` の両方に現れる。                         |
| `routes.route_desc`              | `emitted-primary`                         | `RouteV2Json.desc` として保持される。                                                  |
| `stops.stop_name`                | `emitted-primary`, `emitted-translations` | `StopV2Json.n` と `translations.stop_names` に現れる。                                 |
| `stops.stop_desc`                | `emitted-lookup`                          | lookup の `stopDescs` に退避される。                                                   |
| `trips.trip_headsign`            | `emitted-primary`, `emitted-translations` | `tripPatterns[*].h` と `translations.headsigns` に現れる。                             |
| `stop_times.stop_headsign`       | `emitted-translations`                    | `extractTranslationsV2()` が明示的に読む。                                             |
| `agency.agency_name`             | `emitted-primary`, `emitted-translations` | `agency[].n` と `translations.agency_names` に現れる。                                 |
| `agency.agency_short_name`       | `derived-not-direct`                      | GTFS schema field ではなく provider metadata 由来。                                    |
| `agency.agency_id`               | `emitted-primary`                         | `agency[].i` に prefix 付き ID として出力される。                                      |
| `agency.agency_url`              | `emitted-primary`                         | `agency[].u` として出力される。                                                        |
| `agency.agency_lang`             | `emitted-primary`                         | `agency[].l` として出力される。                                                        |
| `agency.agency_timezone`         | `emitted-primary`                         | `agency[].tz` として出力される。                                                       |
| `agency.agency_fare_url`         | `emitted-primary`                         | `agency[].fu` として出力される。                                                       |
| `agency.agency_phone`            | `not-emitted`                             | schema にはあるが `extractAgenciesV2()` の SELECT に含まれず、V2 型にも field がない。 |
| `agency.agency_email`            | `not-emitted`                             | schema にはあるが `extractAgenciesV2()` の SELECT に含まれず、V2 型にも field がない。 |
| `feed_info.feed_publisher_name`  | `emitted-primary`                         | `feedInfo.pn` として出力される。                                                       |
| `feed_info.feed_publisher_url`   | `emitted-primary`                         | `feedInfo.pu` として出力される。                                                       |
| `feed_info.feed_lang`            | `emitted-primary`                         | `feedInfo.l` として出力される。                                                        |
| `feed_info.feed_start_date`      | `emitted-primary`                         | `feedInfo.s` として出力される。                                                        |
| `feed_info.feed_end_date`        | `emitted-primary`                         | `feedInfo.e` として出力される。                                                        |
| `feed_info.feed_version`         | `emitted-primary`                         | `feedInfo.v` として出力される。                                                        |
| `feed_info.default_lang`         | `not-emitted`                             | schema にはあるが `extractFeedInfoV2()` の SELECT に含まれず、V2 型にも field がない。 |
| `feed_info.feed_contact_email`   | `not-emitted`                             | schema にはあるが `extractFeedInfoV2()` の SELECT に含まれず、V2 型にも field がない。 |
| `feed_info.feed_contact_url`     | `not-emitted`                             | schema にはあるが `extractFeedInfoV2()` の SELECT に含まれず、V2 型にも field がない。 |
| `trips.trip_short_name`          | `not-emitted`                             | schema にはあるが `extractTripPatternsAndTimetable()` でも V2 型でも未対応。           |
| `stops.tts_stop_name`            | `not-emitted`                             | schema にはあるが app-data-v2 で未参照。                                               |
| `agency_jp.agency_official_name` | `intentionally-excluded`                  | `transit-v2-json.ts` の reviewed-and-excluded comment と整合。                         |
| `trips.jp_trip_desc`             | `intentionally-excluded`                  | `All jp_ extensions` の除外コメントと整合。                                            |
| `trips.jp_trip_desc_symbol`      | `intentionally-excluded`                  | `All jp_ extensions` の除外コメントと整合。                                            |

## Final Audit Summary

この section は、Phase 2 で想定していた `silent_loss_risk` と `evidence` を、監査判断に重要な field
について明示する最終サマリーである。下の Table Inventory は全 field の分類一覧、ここは完了判定用の要約とする。

既存 raw GTFS source における実値有無の確認結果は、重複を避けるため
[high-priority-schema-audit.md](./high-priority-schema-audit.md) の `Raw GTFS Source Check` section を正本とする。

| field                            | schema_table | schema_defined | pipeline_reads | v2_location                                                   | classification           | silent_loss_risk | notes                                                                                    | evidence                                                                         |
| -------------------------------- | ------------ | -------------- | -------------- | ------------------------------------------------------------- | ------------------------ | ---------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `routes.route_desc`              | `routes`     | `yes`          | `yes`          | `routes[].desc`                                               | `emitted-primary`        | `low`            | 既に primary field として出力されている。                                                | `gtfs-schema.ts`; `extract-routes.ts`; `transit-v2-json.ts`                      |
| `stops.stop_desc`                | `stops`      | `yes`          | `yes`          | `lookup.stopDescs`                                            | `emitted-lookup`         | `low`            | main record ではなく lookup へ移動済み。                                                 | `gtfs-schema.ts`; `extract-lookup.ts`; `transit-v2-json.ts`                      |
| `stop_times.stop_headsign`       | `stop_times` | `yes`          | `yes`          | `translations.stop_headsigns`                                 | `emitted-translations`   | `medium`         | translation-only なので source に translation row が無い場合は空になり得る。             | `gtfs-schema.ts`; `extract-translations.ts`                                      |
| `agency.agency_short_name`       | `agency`     | `no`           | `no`           | `agency[].sn`, `translations.agency_short_names`              | `derived-not-direct`     | `medium`         | raw GTFS field ではなく provider metadata 由来。schema coverage 本体とは別扱いが必要。   | `extract-agencies.ts`; `extract-translations.ts`                                 |
| `trips.trip_short_name`          | `trips`      | `yes`          | `no`           | `not present`                                                 | `not-emitted`            | `high`           | 表示用途の可能性が高いが、現行 extractor と V2 型のどちらにも載っていない。              | `gtfs-schema.ts`; `extract-timetable.ts`; `transit-v2-json.ts`                   |
| `stops.tts_stop_name`            | `stops`      | `yes`          | `no`           | `not present`                                                 | `not-emitted`            | `high`           | 読み上げ用途で意味を持ちうるが、現行 V2 では未読かつ未出力。                             | `gtfs-schema.ts`; `extract-stops.ts`; `transit-v2-json.ts`                       |
| `stop_times.shape_dist_traveled` | `stop_times` | `yes`          | `no`           | `TripPatternJson.sd` is defined in type/docs, but not emitted | `not-emitted`            | `high`           | 型・docs・実装がずれている。単なる未読 field ではなく schema/design drift とみなすべき。 | `gtfs-schema.ts`; `extract-timetable.ts`; `transit-v2-json.ts`; `V2_APP_DATA.md` |
| `agency_jp.agency_official_name` | `agency_jp`  | `yes`          | `no`           | `not present`                                                 | `intentionally-excluded` | `low`            | `agency_jp` extension 全体の除外方針と整合。                                             | `gtfs-schema.ts`; `transit-v2-json.ts`                                           |
| `trips.block_id`                 | `trips`      | `yes`          | `no`           | `not present`                                                 | `intentionally-excluded` | `low`            | vehicle continuity info として app scope 外。                                            | `gtfs-schema.ts`; `transit-v2-json.ts`                                           |
| `stops.zone_id`                  | `stops`      | `yes`          | `no`           | `not present`                                                 | `intentionally-excluded` | `low`            | fare calculation only として除外意図が明示されている。                                   | `gtfs-schema.ts`; `transit-v2-json.ts`                                           |

## Silent Loss Risk Summary

### High

- `trips.trip_short_name`
- `stops.tts_stop_name`
- `stop_times.shape_dist_traveled`

### Medium

- `stop_times.stop_headsign`
- `agency.agency_short_name`

### Low

- `agency_jp.*`
- `trips.block_id`
- `trips.wheelchair_accessible`
- `stops.zone_id`

High は「将来 source が値を入れた場合に、表示や機能設計に効きやすいのに現行 V2 では失われる」もの、
Medium は「データは保持されるが限定経路のみ、または schema coverage と別枠整理が必要」なもの、
Low は「少なくとも現時点では意図的除外として説明可能」なものとする。

## Table Inventory

### agency

| Field                    | Status | Notes                                                          |
| ------------------------ | ------ | -------------------------------------------------------------- |
| `agency.agency_id`       | `done` | `emitted-primary`。`agency[].i` に prefix 付き ID として出力。 |
| `agency.agency_name`     | `done` | `emitted-primary`, `emitted-translations`。                    |
| `agency.agency_url`      | `done` | `emitted-primary`。`agency[].u` に出力。                       |
| `agency.agency_timezone` | `done` | `emitted-primary`。`agency[].tz` に出力。                      |
| `agency.agency_lang`     | `done` | `emitted-primary`。`agency[].l` に出力。                       |
| `agency.agency_phone`    | `done` | `not-emitted`。schema にはあるが V2 extractor 未読。           |
| `agency.agency_fare_url` | `done` | `emitted-primary`。`agency[].fu` に出力。                      |
| `agency.agency_email`    | `done` | `not-emitted`。schema にはあるが V2 extractor 未読。           |

### agency_jp

| Field                             | Status | Notes                                                                                                                       |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `agency_jp.agency_id`             | `done` | `intentionally-excluded`。`agency_jp` extension table 全体が `transit-v2-json.ts` の reviewed-and-excluded comment と整合。 |
| `agency_jp.agency_official_name`  | `done` | `intentionally-excluded`。                                                                                                  |
| `agency_jp.agency_zip_number`     | `done` | `intentionally-excluded`。`agency_jp` extension table 全体の除外方針と整合。                                                |
| `agency_jp.agency_address`        | `done` | `intentionally-excluded`。`agency_jp` extension table 全体の除外方針と整合。                                                |
| `agency_jp.agency_president_pos`  | `done` | `intentionally-excluded`。`agency_jp` extension table 全体の除外方針と整合。                                                |
| `agency_jp.agency_president_name` | `done` | `intentionally-excluded`。`agency_jp` extension table 全体の除外方針と整合。                                                |

### stops

| Field                       | Status | Notes                                                                                              |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `stops.stop_id`             | `done` | `emitted-primary`。`extractStopsV2()` が読み、`StopV2Json.i` に prefix 付きで出力。                |
| `stops.stop_code`           | `done` | `not-emitted`。schema にはあるが `extractStopsV2()` の SELECT に含まれず、V2 型にも field がない。 |
| `stops.stop_name`           | `done` | `emitted-primary`, `emitted-translations`。                                                        |
| `stops.stop_desc`           | `done` | `emitted-lookup`。                                                                                 |
| `stops.stop_lat`            | `done` | `emitted-primary`。`extractStopsV2()` が読み、`StopV2Json.a` に出力。                              |
| `stops.stop_lon`            | `done` | `emitted-primary`。`extractStopsV2()` が読み、`StopV2Json.o` に出力。                              |
| `stops.zone_id`             | `done` | `intentionally-excluded`。`transit-v2-json.ts` の reviewed-and-excluded comment と整合。           |
| `stops.stop_url`            | `done` | `emitted-lookup`。`extractLookupV2()` が `lookup.stopUrls` に移す。                                |
| `stops.location_type`       | `done` | `emitted-primary`。`extractStopsV2()` が読み、`StopV2Json.l` に出力。                              |
| `stops.parent_station`      | `done` | `emitted-primary`。`extractStopsV2()` が読み、`StopV2Json.ps` に prefix 付きで出力。               |
| `stops.stop_timezone`       | `done` | `not-emitted`。schema にはあるが `extractStopsV2()` の SELECT に含まれず、V2 型にも field がない。 |
| `stops.wheelchair_boarding` | `done` | `emitted-primary`。`extractStopsV2()` が読み、`StopV2Json.wb` に出力。                             |
| `stops.platform_code`       | `done` | `emitted-primary`。`extractStopsV2()` が読み、`StopV2Json.pc` に出力。                             |
| `stops.tts_stop_name`       | `done` | `not-emitted`。                                                                                    |
| `stops.level_id`            | `done` | `not-emitted`。schema にはあるが `extractStopsV2()` の SELECT に含まれず、V2 型にも field がない。 |
| `stops.stop_access`         | `done` | `not-emitted`。schema にはあるが `extractStopsV2()` の SELECT に含まれず、V2 型にも field がない。 |

### routes

| Field                        | Status | Notes                                                                                                           |
| ---------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `routes.route_id`            | `done` | `emitted-primary`。`extractRoutesV2()` が読み、`RouteV2Json.i` に prefix 付きで出力。                           |
| `routes.agency_id`           | `done` | `emitted-primary`。`extractRoutesV2()` が読み、`RouteV2Json.ai` に prefix 付きで出力。                          |
| `routes.route_short_name`    | `done` | `emitted-primary`。                                                                                             |
| `routes.route_long_name`     | `done` | `emitted-primary`, `emitted-translations`。                                                                     |
| `routes.route_desc`          | `done` | `emitted-primary`。                                                                                             |
| `routes.route_type`          | `done` | `emitted-primary`。`extractRoutesV2()` が読み、`RouteV2Json.t` に出力。                                         |
| `routes.route_url`           | `done` | `emitted-lookup`。`extractLookupV2()` が `lookup.routeUrls` に移す。                                            |
| `routes.route_color`         | `done` | `emitted-primary`。`extractRoutesV2()` が読み、`RouteV2Json.c` に出力。                                         |
| `routes.route_text_color`    | `done` | `emitted-primary`。`extractRoutesV2()` が読み、`RouteV2Json.tc` に出力。                                        |
| `routes.route_sort_order`    | `done` | `not-emitted`。schema にはあるが `extractRoutesV2()` の SELECT に含まれず、V2 型にも field がない。             |
| `routes.continuous_pickup`   | `done` | `not-emitted`。schema にはあるが `extractRoutesV2()` の SELECT に含まれず、V2 型にも field がない。             |
| `routes.continuous_drop_off` | `done` | `not-emitted`。schema にはあるが `extractRoutesV2()` の SELECT に含まれず、V2 型にも field がない。             |
| `routes.network_id`          | `done` | `not-emitted`。schema にはあるが `extractRoutesV2()` の SELECT に含まれず、V2 型にも field がない。             |
| `routes.jp_parent_route_id`  | `done` | `intentionally-excluded`。`jp_` extension として `transit-v2-json.ts` の reviewed-and-excluded comment と整合。 |

### trips

| Field                         | Status | Notes                                                                                                               |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `trips.route_id`              | `done` | `emitted-primary`。`extractTripPatternsAndTimetable()` が読み、`TripPatternJson.r` に prefix 付きで出力。           |
| `trips.service_id`            | `done` | `emitted-primary`。`extractTripPatternsAndTimetable()` が読み、timetable の service_id key に prefix 付きで出力。   |
| `trips.trip_id`               | `done` | `not-emitted`。`extractTripPatternsAndTimetable()` の内部 grouping key として使うが、V2 出力には直接残らない。      |
| `trips.trip_headsign`         | `done` | `emitted-primary`, `emitted-translations`。                                                                         |
| `trips.trip_short_name`       | `done` | `not-emitted`。                                                                                                     |
| `trips.direction_id`          | `done` | `emitted-primary`。`extractTripPatternsAndTimetable()` が読み、`TripPatternJson.dir` に出力。                       |
| `trips.block_id`              | `done` | `intentionally-excluded`。`transit-v2-json.ts` の reviewed-and-excluded comment と整合。                            |
| `trips.shape_id`              | `done` | `derived-not-direct`。DataBundle には出ないが、別の shapes bundle 生成で route shapes の導出に使われる。            |
| `trips.wheelchair_accessible` | `done` | `intentionally-excluded`。`transit-v2-json.ts` の reviewed-and-excluded comment と整合。                            |
| `trips.bikes_allowed`         | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 型にも field がない。 |
| `trips.cars_allowed`          | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 型にも field がない。 |
| `trips.jp_trip_desc`          | `done` | `intentionally-excluded`。                                                                                          |
| `trips.jp_trip_desc_symbol`   | `done` | `intentionally-excluded`。                                                                                          |
| `trips.jp_office_id`          | `done` | `intentionally-excluded`。`jp_` extension として `transit-v2-json.ts` の reviewed-and-excluded comment と整合。     |
| `trips.jp_pattern_id`         | `done` | `intentionally-excluded`。`jp_` extension として `transit-v2-json.ts` の reviewed-and-excluded comment と整合。     |

### stop_times

| Field                                     | Status | Notes                                                                                                                             |
| ----------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `stop_times.trip_id`                      | `done` | `derived-not-direct`。`extractTripPatternsAndTimetable()` の join / grouping key として使われるが、V2 出力には直接残らない。      |
| `stop_times.arrival_time`                 | `done` | `emitted-primary`。`extractTripPatternsAndTimetable()` が読み、timetable の `a` に変換して出力。                                  |
| `stop_times.departure_time`               | `done` | `emitted-primary`。`extractTripPatternsAndTimetable()` が読み、timetable の `d` に変換して出力。                                  |
| `stop_times.stop_id`                      | `done` | `emitted-primary`。`extractTripPatternsAndTimetable()` が読み、`TripPatternJson.stops` と timetable の stop_id key に反映される。 |
| `stop_times.stop_sequence`                | `done` | `derived-not-direct`。`ORDER BY stop_sequence` により stop order を決めるが、数値自体は V2 に直接残らない。                       |
| `stop_times.stop_headsign`                | `done` | `emitted-translations`。                                                                                                          |
| `stop_times.pickup_type`                  | `done` | `emitted-primary`。`extractTripPatternsAndTimetable()` が読み、timetable の `pt` に変換して出力。                                 |
| `stop_times.drop_off_type`                | `done` | `emitted-primary`。`extractTripPatternsAndTimetable()` が読み、timetable の `dt` に変換して出力。                                 |
| `stop_times.shape_dist_traveled`          | `done` | `not-emitted`。`TripPatternJson.sd` は型と docs にあるが、現行 `extractTripPatternsAndTimetable()` は未読で出力もしていない。     |
| `stop_times.timepoint`                    | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |
| `stop_times.location_group_id`            | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |
| `stop_times.location_id`                  | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |
| `stop_times.start_pickup_drop_off_window` | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |
| `stop_times.end_pickup_drop_off_window`   | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |
| `stop_times.continuous_pickup`            | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |
| `stop_times.continuous_drop_off`          | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |
| `stop_times.pickup_booking_rule_id`       | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |
| `stop_times.drop_off_booking_rule_id`     | `done` | `not-emitted`。schema にはあるが `extractTripPatternsAndTimetable()` の SELECT に含まれず、V2 出力にも field がない。             |

### translations

| Field                          | Status | Notes                                                                                                                  |
| ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `translations.table_name`      | `done` | `derived-not-direct`。`extractTranslationsV2()` が table ごとの対象絞り込みに使うが、V2 出力には直接残らない。         |
| `translations.field_name`      | `done` | `derived-not-direct`。`extractTranslationsV2()` が field ごとの対象絞り込みに使うが、V2 出力には直接残らない。         |
| `translations.language`        | `done` | `derived-not-direct`。translation object の nested key として保持されるが、単独 field としては残らない。               |
| `translations.translation`     | `done` | `emitted-primary`。`extractTranslationsV2()` が translations section の value として保持する。                         |
| `translations.record_id`       | `done` | `derived-not-direct`。stop_id / route_id / agency_id / trip_id との join key として使い、prefixed key 生成に寄与する。 |
| `translations.record_sub_id`   | `done` | `derived-not-direct`。`stop_times.stop_headsign` の join key として使うが、V2 出力には直接残らない。                   |
| `translations.record_sequence` | `done` | `not-emitted`。`extractTranslationsV2()` では未参照で、V2 出力にも field がない。                                      |
| `translations.field_value`     | `done` | `derived-not-direct`。standard GTFS translation fallback join に使うが、V2 出力には直接残らない。                      |

### feed_info

| Field                           | Status | Notes                                                |
| ------------------------------- | ------ | ---------------------------------------------------- |
| `feed_info.feed_publisher_name` | `done` | `emitted-primary`。`feedInfo.pn` に出力。            |
| `feed_info.feed_publisher_url`  | `done` | `emitted-primary`。`feedInfo.pu` に出力。            |
| `feed_info.feed_lang`           | `done` | `emitted-primary`。`feedInfo.l` に出力。             |
| `feed_info.feed_start_date`     | `done` | `emitted-primary`。`feedInfo.s` に出力。             |
| `feed_info.feed_end_date`       | `done` | `emitted-primary`。`feedInfo.e` に出力。             |
| `feed_info.feed_version`        | `done` | `emitted-primary`。`feedInfo.v` に出力。             |
| `feed_info.default_lang`        | `done` | `not-emitted`。schema にはあるが V2 extractor 未読。 |
| `feed_info.feed_contact_email`  | `done` | `not-emitted`。schema にはあるが V2 extractor 未読。 |
| `feed_info.feed_contact_url`    | `done` | `not-emitted`。schema にはあるが V2 extractor 未読。 |

## 次のアクション

1. `not-emitted` のうち high-impact な field を要約し、follow-up 候補を issue 化できる粒度まで整理する。
2. `stop_times.shape_dist_traveled` のような「型 / docs はあるが extractor 未対応」の不整合を別枠で明示する。
3. `agency.agency_short_name` のような provider-derived 値を schema coverage 本体とどう切り分けるか方針化する。
