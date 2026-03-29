# Issue #80 Docs

Issue: `Audit GTFS/GTFS-JP Schema Coverage In V2 Output`

このディレクトリは、Issue #80 の監査メモ、作業台、計画、草案をまとめたものです。

## 目的

GTFS / GTFS-JP schema で定義された field が、現在の V2 出力でどう扱われているかを監査する。

特に、次を区別して記録することを目的とします。

- `emitted-primary`
- `emitted-translations`
- `emitted-lookup`
- `derived-not-direct`
- `intentionally-excluded`
- `not-emitted`

## ファイル一覧

### [plan-for-issue-80.md](./plan-for-issue-80.md)

監査全体の進め方と完了条件をまとめた計画メモです。

### [issue-80-schema-coverage-working-table.md](./issue-80-schema-coverage-working-table.md)

full schema audit の作業台です。field ごとの分類結果を最も網羅的に保持します。

### [high-priority-schema-audit.md](./high-priority-schema-audit.md)

高優先度 field の整理メモです。現在は high-impact gaps と follow-up 候補の要約も兼ねています。

### [issue-v2-name-field-audit.md](./issue-v2-name-field-audit.md)

この監査 issue の背景と問題提起をまとめた草案メモです。

## 読む順番

1. [plan-for-issue-80.md](./plan-for-issue-80.md)
2. [issue-80-schema-coverage-working-table.md](./issue-80-schema-coverage-working-table.md)
3. [high-priority-schema-audit.md](./high-priority-schema-audit.md)
4. [issue-v2-name-field-audit.md](./issue-v2-name-field-audit.md)

## 現状の到達点

- GTFS / GTFS-JP 監査本体は完了している。field の分類、high-impact gaps、silent loss risk、evidence summary が整理済みである。
- working table では、監査対象 field の分類が一通り埋まっている。
- 高優先度 field については、high-impact gaps と follow-up 候補が整理済みである。
- 現時点の主要論点は、`trip_short_name`, `tts_stop_name`, `stop_times.shape_dist_traveled` の扱いと、provider-derived 値の切り分けである。
- ODPT schema coverage はこの Issue #80 計画には独立タスクとして含まれておらず、別監査として計画し直す必要がある。
- その再計画の対象は ODPT Train / ODPT Bus とし、ODPT Air は対象外でよい。

## 次に見るべき論点

1. `stop_times.shape_dist_traveled` を実装するか、型と docs から落として整合させるか。
2. `trip_short_name` を V2 に持つべきか。
3. `tts_stop_name` を読み上げ用途として保持するか。
4. `agency.agency_short_name` のような provider-derived 値を、schema coverage 本体とどう切り分けるか。
5. ODPT Train / ODPT Bus schema coverage を別 issue ないし別計画でどう扱うか。
6. その ODPT 別監査では Air を対象外として明示するか。
