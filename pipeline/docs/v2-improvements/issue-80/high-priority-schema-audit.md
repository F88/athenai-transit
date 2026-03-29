# High-Priority Schema Audit Notes

Issue: #80 `Audit GTFS/GTFS-JP Schema Coverage In V2 Output`

これは高優先度の表示系 field について、full schema audit の前段で始めた整理メモである。
現在は working table 側で code-verified に確定したため、このメモは high-impact gaps の要約と
follow-up 候補の整理を主目的とする。

## 確定分類

| Field                            | Schema defined         | Current pipeline read | Current V2 exposure                              | Classification                            | Notes                                                                                                                |
| -------------------------------- | ---------------------- | --------------------- | ------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `routes.route_short_name`        | Yes                    | Yes                   | `routes[].s`                                     | `emitted-primary`                         | 主要表示 field としてそのまま出力されている。                                                                        |
| `routes.route_long_name`         | Yes                    | Yes                   | `routes[].l`, `translations.route_names`         | `emitted-primary`, `emitted-translations` | 主値は `l`。翻訳は `route_long_name` ベースで別保持。                                                                |
| `routes.route_desc`              | Yes                    | Yes                   | `routes[].desc`                                  | `emitted-primary`                         | v2 で primary field として追加済み。                                                                                 |
| `stops.stop_name`                | Yes                    | Yes                   | `stops[].n`, `translations.stop_names`           | `emitted-primary`, `emitted-translations` | stop 本体名は `n`、翻訳は別 map。                                                                                    |
| `stops.stop_desc`                | Yes                    | Yes                   | `lookup.stopDescs`                               | `emitted-lookup`                          | main record ではなく lookup に移動済み。                                                                             |
| `trips.trip_headsign`            | Yes                    | Yes                   | `tripPatterns[*].h`, `translations.headsigns`    | `emitted-primary`, `emitted-translations` | pattern 単位の primary field として保持。翻訳も別 map。                                                              |
| `stop_times.stop_headsign`       | Yes                    | Yes                   | `translations.stop_headsigns`                    | `emitted-translations`                    | extractor は明示的にこの field を読む。source に translations 行や値が無ければ空になり得るが、field 自体は抽出対象。 |
| `agency.agency_name`             | Yes                    | Yes                   | `agency[].n`, `translations.agency_names`        | `emitted-primary`, `emitted-translations` | agency 本体名は primary。翻訳も保持。                                                                                |
| `agency.agency_short_name`       | No in current `SCHEMA` | No as raw GTFS field  | `agency[].sn`, `translations.agency_short_names` | `derived-not-direct`                      | 現在は GTFS schema field ではなく provider metadata 由来。Issue #80 本体の schema coverage とは切り分けた方がよい。  |
| `trips.trip_short_name`          | Yes                    | No                    | Not present                                      | `not-emitted`                             | schema にはあるが `TripPatternJson` に field がなく、GTFS -> V2 抽出でも未読。                                       |
| `stops.tts_stop_name`            | Yes                    | No                    | Not present                                      | `not-emitted`                             | schema 定義はあるが app-data-v2 で未参照。                                                                           |
| `agency_jp.agency_official_name` | Yes                    | No                    | Not present                                      | `intentionally-excluded`                  | `transit-v2-json.ts` に `agency_jp` を含む GTFS-JP extension を除外対象として記述あり。実装上も未読。                |
| `trips.jp_trip_desc`             | Yes                    | No                    | Not present                                      | `intentionally-excluded`                  | `transit-v2-json.ts` に `All jp_ extensions` を除外対象とする記述あり。実装上も未読。                                |
| `trips.jp_trip_desc_symbol`      | Yes                    | No                    | Not present                                      | `intentionally-excluded`                  | `transit-v2-json.ts` に `All jp_ extensions` を除外対象とする記述あり。実装上も未読。                                |

## 根拠

- `RouteV2Json` は `s`, `l`, `desc` を持つ。
- `StopV2Json` は `n` を持ち、`stop_desc` は lookup 側に移動している。
- `TripPatternJson` は `h` を持つが、`trip_short_name` は持たない。
- `extractTripPatternsAndTimetable()` は `trips` から `trip_id, route_id, service_id, trip_headsign, direction_id` を読み、`trip_short_name` は読まない。
- `extractRoutesV2()` は `route_desc` を読み `route.desc` に入れている。
- `extractLookupV2()` は `stop_desc` を `lookup.stopDescs` に入れている。
- `extractTranslationsV2()` は `route_long_name`, `stop_name`, `trip_headsign`, `stop_headsign`, `agency_name` だけを明示的に翻訳 map に入れている。
- `extractAgenciesV2()` の `agency[].sn` は GTFS raw field ではなく `provider.name.ja.short` 由来。
- `transit-v2-json.ts` の型コメントには `trips.block_id`, `trips.wheelchair_accessible`, `stops.zone_id`, `All jp_ extensions (agency_jp, office_jp, pattern_jp)` を reviewed and excluded とする記述がある。
- `gtfs-schema.ts` には `trip_short_name`, `tts_stop_name`, `agency_official_name`, `jp_trip_desc`, `jp_trip_desc_symbol`, `stop_headsign`, `route_desc`, `stop_desc` が定義されている。
- full schema audit により、`stop_times.shape_dist_traveled` は型と docs に `TripPatternJson.sd` がある一方、現行 `extractTripPatternsAndTimetable()` では未読と確認できた。

## 高影響 gap 要約

### 実装ギャップとして優先度が高いもの

- `trips.trip_short_name`
  schema に存在し、表示用途の可能性が高いが、現行 V2 では未読かつ未出力。
- `stops.tts_stop_name`
  schema に存在し、読み上げや音声用途で意味を持ちうるが、現行 V2 では未読かつ未出力。
- `stop_times.shape_dist_traveled`
  型と docs では `TripPatternJson.sd` を想定している一方、現行 GTFS DataBundle extractor は未読。
  これは単なる未実装に加えて、型・docs・実装がずれている点で優先度が高い。

### 今回は gap ではなく、意図的除外として扱えるもの

- `agency_jp.*`
- `trips.jp_trip_desc`
- `trips.jp_trip_desc_symbol`
- `trips.block_id`
- `trips.wheelchair_accessible`
- `stops.zone_id`

これらは少なくとも現時点では silent omission というより、設計意図を伴う除外とみなせる。

## 追加メモ

- GTFS の `translations` は汎用全件コピーではなく、実装で対象 field が限定されている。
- `stop_times.stop_headsign` は「失われている」のではなく、今は translation-only の扱いになっている。空の source があるのは、値や translation row が無いケースと整合する。
- ODPT 側の `stop_headsigns` は data absence ではなく builder が空 object を返す実装になっている。
- 今回の監査計画は GTFS / GTFS-JP schema coverage を対象にしており、ODPT schema coverage を独立 workstream としては含めていなかった。
- そのため、ODPT Train / ODPT Bus については「今回の 4 項目を再確認するか」ではなく、ODPT 固有 schema を前提に別監査として計画し直す必要がある。
- その別監査の対象は Train + Bus とし、ODPT Air は対象外としてよい。
- `agency.agency_short_name` は既に UI で使える値があるが、schema coverage の観点では raw GTFS field の出力とは言えない。
- `agency_jp.agency_official_name`, `trips.jp_trip_desc`, `trips.jp_trip_desc_symbol` は、型コメントの設計意図があるため、少なくとも暫定 `not-emitted` より `intentionally-excluded` の方が整合的。
- 逆に `trip_short_name` と `tts_stop_name` は、現時点では reviewed-and-excluded を示す明示根拠が見当たらず、引き続き `not-emitted` 寄りで扱うのが妥当。
- `stop_times.shape_dist_traveled` は `not-emitted` だが、型と docs に露出先が定義されているため、単純な未読 field より優先的に扱うべきである。

## Raw GTFS Source Check

2026-03-29 時点で、`pipeline/workspace/data/gtfs/` 配下の展開済み GTFS テキストを直接確認した。

- `trips.trip_short_name`
  列が存在する source では、非空値は 0 件だった。合計 `157,930` trip rows 中 `0` 件。
  列自体が無い source は `chiyoda-bus`, `chuo-bus`, `kita-bus`, `suginami-gsm`。
- `stops.tts_stop_name`
  現行の展開済み GTFS source では、列自体が 1 件も存在しなかった。非空値は確認されていない。
- `stop_times.shape_dist_traveled`
  列が存在する source では、非空値は 0 件だった。合計 `2,503,058` stop_times rows 中 `0` 件。
  列自体が無い source は `chiyoda-bus`, `chuo-bus`, `kita-bus`, `kyoto-city-bus`, `miyake-bus`, `nagoya-srt`, `oshima-bus`, `suginami-gsm`。
- `agency.agency_short_name`
  raw GTFS field ではないため、この raw source check の対象外。現行 V2 では provider metadata 由来として扱っている。

この結果から、今回の 4 項目は「既存 source に有効値が存在するのに落としている」とまでは言えない。
一方で、`trip_short_name` と `shape_dist_traveled` は列自体を持つ source が複数あるため、将来 non-empty 値が入り始めた場合の
silent loss 監視対象としては引き続き妥当である。

## Follow-up issue 候補

1. `stop_times.shape_dist_traveled` を `TripPatternJson.sd` に実装するか、型と docs から落として整合させるか決める。
2. `trip_short_name` を V2 に持つべきかを、UI 表示要件と source 実データの両面から評価する。
3. `tts_stop_name` を読み上げ用途として保持するかを検討する。
4. `agency.agency_short_name` のような provider-derived 値を、schema coverage 本体と別枠で整理する方針を決める。
