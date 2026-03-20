# Build Train Shapes

パイプラインの Stage 3。国土数値情報 (MLIT) の鉄道路線 GeoJSON データから、鉄道路線の形状データを生成する。

## 概要

| 項目   | 内容                                                                   |
| ------ | ---------------------------------------------------------------------- |
| 入力   | `pipeline/workspace/data/mlit/N02-24_RailroadSection.geojson`          |
| 出力   | `pipeline/workspace/_build/data/{prefix}/shapes.json` (対象ソースごと) |
| ソース | GTFS / ODPT JSON リソース定義のうち `mlitShapeMapping` を持つもの全て  |

GTFS の `shapes.txt` が提供されていない路線や ODPT JSON ソースに対して、MLIT GeoJSON データから路線形状を生成する。

## CLI インターフェース

```
Usage: npx tsx pipeline/scripts/pipeline/app-data/build-route-shapes-from-ksj-railway.ts
       npx tsx pipeline/scripts/pipeline/app-data/build-route-shapes-from-ksj-railway.ts --help
       npm run pipeline:build:shapes:ksj
```

| 引数         | 説明       |
| ------------ | ---------- |
| (引数なし)   | 実行       |
| `--help, -h` | ヘルプ表示 |

引数なし。全リソースから `mlitShapeMapping` を持つものを自動検出して処理する。

## 処理フロー

1. GTFS / ODPT JSON の全リソース定義から `mlitShapeMapping` を持つターゲットを収集 (prefix で重複排除)
2. GeoJSON ファイルの読み込み (全ターゲットで共有)
3. ターゲットごとに:
   a. operator name でフィルタリング
   b. 路線名 → route ID のマッピング (`mlitShapeMapping.lineToRouteId`)
   c. 座標変換: `[lon, lat]` → `[lat, lon]` (小数点5桁に丸め)
   d. ルートごとにセグメントをグループ化
   e. `shapes.json` として出力

## 出力フォーマット

```json
{
  "{prefix}:{lineCode}": [[[lat, lon], [lat, lon], ...], ...],
  ...
}
```

各ルートは複数のポリラインセグメント (区間) の配列。

## 出力例

```plain
=== Build Train Shapes from MLIT GeoJSON ===

Collecting mlitShapeMapping targets...
  Found 2 targets: toaran, yurimo

Reading pipeline/workspace/data/mlit/N02-24_RailroadSection.geojson...
  21932 total features

--- toaran (Toei Train) ---
  318 features for operator "東京都"

  Route summary:
    toaran:1       44 segments     312 points
    toaran:2       56 segments     446 points
    ...
    TOTAL         318 segments    2179 points

  Wrote pipeline/workspace/_build/data/toaran/shapes.json (44.9 KB)

--- yurimo (Yurikamome Railway) ---
  32 features for operator "ゆりかもめ"

  Route summary:
    yurimo:U       32 segments     293 points
    TOTAL          32 segments     293 points

  Wrote pipeline/workspace/_build/data/yurimo/shapes.json (6.0 KB)

Done in 133ms. (exit code: 0)
```

## Exit Code

| code | 意味                              |
| ---- | --------------------------------- |
| 0    | 成功                              |
| 1    | エラー (fatal / 入力ファイルなし) |

## 前提条件

- `pipeline/workspace/data/mlit/N02-24_RailroadSection.geojson` が存在すること
- 1つ以上のリソース定義に `mlitShapeMapping` が設定されていること
