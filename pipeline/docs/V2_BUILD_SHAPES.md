# V2 Build Shapes (ShapesBundle)

v2 パイプラインの ShapesBundle (`shapes.json`) ビルド仕様。GTFS shapes.txt と国土数値情報 (KSJ) 鉄道路線の2つのデータソースに対応する。

## 概要

| スクリプト                         | 入力                        | 出力                           |
| ---------------------------------- | --------------------------- | ------------------------------ |
| `build-shapes-from-gtfs.ts`        | SQLite DB (shapes テーブル) | `data-v2/{prefix}/shapes.json` |
| `build-shapes-from-ksj-railway.ts` | MLIT GeoJSON                | `data-v2/{prefix}/shapes.json` |

抽出ロジックは `pipeline/src/lib/pipeline/` の共有関数に集約されており、v1 と v2 の両方から利用される。

## CLI インターフェース

### GTFS shapes

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts <source-name>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts --list
       npm run pipeline:build:v2-shapes:gtfs
```

### KSJ railway shapes

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj-railway.ts <source-name>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj-railway.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj-railway.ts --list
       npm run pipeline:build:v2-shapes:ksj
```

| 引数/オプション    | 説明                               |
| ------------------ | ---------------------------------- |
| `<source-name>`    | 単一ソースを処理                   |
| `--targets <file>` | ターゲットリストファイルで一括処理 |
| `--list`           | 利用可能なソース名を一覧表示       |
| `--help`           | ヘルプメッセージを表示             |

## ShapesBundle 構造

```typescript
interface ShapesBundle {
    bundle_version: 2;
    kind: 'shapes';
    shapes: BundleSection<2, Record<string, ShapePointV2[][]>>;
}
```

### shapes.data の構造

```typescript
{
  "{prefix}:{route_id}": [
    [[lat, lon], [lat, lon], ...],       // polyline 1
    [[lat, lon, dist], [lat, lon, dist], ...],  // polyline 2 (with shape_dist_traveled)
  ],
  ...
}
```

キーは `{prefix}:{route_id}`。値はポリライン配列の配列 (同一ルートに複数の shape がある場合)。

### ShapePointV2

```typescript
type ShapePointV2 = [number, number, number?];
// [lat, lon] or [lat, lon, shape_dist_traveled]
```

- 座標は小数点以下5桁に丸め (約1m精度)
- `shape_dist_traveled` はソースに存在する場合のみ3番目の要素として含む
- KSJ ソースでは常に `[lat, lon]` の2要素

## GTFS shapes 処理

### GTFS 入力

`pipeline/workspace/_build/db/{outDir}.db` の `trips` テーブルと `shapes` テーブルを使用。

### GTFS 処理フロー

```text
1. trips テーブルから route_id → shape_id のマッピングを取得
2. shapes テーブルから全ポイントを shape_id, shape_pt_sequence 順に取得
3. 座標を5桁に丸め、shape_dist_traveled があれば3番目の要素に含める
4. shape_id ごとにポイントをグループ化してポリラインを構成
5. route_id ごとにポリライン配列を集約
6. prefix を付与してキーを生成
7. ShapesBundle として atomic write
```

### shapes がないソース

GTFS ZIP に `shapes.txt` が含まれていないソース (関東バス、京王バスなど) ではスクリプトが正常にスキップする (shapes テーブルが空のため)。

## KSJ railway shapes 処理

### KSJ 入力

`pipeline/workspace/data/mlit/N02-24_RailroadSection.geojson` (国土数値情報 鉄道データ)。

### ターゲット検出

リソース定義に `mlitShapeMapping` フィールドを持つソースが自動的にターゲットとなる。

```typescript
interface MlitShapeMapping {
    operator: string; // GeoJSON の N02_004 (事業者名) でフィルタ
    lineToRouteId: Record<string, string>; // N02_003 (路線名) → prefixed route_id
}
```

### KSJ 処理フロー

```text
1. GeoJSON を読み込み (バッチ実行時はモジュールスコープでキャッシュ)
2. N02_004 (事業者名) でフィーチャーをフィルタ
3. N02_003 (路線名) → route_id にマッピング
4. [lon, lat] → [lat, lon] に変換、5桁に丸め
5. route_id ごとにポリライン配列を集約
6. ShapesBundle として atomic write
```

### GeoJSON フィーチャー構造

```typescript
interface GeoJsonFeature {
    type: 'Feature';
    properties: {
        N02_001: string; // 鉄道区分コード
        N02_002: string; // 事業種別コード
        N02_003: string; // 路線名
        N02_004: string; // 事業者名
    };
    geometry: {
        type: 'LineString';
        coordinates: [number, number][]; // [lon, lat]
    };
}
```

## v1 → v2 変更点

| 項目         | v1                          | v2                                             |
| ------------ | --------------------------- | ---------------------------------------------- |
| ポイント形式 | `[lat, lon]` のみ           | `[lat, lon, dist?]` (shape_dist_traveled 対応) |
| 出力形式     | v1 データと同じディレクトリ | ShapesBundle として独立ファイル                |
| 座標精度     | 小数点以下5桁               | 同じ                                           |
| 抽出ロジック | 共有                        | 共有 (v1/v2 で同じ関数を使用)                  |

## 実装構成

| ファイル                                                                 | 役割                           |
| ------------------------------------------------------------------------ | ------------------------------ |
| `pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts`        | GTFS CLI スクリプト            |
| `pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj-railway.ts` | KSJ CLI スクリプト             |
| `pipeline/src/lib/pipeline/extract-shapes-from-gtfs.ts`                  | GTFS 抽出ロジック (v1/v2 共有) |
| `pipeline/src/lib/pipeline/extract-shapes-from-ksj.ts`                   | KSJ 抽出ロジック (v1/v2 共有)  |
| `pipeline/src/lib/pipeline/app-data-v2/bundle-writer.ts`                 | ShapesBundle 書き込み          |
| `src/types/data/transit-v2-json.ts`                                      | 型定義                         |

## Exit Code

| code | label           | 意味                |
| ---- | --------------- | ------------------- |
| 0    | ok              | 成功                |
| 1    | error / partial | 失敗 / 一部失敗     |
| 2    | all failed      | 全失敗 (バッチのみ) |
