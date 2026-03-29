# Plan For Issue #80

Issue: `Audit GTFS/GTFS-JP Schema Coverage In V2 Output`

Note:

この計画は GTFS / GTFS-JP schema coverage を対象にしたものであり、ODPT schema coverage を独立タスクとしては含んでいない。
ODPT Train / ODPT Bus JSON については、同じ V2 出力に流入していても schema 体系が別であるため、別監査として計画し直す必要がある。
この再計画では ODPT Air は対象外として扱う。

## 目的

GTFS / GTFS-JP schema で定義されている field が、現在の V2 出力でどう扱われているかを棚卸しする。

この issue の主眼は schema 拡張そのものではなく、各 field を次のどれとして扱っているのかを明確にすることにある。

- `emitted-primary`
- `emitted-translations`
- `emitted-lookup`
- `derived-not-direct`
- `intentionally-excluded`
- `not-emitted`
- `unknown-needs-review`

特に、実装されていないだけの field と、設計上の意図を持って除外している field を分離して記録する。

## 先に確認できていること

- `trips.trip_short_name` は schema に存在するが、現在の V2 型にも GTFS -> V2 抽出にも現れていない。
- 高優先度の表示系 field については、[high-priority-schema-audit.md](./high-priority-schema-audit.md) に暫定棚卸しがある。
- GTFS `translations` は汎用コピーではなく、`extractTranslationsV2()` が対象 field を明示列挙して抽出している。
- `agency.agency_short_name` は V2 に存在するが、現状は raw GTFS schema field というより provider metadata 由来として扱うのが妥当。

## 監査対象

最低限、issue 本文にある以下の table を full coverage の対象にする。

- `agency`
- `agency_jp`
- `stops`
- `routes`
- `trips`
- `stop_times`
- `translations`
- `feed_info`

必要に応じて、現在の V2 設計判断に直接影響する補助 table も対象に加える。

## 実施方針

### 1. schema inventory を固定化する

GTFS / GTFS-JP の schema 定義から、監査対象 field 一覧を table 単位で列挙する。

基準ソース:

- `pipeline/src/lib/pipeline/gtfs-schema.ts`
- 必要に応じて `pipeline/_references/GTFS_JP_v3/` などの仕様参考資料

この時点でやること:

- field 名を `table.column` 形式で正規化する
- 「現行 app が参照しないが schema には存在する field」を落とさない
- `agency_short_name` のような provider-derived 値は raw schema coverage とは別扱いでメモする

### 2. current read path を確認する

各 field について、raw DB / CSV から現在の GTFS パイプラインが読んでいるかを確認する。

主な確認箇所:

- `pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts`
- `pipeline/src/lib/pipeline/app-data-v2/gtfs/extract-*.ts`

確認観点:

- SQL / extractor 内で明示的に select / access しているか
- generic pass-through ではなく限定列挙か
- GTFS schema coverage と provider-derived 値の境界をどう引くか

### 3. V2 exposure を分類する

各 field が V2 のどこに現れるかを分類する。

確認先:

- `src/types/data/transit-v2-json.ts`
- `pipeline/docs/V2_APP_DATA.md`
- 実際の extractor / builder 実装

分類ルール:

- V2 の主要 record に直接入るなら `emitted-primary`
- `translations.*` に入るなら `emitted-translations`
- `lookup.*` に逃がしているなら `emitted-lookup`
- raw schema field ではなく provider metadata や加工値由来なら `derived-not-direct`
- 設計意図がコメントや docs で明示されている除外は `intentionally-excluded`
- 実装上どこにも乗っていないなら `not-emitted`
- 証拠が弱く判断保留なら `unknown-needs-review`

### 4. silent loss risk を評価する

`not-emitted` と `intentionally-excluded` だけでなく、「将来 source が値を入れ始めたら黙って落ちるか」を確認する。

優先度の高いリスク:

- 表示名や注記に使える field
- UI 表示に使い得る省略名 / 読み上げ用名 / 便注記
- source 側では既に列が存在しているが、現行 extractor が未読のもの

### 5. deliverable を作る

監査結果は最低でも次の 3 つに分けて残す。

1. schema coverage table
2. high-impact gaps の要約
3. follow-up issue 候補

## 具体的な進め方

### Phase 1: 高優先度 field の確定

既存メモ [high-priority-schema-audit.md](./high-priority-schema-audit.md) を基に、次を code-verified 状態にする。

- `routes.route_short_name`
- `routes.route_long_name`
- `routes.route_desc`
- `stops.stop_name`
- `stops.stop_desc`
- `trips.trip_headsign`
- `stop_times.stop_headsign`
- `agency.agency_name`
- `trips.trip_short_name`
- `stops.tts_stop_name`
- `agency_jp.agency_official_name`
- `trips.jp_trip_desc`
- `trips.jp_trip_desc_symbol`

ここでは「分類のルール自体が妥当か」を固めることを優先する。

### Phase 2: full schema audit へ拡張

table ごとに schema 定義を全列挙し、各 field に以下の列を持つ表を作る。

- `field`
- `schema_table`
- `schema_defined`
- `pipeline_reads`
- `v2_location`
- `classification`
- `silent_loss_risk`
- `notes`
- `evidence`

`evidence` には少なくとも実装ファイルか docs の参照先を残す。

### Phase 3: 設計意図の不足を補う

監査途中で、除外意図がコードや docs に表現されていない field を拾う。

対応候補:

- 型コメント追加
- extractor コメント追加
- `V2_APP_DATA.md` への明記
- 別 issue 化

この phase では schema を増やすのではなく、現状の設計意図を言語化することを優先する。

### Phase 4: follow-up issue を切る

監査完了後、実装変更が必要なものだけを別 issue として切り出す。

候補例:

- `trip_short_name` を V2 schema に追加するかの検討
- `tts_stop_name` を読み上げ用途として持つかの検討
- `agency_official_name` を operator 表示や credits 用に扱うかの検討
- `jp_trip_desc` / `jp_trip_desc_symbol` を注記情報として扱うかの検討

## 成果物の想定

### 必須成果物

1. GTFS / GTFS-JP schema coverage table
2. `excluded` / `not emitted` / `derived` の整理
3. 高優先度 gap の優先順位付きリスト
4. 設計意図が暗黙な箇所の docs / comment 更新案

### あるとよい成果物

1. source 側に実データ列が存在する field の一覧
2. 将来値が入った場合に silent loss が起きる field の一覧
3. GTFS と ODPT で扱いが揃っていない field の一覧

## 完了条件

以下を満たしたら、この issue の「監査」は完了とみなせる。

- 監査対象 table の各 field が少なくとも 1 つの分類に入っている
- `not-emitted` な field について、単なる未実装か意図的除外かの根拠が記録されている
- 高影響な gap が follow-up issue か docs 更新案に落ちている
- 将来 provider が値を入れたときの silent loss リスクが見える状態になっている

## 現時点の優先順位

優先度高:

1. 高優先度表示 field の分類確定
2. `trip_short_name` を含む true non-emission の洗い出し
3. `agency_short_name` のような provider-derived 値を schema coverage から切り分ける方針決定

優先度中:

1. full schema coverage table の作成
2. `intentionally-excluded` を支える docs / comment の発見または不足箇所の特定

優先度低:

1. すぐに UI へ出さない field の schema 拡張検討
2. ODPT schema coverage 監査の別計画化

## 本計画の見直しポイント

今回の実施結果として、GTFS / GTFS-JP 監査は完了した一方、ODPT schema coverage はこの計画に明示的に含まれていなかったことが確認された。

したがって、次に必要なのは GTFS 監査の延長ではなく、少なくとも以下を持つ別計画である。

1. ODPT Train を対象にした schema inventory と V2 exposure の棚卸し
2. ODPT Bus を含めた Train + Bus を監査対象として固定する
3. ODPT Air は今回の別監査スコープから外すことを明記する
4. GTFS 項目との 1:1 対応ではなく、ODPT 固有 field を前提にした high-impact gaps の抽出

## 実務上の注意

- この issue は監査 issue であり、schema 追加を同時にやらない。
- current data が空でも、「schema にあるが未出力」は監査対象から外さない。
- `translations` は generic copy ではないため、「翻訳が空」をそのまま「field 不要」と解釈しない。
- provider-derived な値は raw GTFS field coverage と混ぜない。
