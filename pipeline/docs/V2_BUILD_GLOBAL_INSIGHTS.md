# V2 Build Global Insights (GlobalInsightsBundle)

全ソースの停留所データを横断分析し、`global/insights.json` (GlobalInsightsBundle) を生成する。

## 概要

| 項目       | 内容                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| 入力       | `pipeline/workspace/_build/data-v2/{prefix}/data.json` (targets で指定) |
| 出力       | `pipeline/workspace/_build/data-v2/global/insights.json`                |
| スクリプト | `pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts` (予定) |

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts --list
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts --help
```

| 引数/オプション    | 説明                                   |
| ------------------ | -------------------------------------- |
| `--targets <file>` | ターゲットリストファイルで対象を指定   |
| `--list`           | data.json が存在する prefix 一覧を表示 |
| `--help, -h`       | ヘルプ表示                             |

per-source の build-insights と異なり `<prefix>` 単体モードはない。全ソースの data.json を横断して分析するため、常に targets リストで対象を指定する。

## GlobalInsightsBundle 構成

per-source InsightsBundle とは異なり、全ソースを横断した空間分析を提供する。

| セクション | 状態   | キー構造 | 内容                                 |
| ---------- | ------ | -------- | ------------------------------------ |
| stopGeo    | 未実装 | stop ID  | 停留所の孤立度、乗り換えポイント検出 |

## stopGeo セクション

### 属性

```typescript
interface StopGeoJson {
    nr: number; // nearest different-route stop (km)
    wp?: number; // nearest different-parent_station stop (km)
    cn?: {
        // connectivity (300m radius), keyed by group
        [groupKey: string]: {
            rc: number; // unique route count
            freq: number; // unique routes' freq total
            sc: number; // nearby stop count
        };
    };
}
```

初期実装では `ho` (holiday: 日曜/祝日ダイヤ) のみ。将来 `wd` 等を追加可能。

```json
"cn": {
  "ho": { "rc": 7, "freq": 687, "sc": 8 }
}
```

### nr (nearest different-route stop)

**定義**: 「異なるルートが通る最寄りの停留所」までの Haversine 距離 (km)。

**用途**: 孤立度の指標。値が大きいほど「陸の孤島」— 周辺に代替交通手段がない。

**設計上の課題**:

1. **「異なるルート」の定義**: 自分の stop に通るルート集合に含まれないルートが通る最寄りの stop (定義B)。全ソース横断。同じルートの別乗り場は「代替手段」ではないため除外される
2. **location_type の扱い**: l=0 で直接計算、l=1 は子から導出、l=2〜4 は対象外。詳細は「location_type の扱い」セクション参照

### 注意: 共同運行路線と nr ≈ 0

共同運行路線 (例: 渋66 は京王バスと都営バスが共同運行) では、同じ物理的バス停が複数ソースに別 stop_id で登録されている (例: `kobus:0006_00` と `minkuru:0029-01` は阿佐ヶ谷駅で 5m の距離)。

この場合 nr ≈ 0 になるが、これは**正しい結果**として扱う。理由:

- 共同運行はデータ上で明示されていない (GTFS に共同運行を示すフィールドはない)
- 実際にその場所で複数事業者のバスに乗れるので「孤立していない」は事実
- 共同運行の stop 統合は将来課題 (Issue 等で別途管理) であり、stopGeo の算出ロジックでは考慮しない

### wp (walkable portal)

**定義**: 「異なる parent_station を持つ最寄りの停留所」までの Haversine 距離 (km)。

**用途**: 徒歩で乗り換え可能な隠れたポイントの発見。0.1-0.2km なら別の駅複合施設への近道。

**parent_station の提供状況** (16ソース中3ソースのみ):

- minkuru (都営バス): 全 l=0 に ps あり (3,695 stops)
- ktbus (関東バス): 66% に ps あり (1,326 stops)
- kcbus (京都市バス): 7 stops のみ
- 他13ソース: ps なし

**方針**: ps がある stop のみ wp を算出・出力。ps がない stop は wp を省略 (`wp?: number` — TSDoc で optional 定義済み)。

ps がないソース同士で wp を算出すると、全ペアが「異なる parent_station」扱いになり nr と同じ値になるため意味がない。

**注意事項**:

- クロスソースでは parent_station の値が一致しない (ソースごとに独立した ID 体系)。例: 都営バスの阿佐ヶ谷駅 (`minkuru:0029`) と京王バスの阿佐ヶ谷駅 (`kobus:0006`) は別の parent_station。wp は同一ソース内での乗り換えポイント検出に限定される
- 将来、より多くのソースが parent_station を提供するようになれば、wp の有用性は向上する

### cn (connectivity)

**定義**: 半径 300m 以内の乗り換え利便性スコア。全ソース横断。

**半径 300m の根拠**:

- アプリの同心円表示の緑バンド (300m) と一致
- 徒歩約4-5分の距離
- 都バスの停留所間平均距離 (388m, 直線) より短く、隣の停留所がちょうど含まれる/含まれない境界
- ターミナル (渋谷駅: 38カ所) と住宅街の差が明確に出る

**用途**:

- T7 (Terminal Popularity) view — 終点の乗り換え利便性でソート
- marker の表示 — connectivity が高い停留所を強調
- 逆用途: connectivity が低い停留所を巡る旅 (穴場、人混みを避ける)

**曜日依存**: connectivity は曜日によって大きく変わる (平日のみ運行の路線がある)。service group 別に算出が必要。

- nr/wp は座標ベースだが、「そのルートがその曜日に運行しているか」を考慮するなら nr/wp も曜日依存
- stopGeo 全体を service group 別にする可能性がある

**初期実装方針**: まず「土日祝日」の connectivity を1つ実装して有効性を確認する。service group の区分設計は実装時に決定。

**service group の横断集計**:

各ソースの service group キーは同じロジックで生成されるため、同じキー (wd, sa, su 等) は同じ曜日パターンを意味する。ただしソースによって粒度が異なる (minkuru: wd/sa/su、kbus: wd/wk/all)。

あるグローバル group (例: su) に対して各ソースの対応 group を見つけるには、曜日パターン `d` 配列で判定する。例: su = [0,0,0,0,0,0,1] を含む kbus の group は wk = [0,0,0,0,0,1,1]。アプリ側の service group マッチングと同じロジック。

**算出方法**: 300m 圏内の全停留所 (全ソース横断) から以下を集計。

```typescript
cn?: {
  [groupKey: string]: {  // "ho" (holiday) etc.
    rc: number;    // 300m 圏内のユニークルート数 (自身含む)
    freq: number;  // ユニークルートの freq 合計 (各ルートは最大 freq の stop で1回カウント)
    sc: number;    // 300m 圏内の停留所数 (自身除く)
  };
}
```

- `rc`: 乗り換え先の選択肢の数。アプリで「路線数で並べる」に使用
- `freq`: 交通密度。「便数で並べる」に使用。同一ルートが複数停留所を通る場合の重複カウントを避けるため、各ルートは最大 freq の停留所で1回だけカウント
- `sc`: 周辺の停留所密度

単一スコアに圧縮せず、アプリ側で用途に応じて使い分ける。

group key `ho` の算出: 各ソースの calendar 範囲内で、少なくとも 1 回の日曜に active になる service を抽出し、その service の stop time 数 (「運行密度」、terminal arrival 含む) を freq とする。weekly `d` bits に加えて `calendar_dates` add/remove exceptions も考慮する。平日の祝日にも参考値として使える。

- 入力: 各ソースの DataBundle から、日曜 active service 判定は per-source insights と同じ calendar + `calendar_dates` ロジックで行い、freq 自体は global 用の routeFreq 集計として直接算出
- 全ソース横断で 300m 圏内を空間検索

**実データでの検証結果** (日曜ダイヤ):

| 場所             | rc  | freq  | sc  |
| ---------------- | --- | ----- | --- |
| 荻窪駅西口(GSM)  | 31  | 1,168 | 24  |
| 阿佐ヶ谷駅       | 19  | 502   | 17  |
| 渋谷駅西口       | 18  | 1,009 | 19  |
| 錦糸町駅前       | 15  | 1,012 | 16  |
| 中野車庫         | 8   | 360   | 6   |
| 東京ビッグサイト | 7   | 687   | 8   |
| 熊野前(都電)     | 4   | 753   | 8   |

**注意**: connectivity はデータソースの充実度に依存する。ソースが追加されれば自動的に値が改善される。例えば北千住駅は現在のデータでは都バス + TX のみだが、実際には東武バス、京成バス等も乗り入れている。

## 計算量の問題

全ソースの停留所を合計すると数万件。全ペアの距離計算は O(N^2)。

| 手法                               | 計算量     | 説明                             |
| ---------------------------------- | ---------- | -------------------------------- |
| 全ペア                             | O(N^2)     | N=30,000 → 9億ペア。非実用的     |
| 空間インデックス (R-tree, geohash) | O(N log N) | 近傍検索を高速化                 |
| グリッドベース                     | O(N × K)   | K = グリッドセル内の平均停留所数 |

## 実データ規模

17 ソース (2026-03-23 計測):

- l=0 stops: 15,798
- l=1 stops: 2,352
- Total stopGeo entries: 18,150
- 処理時間: 9.5s (M4 Mac), 18s (GitHub Actions)

## 入力データ

各ソースの DataBundle (`data.json`) のみを入力とする。InsightsBundle は不要。

日曜 active service の判定は per-source insights と同じ calendar + `calendar_dates` ロジックを使う。一方、global connectivity の `freq` は route ごとの最大値で重複排除する必要があるため、`buildStopStats` をそのまま再利用せず DataBundle から直接 routeFreqs を構築して算出する。

各ソースから読み取るセクション:

- `calendar.data`: 日曜 active service 判定 (`calendar.services` + `calendar.exceptions`)
- `stops.data`: stop_id, lat, lon, location_type, parent_station
- `timetable.data`: `d` (departure_time) 配列 (stop time count による freq 算出)
- `tripPatterns.data`: stops (per-stop object 配列: id, sh?, sd?), route FK
- `routes.data`: route_id, route_type

## location_type の扱い

| l   | 意味          | stopGeo                                                                  |
| --- | ------------- | ------------------------------------------------------------------------ |
| 0   | Stop/platform | `computeStopGeo()` — 座標ベースで直接計算                                |
| 1   | Station (親)  | `computeParentStopGeo()` — nr/wp は子の min、cn は parent 座標で直接計算 |
| 2   | Entrance/exit | 対象外 (出力しない)                                                      |
| 3   | Generic node  | 対象外 (出力しない)                                                      |
| 4   | Boarding area | 対象外 (出力しない)                                                      |

日本の GTFS では l=0 と l=1 のみ使用されている。l=2〜4 は将来データに出現した場合に対応を検討する。

## 処理フロー

1. targets リストで指定された全ソースの DataBundle を読み込み
2. 各ソースの calendar 範囲について、少なくとも 1 回の日曜に active になる service を抽出 (`calendar_dates` add/remove も考慮)
3. 全停留所の StopEntry を構築 (stop_id, lat, lon, routeIds, routeFreqs, parentStation, locationType)
4. l=0 の各停留所について `buildStopGeo()` で nr/wp/cn を single-pass 全探索で計算
5. l=1 の各停留所について `buildParentStopGeo()` で nr/wp は子の min、cn は parent 座標で直接計算
6. `writeGlobalInsightsBundle()` で `global/insights.json` に出力

## 未決定事項

- [x] ~~「異なるルート」の定義を確定~~ → 定義B: 自分の stop に通るルート集合に含まれないルートが通る最寄りの stop
- [x] ~~同一物理バス停の重複 (共同運行) の扱い~~ → 考慮不要 (共同運行はデータで明示されていない。nr ≈ 0 は正しい結果)
- [x] ~~parent_station 未提供ソースの wp 扱い~~ → ps がない stop は wp を省略。ps があるソース内でのみ算出
- [x] ~~`computeParentStopGeo()` の導出ロジック~~ → nr/wp は子 (l=0) の min、cn は parent 座標で直接計算 (parent に route がないため nr/wp は直接計算不可)
- [x] ~~空間インデックスの実装方法~~ → 全探索 (single-pass) で実装。TypeScript で全16ソース 15,798 stops が 9.2秒。rbush は不要
- [x] ~~計算時間の許容範囲~~ → target 絞り込みで制御可能だが、全ソースでも 9.2秒なので不要

## パフォーマンス計測

### 開発環境 (Apple Silicon Mac)

Python 全探索、l=0 のみ:

| 処理              | stops  | 時間              |
| ----------------- | ------ | ----------------- |
| Load (16ソース)   | 15,798 | 1.2s              |
| nr (全探索)       | 15,798 | 168s (2.8min)     |
| cn (300m, 全探索) | 15,798 | 143s (2.4min)     |
| **合計**          |        | **311s (5.2min)** |

注意: CI 環境 (GitHub Actions) はこれより遅い。target を絞って実行時間を制御する必要がある。

| 構成                  | stops (l=0) | nr   | cn   | 合計          |
| --------------------- | ----------- | ---- | ---- | ------------- |
| 全16ソース            | 15,798      | 168s | 143s | 311s (5.2min) |
| 5ソース除外           | 4,588       | 14s  | 12s  | 26s           |
| 6ソース除外 (+都バス) | 893         | 0.5s | 0.4s | 1s            |

O(N^2) のため stops 数に劇的に依存。

### TypeScript 実装 (single-pass 最適化後)

| 構成                  | stops (l=0) | 時間     |
| --------------------- | ----------- | -------- |
| 11ソース (large 除外) | 4,588       | 2.5s     |
| 全16ソース            | 15,798      | **9.2s** |

Python 比で約 16 倍速。全ソースでも 10秒以下で完了するため、空間インデックス (rbush) は不要。single-pass 最適化 (nr/wp/cn を1ループで計算) により 3回スキャンの約2倍速。

### ソース別 stops 数 (l=0)

| prefix  | 事業者                         | stops (l=0) | 備考                 |
| ------- | ------------------------------ | ----------- | -------------------- |
| minkuru | 都営バス                       | 3,695       |                      |
| sbbus   | 西武バス                       | 4,125       | 初期 target から除外 |
| kobus   | 京王バス                       | 2,988       | 初期 target から除外 |
| ktbus   | 関東バス                       | 1,326       | 初期 target から除外 |
| kcbus   | 京都市営バス                   | 1,677       | 初期 target から除外 |
| iyt2    | 伊予鉄バス                     | 1,094       |                      |
| kseiw   | 京成トランジットバス           | 233         |                      |
| mykbus  | 三宅村営バス                   | 147         |                      |
| osmbus  | 大島バス                       | 111         |                      |
| toaran  | 都営交通 (地下鉄/都電/舎人)    | 149         |                      |
| edobus  | 江戸川区コミュニティバス       | 73          |                      |
| kazag   | 葛飾区コミュニティバス         | 79          |                      |
| kbus    | 北区コミュニティバス           | 61          |                      |
| sggsm   | 杉並区グリーンスローモビリティ | 4           |                      |
| mir     | みらいレール (舎人ライナー)    | 20          |                      |
| yurimo  | ゆりかもめ                     | 16          |                      |

合計: 15,798 stops (l=0)。初期 target 除外後: 5,682 stops。

### target 絞り込み

初期 target では stops 数が多い5ソースを除外。全ソースでも 9.2秒で完了するため、必要に応じて全ソースを有効化可能。

## 実装構成

| ファイル                                                         | 役割                                            |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `pipeline/src/lib/pipeline/app-data-v2/build-stop-geo.ts`        | stopGeo 導出 (buildStopGeo, buildParentStopGeo) |
| `pipeline/src/lib/pipeline/app-data-v2/bundle-writer.ts`         | writeGlobalInsightsBundle                       |
| `pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts` | CLI スクリプト (--targets, --help)              |
| `pipeline/config/targets/build-global-insights.ts`               | target prefix リスト                            |
| `pipeline/src/lib/geo-utils.ts`                                  | Haversine 距離計算 (共有)                       |
