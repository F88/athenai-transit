# GTFS to RDB (Build DB)

パイプラインの Step 2。GTFS CSV ファイルを per-source の SQLite データベースに変換する。

## 概要

GTFS 仕様で定義される CSV ファイル群をストリーミング読み込みし、ソースごとに1つの SQLite DB を生成する。CSV の値はそのまま保存し、ID プレフィックスの付与は後続の build-gtfs-json.ts が行う。

**1ソース = 1 DB ファイル**: 各 GTFS ソース (ZIP) は独立した DB ファイル (`{outDir}.db`) に格納される。複数ソースの CSV を同一 DB に混在させない。GTFS の ID 体系はソース内で閉じており (例: `route_id` が異なるソース間で衝突しうる)、CSV の値をそのまま格納する本スクリプトでは出自の区別ができなくなるためである。ソース間の統合は後続の build-gtfs-json.ts がプレフィックス付きで行う。

スキーマは GTFS 公式仕様 + GTFS-JP v3 の全テーブルを網羅しており、どんな GTFS フィードが来ても CSV ファイルが SKIP されない (テーブル定義なしで無視されることがない) ことを保証する。

| スクリプト         | 入力                             | 出力                         |
| ------------------ | -------------------------------- | ---------------------------- |
| `build-gtfs-db.ts` | `pipeline/data/gtfs/{outDir}/*.txt` | `pipeline/build/{outDir}.db` |

## CLI インターフェース

```
Usage: npx tsx pipeline/scripts/build-gtfs-db.ts <source-name>
       npx tsx pipeline/scripts/build-gtfs-db.ts --targets <file>
       npx tsx pipeline/scripts/build-gtfs-db.ts --list
       npm run pipeline:build:db
```

| 引数/オプション    | 説明                                                            |
| ------------------ | --------------------------------------------------------------- |
| `<source-name>`    | 単一ソースを処理 (後述の「ソース名の解決」を参照)               |
| `--targets <file>` | ターゲットリストファイルで一括処理 (ソースごとに子プロセス実行) |
| `--list`           | 利用可能なソース名を一覧表示                                    |
| `--help`           | ヘルプメッセージを表示                                          |

`npm run pipeline:build:db` は `--targets pipeline/targets/build-db.ts` で一括処理する。ダウンロード対象リスト (`pipeline/targets/download-gtfs.ts`) とは独立したファイルであり、DB 格納対象のみを管理する。

### ソース名の解決

`<source-name>` は `pipeline/resources/gtfs/` 内のリソース定義ファイル名 (拡張子なし) を指定する。

```
npx tsx pipeline/scripts/build-gtfs-db.ts toei-bus
                                          ^^^^^^^^
                                          pipeline/resources/gtfs/toei-bus.ts を読み込む
```

リソース定義ファイルには `pipeline.outDir` (ディレクトリ名) が含まれており、入出力パスはいずれも `outDir` から決定される。

```
toei-bus.ts → { pipeline: { outDir: "toei-bus", ... } }
               │
               ├─ Input:  pipeline/data/gtfs/toei-bus/*.txt
               └─ Output: pipeline/build/toei-bus.db
```

`--list` で利用可能なソース名を確認できる。

## 入出力パス

- **入力**: `pipeline/data/gtfs/{outDir}/*.txt` (GTFS CSV ファイル)
- **出力**: `pipeline/build/{outDir}.db` (SQLite、ソースごと)

入力ディレクトリが存在しない場合はエラー終了する (exit code 1)。事前に `download-gtfs.ts` で GTFS データを取得しておく必要がある。

## スキーマ定義

GTFS 公式仕様 (gtfs.org) + GTFS-JP v3 の全テーブルを網羅する。合計34テーブル。

### GTFS 仕様との意図的な差異

スキーマは GTFS 仕様に準拠しつつ、以下の4点で意図的に仕様から逸脱している。スキーマ定義は `pipeline/lib/gtfs-schema.ts` に集約されており、各テーブルの差異理由はインラインコメントにも記載。

#### 1. 一部テーブルの PRIMARY KEY 省略

GTFS 仕様が複合 PK を定義するテーブルのうち、以下は PK を設定していない。

| テーブル            | 仕様上の PK                                                                                          | 省略理由                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| frequencies         | (trip_id, start_time)                                                                                | 重複行の可能性                                                                                  |
| fare_products       | (fare_product_id, rider_category_id, fare_media_id)                                                  | nullable カラムを含む複合 PK は SQLite で意図通り動作しない (NULL は UNIQUE チェックをスキップ) |
| fare_leg_rules      | (leg_group_id, network_id, from_area_id, to_area_id, from_timeframe_group_id, to_timeframe_group_id) | 同上                                                                                            |
| fare_leg_join_rules | (from_leg_group_id, to_leg_group_id)                                                                 | 重複行の可能性                                                                                  |
| fare_transfer_rules | (from_leg_group_id, to_leg_group_id, fare_transfer_type)                                             | 同上                                                                                            |

**理由**: PK は SQLite で NOT NULL + UNIQUE を暗黙的に課す。実データに重複や NULL がある場合、INSERT が失敗しインポート全体が中断する。このスクリプトの目的は GTFS データの忠実な格納であり、データ品質の強制ではない。

#### 2. nullable 優先 (GTFS-JP v3 互換性)

GTFS 最新仕様で Required (NOT NULL) でも、GTFS-JP v3 に存在しないカラムは nullable とする。NOT NULL カラムが CSV に欠損するとインポートが中断するため、GTFS-JP v3 フィードの受け入れを保証するにはこの方針が必要。

JP 固有のバリデーションはスキーマ層ではなくバリデーション層の責務とし、GTFS-JP 以外のフィードも同じスキーマで受け入れられるようにする。

#### 3. FK 省略 (テーブル作成順序の制約)

テーブルは FK 依存順に作成するが、一部の FK 関係では参照先テーブルが参照元より後に作成される。SQLite は `PRAGMA foreign_keys = OFF` 時に FK 宣言を構文として受理するが、参照先が存在しなくても CREATE TABLE は成功する。整合性はインポート完了後の `PRAGMA foreign_key_check` で検証する。

| 参照元     | カラム                   | 本来の参照先                       |
| ---------- | ------------------------ | ---------------------------------- |
| routes     | network_id               | networks(network_id)               |
| stop_times | location_group_id        | location_groups(location_group_id) |
| stop_times | pickup_booking_rule_id   | booking_rules(booking_rule_id)     |
| stop_times | drop_off_booking_rule_id | booking_rules(booking_rule_id)     |

#### 4. FK 省略 (複合/非一意キーの制約)

SQLite の FK は参照先カラムが PRIMARY KEY または UNIQUE でなければならない。`fare_products.fare_product_id` は単独では一意でないため、`fare_leg_rules.fare_product_id` の FK は宣言できない。

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
