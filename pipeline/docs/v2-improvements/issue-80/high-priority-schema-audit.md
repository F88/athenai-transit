# High-Priority Schema Audit Notes

Issue: #80 `Audit GTFS/GTFS-JP Schema Coverage In V2 Output`

これは高優先度の表示系 field について、full schema audit の前段で始めた整理メモである。
現在は working table 側で code-verified に確定したため、このメモは high-impact gaps の要約と
follow-up 候補の整理を主目的とする。

## 確定分類

| Field                            | Schema defined         | Current pipeline read | Current V2 exposure                                                                                                                                             | Classification                            | Notes                                                                                                                                                                                                              |
| -------------------------------- | ---------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `routes.route_short_name`        | Yes                    | Yes                   | `routes[].s`                                                                                                                                                    | `emitted-primary`                         | 主要表示 field としてそのまま出力されている。                                                                                                                                                                      |
| `routes.route_long_name`         | Yes                    | Yes                   | `routes[].l`, `translations.route_long_names`                                                                                                                   | `emitted-primary`, `emitted-translations` | 主値は `l`。翻訳は `route_long_name` ベースで別保持。                                                                                                                                                              |
| `routes.route_desc`              | Yes                    | Yes                   | `routes[].desc`                                                                                                                                                 | `emitted-primary`                         | v2 で primary field として追加済み。                                                                                                                                                                               |
| `stops.stop_name`                | Yes                    | Yes                   | `stops[].n`, `translations.stop_names`                                                                                                                          | `emitted-primary`, `emitted-translations` | stop 本体名は `n`、翻訳は別 map。                                                                                                                                                                                  |
| `stops.stop_desc`                | Yes                    | Yes                   | `lookup.stopDescs`                                                                                                                                              | `emitted-lookup`                          | main record ではなく lookup に移動済み。                                                                                                                                                                           |
| `trips.trip_headsign`            | Yes                    | Yes                   | `tripPatterns[*].h`, `translations.trip_headsigns`                                                                                                              | `emitted-primary`, `emitted-translations` | pattern 単位の primary field として保持。翻訳も別 map。                                                                                                                                                            |
| `stop_times.stop_headsign`       | Yes                    | Yes                   | `tripPatterns.stops[].sh`, `translations.stop_headsigns`                                                                                                        | `emitted-primary`, `emitted-translations` | 一次データとして `tripPatterns.stops[].sh` に格納。翻訳は `translations.stop_headsigns`。                                                                                                                          |
| `agency.agency_name`             | Yes                    | Yes                   | `agency[].n`, `translations.agency_names`                                                                                                                       | `emitted-primary`, `emitted-translations` | agency 本体名は primary。翻訳も保持。                                                                                                                                                                              |
| `agency.agency_short_name`       | No in current `SCHEMA` | No as raw GTFS field  | App-side のみ (`Agency.agency_short_name` / `Agency.agency_short_names`)。V2 bundle JSON には `agency[].sn` も `translations.agency_short_names` も存在しない。 | `derived-not-direct`                      | 現在は GTFS schema field ではなく provider metadata 由来。`merge-sources-v2.ts` が `AgencyAttributes` から `Agency` (app-side merged record) に注入する。Issue #80 本体の schema coverage とは切り分けた方がよい。 |
| `trips.trip_short_name`          | Yes                    | No                    | Not present                                                                                                                                                     | `not-emitted`                             | schema にはあるが `TripPatternJson` に field がなく、GTFS -> V2 抽出でも未読。                                                                                                                                     |
| `stops.tts_stop_name`            | Yes                    | No                    | Not present                                                                                                                                                     | `not-emitted`                             | schema 定義はあるが app-data-v2 で未参照。                                                                                                                                                                         |
| `agency_jp.agency_official_name` | Yes                    | No                    | Not present                                                                                                                                                     | `intentionally-excluded`                  | `transit-v2-json.ts` に `agency_jp` を含む GTFS-JP extension を除外対象として記述あり。実装上も未読。                                                                                                              |
| `trips.jp_trip_desc`             | Yes                    | No                    | Not present                                                                                                                                                     | `intentionally-excluded`                  | `transit-v2-json.ts` に `All jp_ extensions` を除外対象とする記述あり。実装上も未読。                                                                                                                              |
| `trips.jp_trip_desc_symbol`      | Yes                    | No                    | Not present                                                                                                                                                     | `intentionally-excluded`                  | `transit-v2-json.ts` に `All jp_ extensions` を除外対象とする記述あり。実装上も未読。                                                                                                                              |

## 根拠

- `RouteV2Json` は `s`, `l`, `desc` を持つ。
- `StopV2Json` は `n` を持ち、`stop_desc` は lookup 側に移動している。
- `TripPatternJson` は `h` を持つが、`trip_short_name` は持たない。
- `extractTripPatternsAndTimetable()` は `trips` から `trip_id, route_id, service_id, trip_headsign, direction_id` を読み、`trip_short_name` は読まない。
- `extractRoutesV2()` は `route_desc` を読み `route.desc` に入れている。
- `extractLookupV2()` は `stop_desc` を `lookup.stopDescs` に入れている。
- `extractTranslationsV2()` は `agency_names`, `route_long_names`, `route_short_names`, `stop_names`, `trip_headsigns`, `stop_headsigns` の 6 map を返す。`agency_short_names` map は V2 bundle に出力されない。
- `extractAgenciesV2()` の出力 (`AgencyV2Json`) は `i, n, u, tz, l?, ph?, fu?, em?, cemv?` のみで `sn` を持たない。`agency_short_name` / `agency_short_names` は app-side `merge-sources-v2.ts` が `AgencyAttributes` (`provider.name.ja.short` ほか) から `Agency` (app-side merged record) に注入する値であり、V2 bundle JSON には存在しない。
- `transit-v2-json.ts` の型コメントには `trips.block_id`, `trips.wheelchair_accessible`, `stops.zone_id`, `All jp_ extensions (agency_jp, office_jp, pattern_jp)` を reviewed and excluded とする記述がある。
- `gtfs-schema.ts` には `trip_short_name`, `tts_stop_name`, `agency_official_name`, `jp_trip_desc`, `jp_trip_desc_symbol`, `stop_headsign`, `route_desc`, `stop_desc` が定義されている。
- full schema audit により、`stop_times.shape_dist_traveled` は型と docs に `TripPatternJson.stops[].sd` がある一方、現行 `extractTripPatternsAndTimetable()` では未読と確認できた。

## 高影響 gap 要約

### 実装ギャップとして優先度が高いもの (= 現に silent loss している)

2026-05-10 の最新 Raw Source Check で確認した実 silent loss 規模順:

- `stop_times.timepoint`
  19 source、合計 2,690,000+ 行の non-empty 値。SELECT も mapping も無し。
  approximate / exact のフラグで、表示精度に直結する。
- `trips.bikes_allowed`
  14 source、合計 100,995 行の non-empty 値。`wheelchair_accessible` (= intentionally-excluded) と並ぶ accessibility 系 field。
  扱いを intentionally-excluded か実装かで決める必要あり。
- `stop_times.shape_dist_traveled`
  vag-freiburg で 260,406 行 (= 100% カバレッジ) の non-null 値。型と docs では `TripPatternJson.stops[].sd` を想定している一方、
  現行 GTFS DataBundle extractor は未読。型・docs・実装がずれており、現行データも落としている。
- `trips.trip_short_name`
  フェリー系 5 source、合計 283 行 (= 100% カバレッジ) の非空値。GTFS Best Practices "Branches" 準拠の優良 source。
  schema に存在し、表示用途の意義が明確だが、現行 V2 では未読かつ未出力。

### 中規模ギャップ

- `stops.stop_access` (toei-bus 3,691 行)
- `stops.stop_code` (鉄道系 7 source 計 571 行)
- `stops.stop_timezone` (10 source 計 47 行)
- `feed_info.feed_contact_email` / `feed_info.feed_contact_url` (各 5 / 4 source)

これらは規模は小さいが、扱い決定 (intentionally-excluded か実装か) の価値はある。

### 値ゼロ・将来 risk のみ

- `stops.tts_stop_name`
  schema に存在し、読み上げや音声用途で意味を持ちうるが、現行 source で値ゼロ。silent loss は現状なし。

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
- `stop_times.stop_headsign` は `tripPatterns.stops[].sh` として一次データも出力されるようになった (Issue #92)。翻訳は引き続き `translations.stop_headsigns` に格納。
- ODPT 側の `stop_headsigns` は data absence ではなく builder が空 object を返す実装になっている。
- 今回の監査計画は GTFS / GTFS-JP schema coverage を対象にしており、ODPT schema coverage を独立 workstream としては含めていなかった。
- そのため、ODPT Train / ODPT Bus については「今回の 4 項目を再確認するか」ではなく、ODPT 固有 schema を前提に別監査として計画し直す必要がある。
- その別監査の対象は Train + Bus とし、ODPT Air は対象外としてよい。
- `agency.agency_short_name` は既に UI で使える値があるが、schema coverage の観点では raw GTFS field の出力とは言えない。
- `agency_jp.agency_official_name`, `trips.jp_trip_desc`, `trips.jp_trip_desc_symbol` は、型コメントの設計意図があるため、少なくとも暫定 `not-emitted` より `intentionally-excluded` の方が整合的。
- 逆に `trip_short_name` と `tts_stop_name` は、現時点では reviewed-and-excluded を示す明示根拠が見当たらず、引き続き `not-emitted` 寄りで扱うのが妥当。
- `stop_times.shape_dist_traveled` は `not-emitted` だが、型と docs に露出先が定義されているため、単純な未読 field より優先的に扱うべきである。

## Raw GTFS Source Check

2026-05-10 時点で、`pipeline/workspace/data/gtfs/` 配下の展開済み GTFS テキストを直接確認した。
当初の 4 項目の枠を超えて、現状 `not-emitted` / 関心 field を網羅する形に対象を拡大した
(= 監査本体時点で対象外だった field にも silent loss が観測されたため、調査範囲を増やした)。

### 高優先度 4 項目 (= 監査本体時点で挙げていた field)

- `trips.trip_short_name`
  列は複数 source に存在し、現時点でも非空値が確認できる。少なくとも
  `tokai-kisen`, `uwajima-unyu`, `okushiri-ferry`, `orange-ferry`, `meimon-taiyo-ferry`
  の 5 source で合計 `283` 件の非空値があった (= いずれも 100% カバレッジ)。
  値は主にフェリー便の便名 / 便番号 / 船名を表していた (例: `フェリーきょうと/ふくおか：下り2便`、
  `おれんじ九州／おれんじ四国：101便`、`あおがしま丸/くろしお丸：1便`)。
  GTFS Best Practices の "Branches" ガイダンス (= trip 単位の区別に `trip_short_name` を使う)
  に沿った優良 source であり、現状は SELECT 対象にも mapping にも入っておらず、現に silent loss している。
  列自体が無い source は `chiyoda-bus`, `chuo-bus`, `kita-bus`, `suginami-gsm`, `vag-freiburg`。
- `stops.tts_stop_name`
  現行の展開済み GTFS source では、列自体が 1 件も存在しなかった。非空値も確認されていない。
  silent loss は現状なし。優先度は低い。
- `stop_times.shape_dist_traveled`
  **`vag-freiburg` で `260,406 / 260,406` (= 100% カバレッジ) の non-null 値が存在する**。
  `extractTripPatternsAndTimetable()` は SELECT も mapping も未実装のため、現に silent loss している。
  vag-freiburg 以外の国内 source では列を持つものがあるが、現時点では non-null 値ゼロ。
  shapes 側 (= `extract-shapes-from-gtfs.ts`) は schema 上常に存在する `shape_dist_traveled` 列を SELECT し、
  non-null 値があれば `[lat, lon, dist]` 形式で出力する実装になっている。silent loss は extract-timetable 側のみ。
- `agency.agency_short_name`
  raw GTFS field ではないため、この raw source check の対象外。現行 V2 では provider metadata 由来として扱っている。

### 追加で発見した silent loss (= 監査本体時点では対象外だった field)

- `stop_times.timepoint`
  **19 source、合計 2,690,000+ 行の non-empty 値が存在する**。SELECT も mapping も無いため、現に大規模に silent loss している。
  実績例: `toei-bus` 902,364、`kyoto-city-bus` 607,249、`kanto-bus` 303,100、`nishi-tokyo-bus` 171,842、`tokyometro` 171,069 (いずれも 100% カバレッジ)。
  GTFS spec での意味: `0` = approximate / `1` = exact (省略時 exact)。Approximate の表示は app の精度感に直結するため、
  保持するか / 落とすかは設計判断が必要。
- `trips.bikes_allowed`
  **14 source、合計 100,995 行の non-empty 値が存在する**。`trips.wheelchair_accessible` (= intentionally-excluded) と並ぶ accessibility 系 field。
  実績例: `toei-bus` 47,082、`seibu-bus` 29,009、`kyoto-city-bus` 17,913、フェリー系全 5 source 100% カバレッジ。
  扱い決定が必要: `wheelchair_accessible` と同様に intentionally-excluded か、accessibility 表示の文脈で実装に進めるか。
- `stops.stop_access`
  `toei-bus` のみ、`3,691 / 5,367` (= 約 69%) で値が入っている。GTFS spec の Optional field。
- `stops.stop_code`
  鉄道系 7 source、計 `571` 行で値が入っている (`tokyometro` 185、`toei-train` 149、`actv-nav` 148、`yokohama-municipal-subway` 42、`mir-train` 20、`tama-monorail` 19、`twr-rinkai` 8)。
- `stops.stop_timezone`
  10 source、計 `47` 行 (フェリー系中心、長距離航路で別 timezone を持つケース)。
- `feed_info.feed_contact_email` / `feed_info.feed_contact_url`
  各 5 / 4 source (1 source あたり 1 行のため絶対量は小さいが、provider 連絡先として価値がある)。

### 値ゼロ field (= 現行 `not-emitted` 維持で問題なし)

`stops.level_id`, `routes.route_sort_order`, `routes.continuous_pickup`, `routes.continuous_drop_off`, `routes.network_id`,
`stop_times.continuous_pickup`, `stop_times.continuous_drop_off`, `stop_times.location_group_id`, `stop_times.location_id`,
`stop_times.start_pickup_drop_off_window`, `stop_times.end_pickup_drop_off_window`,
`stop_times.pickup_booking_rule_id`, `stop_times.drop_off_booking_rule_id`,
`trips.cars_allowed`, `feed_info.default_lang`。

これらは現行 source で non-empty 値が観測されないため、現時点では silent loss していない。将来 source が値を入れ始めたら監視対象になる。

### 総括

監査本体 (2026-03-29) 時点の Raw Source Check は、その後追加されたフェリー系・海外 source (vag-freiburg) の
登場前のものであり、数値・結論ともに古い。少なくとも以下は「将来 risk」ではなく「現行データを V2 へ落としている silent loss」として
即時 follow-up 対象である。

1. `stop_times.timepoint` (約 2.69M 行)
2. `trips.bikes_allowed` (約 101K 行)
3. `stop_times.shape_dist_traveled` (260K 行 / vag-freiburg)
4. `trips.trip_short_name` (283 行 / フェリー系 5 source)

`stops.stop_code` / `stops.stop_access` / `stops.stop_timezone` / `feed_info.feed_contact_*` は規模は小さいが、
扱いを `intentionally-excluded` か `not-emitted` (実装漏れ) かを決める価値はある。

## Follow-up issue 候補

2026-05-10 の最新 Raw Source Check 結果に基づく優先度付け。

### High (= 現行データを silent loss している、即時着手対象)

1. `stop_times.timepoint` を保持するか落とすか決める (= 19 source 2.69M 行が現に silent loss)。
2. `trips.bikes_allowed` を `wheelchair_accessible` と同様に intentionally-excluded とするか、accessibility info として実装するか決める (= 14 source 101K 行)。
3. `stop_times.shape_dist_traveled` を `TripPatternJson.stops[].sd` に実装するか、型と docs から落として整合させるか決める (= vag-freiburg 260K 行)。
4. `trip_short_name` を V2 に持つべきかを、GTFS Best Practices "Branches" と source 実データ (= フェリー系 100% カバレッジ) を踏まえて評価する。

### Medium (= 規模は小さいが扱い決定の価値あり)

1. `stops.stop_code` (鉄道系 7 source) の扱いを決める。
2. `stops.stop_access` (toei-bus 3,691 行) の扱いを決める。
3. `stops.stop_timezone` (10 source 47 行) の扱いを決める。
4. `feed_info.feed_contact_email` / `feed_info.feed_contact_url` の扱いを決める。

### Low (= 値ゼロ、将来 risk のみ)

1. `tts_stop_name` を読み上げ用途として保持するかを検討する。

### Meta

1. `agency.agency_short_name` のような provider-derived 値を、schema coverage 本体と別枠で整理する方針を決める (= ODPT schema coverage 監査の前提条件)。
