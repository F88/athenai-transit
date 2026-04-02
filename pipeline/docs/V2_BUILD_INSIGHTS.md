# V2 Build Insights (InsightsBundle)

DataBundle から分析データを導出し、`insights.json` (InsightsBundle) を生成する。

## 概要

| 項目       | 内容                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 入力       | `pipeline/workspace/_build/data-v2/{prefix}/data.json` (DataBundle)                                                                              |
| 出力       | `pipeline/workspace/_build/data-v2/{prefix}/insights.json` (InsightsBundle)                                                                      |
| スクリプト | `pipeline/scripts/pipeline/app-data-v2/build-insights.ts`                                                                                        |
| lib        | `build-service-groups.ts`, `build-trip-pattern-geo.ts`, `build-trip-pattern-stats.ts`, `build-stop-stats.ts`, `bundle-writer.ts`, `geo-utils.ts` |

## CLI インターフェース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts <prefix>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --list
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --help
       npm run pipeline:build:v2-insights
```

| 引数/オプション    | 説明                                   |
| ------------------ | -------------------------------------- |
| `<prefix>`         | 単体実行。prefix を指定 (例: minkuru)  |
| `--targets <file>` | ターゲットリストファイルで一括ビルド   |
| `--list`           | data.json が存在する prefix 一覧を表示 |
| `--help, -h`       | ヘルプ表示                             |

### data.json が存在しない場合

単体実行時、指定 prefix の `data.json` が存在しない場合はエラー (exit 1)。バッチ実行時は `runBatch` による子プロセス実行 (各 prefix が子プロセスとして実行され、欠損は子プロセスの exit 1 として報告される)。

## InsightsBundle 構成

InsightsBundle は per-source の分析データを格納する。必須セクション1つ + 任意セクション3つ。

| セクション       | 状態   | キー構造                       | 内容                                   |
| ---------------- | ------ | ------------------------------ | -------------------------------------- |
| serviceGroups    | 実装済 | —                              | 曜日パターンによるサービスグルーピング |
| tripPatternStats | 実装済 | service group key → pattern ID | 運行頻度、残り所要時間                 |
| tripPatternGeo   | 実装済 | pattern ID                     | 直線距離、経路距離、循環フラグ         |
| stopStats        | 実装済 | service group key → stop ID    | 運行頻度、路線数、最早/最終出発時刻    |

## serviceGroups 導出アルゴリズム

`buildServiceGroups(calendar: CalendarJson): ServiceGroupEntry[]`

### 処理フロー

1. 各 service の `d` 配列 (例: `[1,1,1,1,1,0,0]`) を文字列キーに変換
2. 同じパターンの service_id をグループにまとめる
3. パターンから短縮キーを自動生成
4. 優先度順にソート

### キー命名規則

| パターン          | キー      | 説明           |
| ----------------- | --------- | -------------- |
| `[1,1,1,1,1,0,0]` | `wd`      | weekday        |
| `[0,0,0,0,0,1,0]` | `sa`      | saturday       |
| `[0,0,0,0,0,0,1]` | `su`      | sunday         |
| `[0,0,0,0,0,1,1]` | `wk`      | weekend        |
| `[1,1,1,1,1,1,1]` | `all`     | every day      |
| その他            | `d{bits}` | 例: `d1010100` |

### 優先度順ソート

1. 既知キー: `wd` → `sa` → `su` → `wk` → `all`
2. 未知キー: アルファベット順

### 制約

- 各 service_id は正確に1つのグループにのみ所属する
- 配列の順序が優先度 (先頭が最も一般的な曜日タイプ)
- `calendar_dates` exceptions はグルーピングに影響しない (実行時のマッチングで処理)

### 実データの例

| prefix  | service groups   |
| ------- | ---------------- |
| minkuru | wd, sa, su       |
| sggsm   | all              |
| yurimo  | wd, wk           |
| toaran  | wd, sa, su       |
| kazag   | wd, wk, d0011111 |

アプリ側は各セクションの有無で表示機能を切り替える。

## tripPatternGeo 導出アルゴリズム

`buildTripPatternGeo(patterns, stops): Record<string, TripPatternGeoJson>`

Service group 非依存。各パターンの地理的メトリクスを計算する。

### tripPatternGeo 処理フロー

1. Stop の座標を Map<stopId, {lat, lon}> に構築
2. 各パターンについて:
    - `cl`: `stops[0] === stops[last]` で circular 判定
    - `dist`: circular なら 0、そうでなければ first→last の Haversine 距離 (km)
    - `pathDist`: consecutive stops 間の Haversine 距離の合計 (km)。停留所間を直線で結んだ合計であり、実際の道路距離より短い。停留所数が多いほど道路距離に近づく
3. 値は小数第3位 (メートル精度) に丸める

### Circular route の扱い

- `cl = true` の場合、`dist = 0` (始点と終点が同じため)
- "6字形" ルート (中間 stop が重複するが `stops[0] !== stops[last]`) は `cl = false`

## tripPatternStats 導出アルゴリズム

`buildTripPatternStats(patterns, timetable, serviceGroups): Record<string, Record<string, TripPatternStatsJson>>`

Service group 別。各パターンの運行統計を計算する。

### tripPatternStats 出力フィルタリング

freq=0 (その service group で departure がない) のパターンは出力から除外する。stopStats と同様の方針。存在しないパターンをアプリ側で「所要時間 0 分」と誤解するリスクを防ぐ。

### freq (運行頻度)

- 基準停留所の departure count を service group 内の全 service_id で合計
- Circular route: interior stop (位置 1) を使用して 2x 問題を回避
- Non-circular: origin stop (位置 0) を使用

### rd (残り所要時間)

Consecutive segment approach:

1. 各 segment (stop[i] → stop[i+1]) の travel time を positional alignment で計算
2. 同一パターンの departure 配列の j 番目同士を対応付け、差分の median を取る
3. Terminal から逆方向に累積して rd を構築: `rd[i] = rd[i+1] + segment[i]`
4. `rd[last] = 0` (常に)
5. 値は小数第1位に丸める

### Circular route の segment 計算

Origin/terminal stop は departure が 2x (出発と到着が interleave)。origin/terminal に接する segment (最初と最後) は positional alignment が不可能なため skip し、gap interpolation で補間。

### Timetable のない stop

隣接する既知 segment の平均値で補間 (比例配分の線形補間ではない)。`fillSegmentGaps` 関数で処理。

### 注意: segment travel time = 0 の扱い

連続する停留所が同一分に発着するケースが実データに存在する:

```text
23:20着 初台坂上
23:20着 東京オペラシティ南
```

この場合 segment diff = 0 だが、これは「データなし」ではなく「所要時間 0 分」という正当な値。gap interpolation の対象にしてはならない。「データなし」(timetable 欠落や alignment 失敗) と「diff = 0」を区別する必要がある。sentinel 値 (例: -1) で「データなし」を表現し、0 は正当な値として保持する。

## stopStats 導出アルゴリズム

`buildStopStats(timetable, patterns, routes, serviceGroups): Record<string, Record<string, StopStatsJson>>`

Service group 別。各停留所の運行統計を計算する。

### stopStats 出力フィルタリング

freq=0 (その service group で departure がない) の stop は出力から除外する。tripPatternStats と同様の方針。

### stopStats 処理フロー

1. Route lookup (route_id → route_type) を構築
2. 各 stop × service group について:
    - 全 timetable group を走査
    - service group 内の service_id で departure がある group のみ集計
    - `freq`: departure count の合計
    - `rc`: distinct route_id の数
    - `rtc`: distinct route_type の数
    - `ed`: 最小 departure time (deps は昇順ソート済み)
    - `ld`: 最大 departure time (>= 1440 は深夜便)
3. departure がない stop は出力から除外

## 出力形式

```json
{
  "bundle_version": 2,
  "kind": "insights",
  "serviceGroups": {
    "v": 1,
    "data": [
      { "key": "wd", "serviceIds": ["minkuru:01-170", ...] },
      { "key": "sa", "serviceIds": ["minkuru:02-170", ...] },
      { "key": "su", "serviceIds": ["minkuru:03-170", ...] }
    ]
  },
  "tripPatternGeo": {
    "v": 1,
    "data": {
      "minkuru:p1": { "dist": 5.123, "pathDist": 6.789, "cl": false },
      "minkuru:p2": { "dist": 0, "pathDist": 3.456, "cl": true }
    }
  },
  "tripPatternStats": {
    "v": 1,
    "data": {
      "wd": {
        "minkuru:p1": { "freq": 31, "rd": [25.5, 18.0, 10.0, 0] }
      },
      "sa": {
        "minkuru:p1": { "freq": 20, "rd": [26.0, 18.5, 10.0, 0] }
      }
    }
  },
  "stopStats": {
    "v": 1,
    "data": {
      "wd": {
        "minkuru:000001": { "freq": 62, "rc": 3, "rtc": 1, "ed": 360, "ld": 1380 }
      }
    }
  }
}
```

## 将来課題: shape_dist_traveled 対応

現在の pathDist は停留所座標の Haversine 直線距離の合計で、実際の道路距離より短い。`TripPatternJson.stops[i].sd` (GTFS shape_dist_traveled) があれば、shapes の polyline に沿った正確な経路距離が得られる。

### 現状

- 全16ソースで sd を提供しているデータはない
- pathDist は Haversine 合計で代替

### sd 対応時の課題

1. **単位問題**: GTFS 仕様では shape_dist_traveled の単位は事業者が自由に選択できる (メートル、km、マイル等)。「shapes.txt で使用する単位と一致させる」とだけ規定されている。pathDist は km で出力するため、sd の単位を知らないと変換できない
2. **単位の判定方法**: GTFS に単位を明示するフィールドはない。resource definition で事業者ごとに単位を設定するか、値の大きさから推定する必要がある
3. **sd がある場合の pathDist 算出**: `stops[last].sd` が総距離。停留所間距離は `stops[i+1].sd - stops[i].sd` で正確に算出可能
4. **実データでの検証が必須**: テストデータでロジックは実装可能だが、実データが手に入り次第、単位と精度を検証する

## 実装構成

| ファイル                                                            | 役割                                  |
| ------------------------------------------------------------------- | ------------------------------------- |
| `pipeline/src/lib/geo-utils.ts`                                     | Haversine 距離計算 (pure function)    |
| `pipeline/src/lib/pipeline/app-data-v2/build-service-groups.ts`     | serviceGroups 導出 (pure function)    |
| `pipeline/src/lib/pipeline/app-data-v2/build-trip-pattern-geo.ts`   | tripPatternGeo 導出 (pure function)   |
| `pipeline/src/lib/pipeline/app-data-v2/build-trip-pattern-stats.ts` | tripPatternStats 導出 (pure function) |
| `pipeline/src/lib/pipeline/app-data-v2/build-stop-stats.ts`         | stopStats 導出 (pure function)        |
| `pipeline/src/lib/pipeline/app-data-v2/bundle-writer.ts`            | InsightsBundle の atomic write        |
| `pipeline/scripts/pipeline/app-data-v2/build-insights.ts`           | CLI スクリプト (単体/バッチ/リスト)   |
| `pipeline/config/targets/build-insights.ts`                         | バッチ対象 prefix リスト              |
