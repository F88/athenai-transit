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
}
```

### nr (nearest different-route stop)

**定義**: 「異なるルートが通る最寄りの停留所」までの Haversine 距離 (km)。

**用途**: 孤立度の指標。値が大きいほど「陸の孤島」— 周辺に代替交通手段がない。

**設計上の課題**:

1. **「異なるルート」の定義**: 同一ソース内の別ルートか? 別ソースのルートか? → 全ソース横断で「自分の stop_id に通るルート以外のルートが通る最寄り stop」とすべき
2. **同一バス停の重複**: 共同運行路線 (例: 渋66) で同じ物理的バス停が複数ソースに別 stop_id で存在する場合、nr = 0 になるが意味がない
3. **location_type=1 (駅)**: 親駅は除外すべきか? location_type=0 (stop/platform) のみを対象とすべき

### wp (walkable portal)

**定義**: 「異なる parent_station を持つ最寄りの停留所」までの Haversine 距離 (km)。

**用途**: 徒歩で乗り換え可能な隠れたポイントの発見。0.1-0.2km なら別の駅複合施設への近道。

**設計上の課題**:

1. **parent_station が未提供のソースが多い**: 日本の GTFS ソースでは parent_station はオプション。提供していないソースの stop は wp を算出できない
2. **クロスソースの parent_station 不一致**: 同じ駅でもソースごとに parent_station の有無や値が異なる
3. **parent_station がないソース同士**: 全停留所が独立 (parent_station なし) の場合、全ペアが「異なる parent_station」扱いになり nr と同じ値になる

## 計算量の問題

全ソースの停留所を合計すると数万件。全ペアの距離計算は O(N^2)。

| 手法                               | 計算量     | 説明                             |
| ---------------------------------- | ---------- | -------------------------------- |
| 全ペア                             | O(N^2)     | N=30,000 → 9億ペア。非実用的     |
| 空間インデックス (R-tree, geohash) | O(N log N) | 近傍検索を高速化                 |
| グリッドベース                     | O(N × K)   | K = グリッドセル内の平均停留所数 |

## 実データ規模

```
TODO: 全ソースの停留所数を調査
```

## 入力データ

各ソースの DataBundle から以下を読み取る:

- `stops.data`: stop_id, lat, lon, location_type, parent_station
- `tripPatterns.data`: stops (stop_id 一覧), route FK
- `routes.data`: route_id

## 処理フロー (案)

1. 全ソースの DataBundle を読み込み
2. 全停留所を統合リストに構築 (stop_id, lat, lon, routes, parent_station)
3. 空間インデックスを構築
4. 各停留所について:
    - nr: 自分のルート集合と重ならないルートを持つ最寄り stop を検索
    - wp: 自分の parent_station と異なる parent_station を持つ最寄り stop を検索
5. GlobalInsightsBundle として出力

## 未決定事項

- [ ] 「異なるルート」の定義を確定
- [ ] 同一物理バス停の重複 (共同運行) の扱い
- [ ] location_type=1 の除外方針
- [ ] parent_station 未提供ソースの wp 扱い
- [ ] 空間インデックスの実装方法 (ライブラリ or 自前)
- [ ] 計算時間の許容範囲 (バッチ処理、CI での実行時間)
