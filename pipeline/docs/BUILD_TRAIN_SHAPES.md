# Build Train Shapes

国土数値情報 (MLIT) の鉄道路線 GeoJSON データから、都営電車の路線形状データを生成する。

## 概要

| 項目   | 内容                                                        |
| ------ | ----------------------------------------------------------- |
| 入力   | `pipeline/data/mlit/N02-24_RailroadSection.geojson`         |
| 出力   | `pipeline/build/data/toaran/shapes.json`                    |
| ソース | `pipeline/resources/gtfs/toei-train.ts` の mlitShapeMapping |

GTFS ソースの `shapes.txt` が提供されていない路線 (都営電車) に対して、MLIT GeoJSON データから路線形状を生成する。

## CLI インターフェース

```
Usage: npx tsx pipeline/scripts/build-train-shapes.ts
       npx tsx pipeline/scripts/build-train-shapes.ts --help
       npm run pipeline:build:train-shapes
```

| 引数         | 説明       |
| ------------ | ---------- |
| (引数なし)   | 実行       |
| `--help, -h` | ヘルプ表示 |

バッチモードなし。単一ソース (toei-train) のみ対象。

## 処理フロー

1. GeoJSON ファイルの読み込み
2. operator name (`東京都`) でフィルタリング
3. 路線名 → route ID のマッピング (`mlitShapeMapping.lineToRouteId`)
4. 座標変換: `[lon, lat]` → `[lat, lon]` (小数点5桁に丸め)
5. ルートごとにセグメントをグループ化
6. `shapes.json` として出力

## 出力フォーマット

```json
{
  "toaran:1": [[[lat, lon], [lat, lon], ...], ...],
  "toaran:2": [[[lat, lon], [lat, lon], ...], ...]
}
```

各ルートは複数のポリラインセグメント (区間) の配列。

## 出力例

```
=== Build Train Shapes from MLIT GeoJSON ===

Reading pipeline/data/mlit/N02-24_RailroadSection.geojson...
  21932 total features
  318 features for operator "東京都"

Route summary:
  toaran:1       44 segments     312 points
  toaran:2       56 segments     446 points
  ...
  TOTAL         318 segments    2179 points

Wrote pipeline/build/data/toaran/shapes.json (44.9 KB)

Done in 105ms. (exit code: 0)
```

## Exit Code

| code | 意味                              |
| ---- | --------------------------------- |
| 0    | 成功                              |
| 1    | エラー (fatal / 入力ファイルなし) |

## 前提条件

- `pipeline/data/mlit/N02-24_RailroadSection.geojson` が存在すること
- `toei-train` リソース定義に `mlitShapeMapping` が設定されていること
