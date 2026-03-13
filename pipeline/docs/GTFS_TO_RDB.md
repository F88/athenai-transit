# GTFS to RDB (Build DB)

パイプラインの Step 2。GTFS CSV ファイルを per-source の SQLite データベースに変換する。

## 概要

GTFS 仕様で定義される CSV ファイル群をストリーミング読み込みし、ソースごとに1つの SQLite DB を生成する。CSV の値はそのまま保存し、ID プレフィックスの付与は後続の build-gtfs-json.ts が行う。

スキーマは GTFS 公式仕様 + GTFS-JP v3 の全テーブルを網羅しており、どんな GTFS フィードが来ても CSV ファイルが SKIP されない (テーブル定義なしで無視されることがない) ことを保証する。

| スクリプト         | 入力                             | 出力                         |
| ------------------ | -------------------------------- | ---------------------------- |
| `build-gtfs-db.ts` | `pipeline/data/gtfs/{dir}/*.txt` | `pipeline/build/{prefix}.db` |

## CLI インターフェース

```
Usage: npx tsx pipeline/scripts/build-gtfs-db.ts [source]
       npm run pipeline:build:db
```

| 引数       | 説明                                                          |
| ---------- | ------------------------------------------------------------- |
| `[source]` | 省略時は全ソース処理。指定時はそのソースのみ (ディレクトリ名) |

## 入出力パス

- **入力**: `pipeline/data/gtfs/{directory}/*.txt` (GTFS CSV ファイル)
- **出力**: `pipeline/build/{prefix}.db` (SQLite、ソースごと)

入力ディレクトリが存在しないソースはスキップされる (WARN ログ)。

## スキーマ定義

GTFS 公式仕様 (gtfs.org) + GTFS-JP v3 の全テーブルを網羅する。合計34テーブル。

**nullable/NOT NULL の方針**: GTFS 公式仕様 (gtfs.org) に準拠する。GTFS-JP v3 で独自に必須化されているカラム (例: `routes.agency_id` が JP では推奨必須) であっても、スキーマ上は GTFS 仕様通り nullable とする。JP 固有のバリデーションはスキーマ層ではなくバリデーション層の責務とし、GTFS-JP 以外のフィードも同じスキーマで受け入れられるようにする。

### GTFS 標準テーブル (31)

| テーブル             | 対応ファイル             | 主キー                        |
| -------------------- | ------------------------ | ----------------------------- |
| agency               | agency.txt               | agency_id                     |
| calendar             | calendar.txt             | service_id                    |
| calendar_dates       | calendar_dates.txt       | (service_id, date)            |
| stops                | stops.txt                | stop_id                       |
| routes               | routes.txt               | route_id                      |
| trips                | trips.txt                | trip_id                       |
| stop_times           | stop_times.txt           | (trip_id, stop_sequence)      |
| shapes               | shapes.txt               | (shape_id, shape_pt_sequence) |
| fare_attributes      | fare_attributes.txt      | fare_id                       |
| fare_rules           | fare_rules.txt           | (なし)                        |
| feed_info            | feed_info.txt            | (なし)                        |
| translations         | translations.txt         | (なし)                        |
| attributions         | attributions.txt         | (なし)                        |
| levels               | levels.txt               | level_id                      |
| pathways             | pathways.txt             | pathway_id                    |
| frequencies          | frequencies.txt          | (なし)                        |
| transfers            | transfers.txt            | (なし)                        |
| areas                | areas.txt                | area_id                       |
| stop_areas           | stop_areas.txt           | (なし)                        |
| networks             | networks.txt             | network_id                    |
| route_networks       | route_networks.txt       | (なし)                        |
| location_groups      | location_groups.txt      | location_group_id             |
| location_group_stops | location_group_stops.txt | (なし)                        |
| booking_rules        | booking_rules.txt        | booking_rule_id               |
| timeframes           | timeframes.txt           | (なし)                        |
| rider_categories     | rider_categories.txt     | rider_category_id             |
| fare_media           | fare_media.txt           | fare_media_id                 |
| fare_products        | fare_products.txt        | (なし)                        |
| fare_leg_rules       | fare_leg_rules.txt       | (なし)                        |
| fare_leg_join_rules  | fare_leg_join_rules.txt  | (なし)                        |
| fare_transfer_rules  | fare_transfer_rules.txt  | (なし)                        |

### GTFS-JP v3 独自テーブル (3)

| テーブル   | 対応ファイル   | 主キー     |
| ---------- | -------------- | ---------- |
| agency_jp  | agency_jp.txt  | agency_id  |
| office_jp  | office_jp.txt  | office_id  |
| pattern_jp | pattern_jp.txt | pattern_id |

## インポート処理フロー

1. **CSV ストリーミング読み込み** — `readline` で1行ずつ読み込み、`splitCsvLine` でパース
2. **ヘッダー検証** — CSV カラムとスキーマ定義を照合 (後述)
3. **バッチ INSERT** — 5000行単位でトランザクション INSERT
4. **インデックス作成** — 全データ INSERT 後にクエリ用インデックスを作成
5. **FK チェック** — `PRAGMA foreign_key_check` で外部キー違反を検出 (WARN)
6. **VACUUM / ANALYZE** — DB ファイルの最適化

FK は INSERT 中は無効化されている (`PRAGMA foreign_keys = OFF`)。バルクインポート完了後に有効化して整合性チェックを行う。

## スキーマと CSV の照合ルール

| 状況                             | 処理                            |
| -------------------------------- | ------------------------------- |
| CSV にスキーマにないカラムがある | SKIP (WARN)                     |
| NOT NULL カラムが CSV に欠損     | ERROR (中断)                    |
| nullable カラムが CSV に欠損     | NULL で補完 (WARN)              |
| テーブルに対応する \*.txt がない | 空テーブルとして残る (ログなし) |

## テーブル作成順序

FK 依存順に作成される。独立テーブルが先、依存テーブルが後。

```
agency → agency_jp → calendar → calendar_dates → levels → stops →
routes → trips → stop_times → shapes → fare_attributes → fare_rules →
feed_info → translations → attributions → office_jp →
pathways → frequencies → transfers → pattern_jp →
areas → stop_areas → networks → route_networks →
location_groups → location_group_stops → booking_rules →
timeframes → rider_categories → fare_media → fare_products →
fare_leg_rules → fare_leg_join_rules → fare_transfer_rules
```
