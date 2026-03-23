# V2 App Data (DataBundle)

v2 パイプラインの DataBundle (`data.json`) ビルド仕様。

## 概要

per-source SQLite DB (GTFS) または ODPT JSON から、WebApp が利用する v2 DataBundle (`data.json`) を生成する。全セクションを1つの JSON ファイルに統合出力する。

| スクリプト                 | 入力                                          | 出力                                                   |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `build-from-gtfs.ts`       | `pipeline/workspace/_build/db/{outDir}.db`    | `pipeline/workspace/_build/data-v2/{prefix}/data.json` |
| `build-from-odpt-train.ts` | `pipeline/workspace/data/odpt-json/{outDir}/` | `pipeline/workspace/_build/data-v2/{prefix}/data.json` |

## CLI インターフェース

### GTFS ソース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts <source-name>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts --list
       npm run pipeline:build:v2-data
```

### ODPT Train ソース

```plain
Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts <source-name>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts --targets <file>
       npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts --list
       npm run pipeline:build:v2-odpt-train
```

| 引数/オプション    | 説明                                                            |
| ------------------ | --------------------------------------------------------------- |
| `<source-name>`    | 単一ソースを処理 (リソース定義ファイル名、拡張子なし)           |
| `--targets <file>` | ターゲットリストファイルで一括処理 (ソースごとに子プロセス実行) |
| `--list`           | 利用可能なソース名を一覧表示                                    |
| `--help`           | ヘルプメッセージを表示                                          |

## DataBundle 構造

```typescript
interface DataBundle {
    bundle_version: 2;
    kind: 'data';
    stops: BundleSection<2, StopV2Json[]>;
    routes: BundleSection<2, RouteV2Json[]>;
    agency: BundleSection<1, AgencyJson[]>;
    calendar: BundleSection<1, CalendarJson>;
    feedInfo: BundleSection<1, FeedInfoJson>;
    timetable: BundleSection<2, Record<string, TimetableGroupV2Json[]>>;
    tripPatterns: BundleSection<2, Record<string, TripPatternJson>>;
    translations: BundleSection<1, TranslationsJson>;
    lookup: BundleSection<2, LookupV2Json>;
}
```

各セクションは `BundleSection<V, T> = { v: V, data: T }` でラップされ、バージョン番号を持つ。

## セクション詳細

### stops (v=2)

```typescript
interface StopV2Json {
    v: 2;
    i: string; // stop_id (prefixed)
    n: string; // stop_name
    a: number; // stop_lat
    o: number; // stop_lon
    l: number; // location_type (0=stop, 1=station, 2=entrance/exit, 3=generic node, 4=boarding area)
    wb?: 0 | 1 | 2; // wheelchair_boarding
    ps?: string; // parent_station FK (prefixed)
    pc?: string; // platform_code
}
```

v1 からの変更: `ai` (agency_id) 削除、`wb`/`ps`/`pc` 追加。`stop_desc` は lookup に移動。

### routes (v=2)

```typescript
interface RouteV2Json {
    v: 2;
    i: string; // route_id (prefixed)
    s: string; // route_short_name
    l: string; // route_long_name
    t: number; // route_type
    c: string; // route_color (hex without #)
    tc: string; // route_text_color (hex without #)
    ai: string; // agency_id (prefixed)
    desc?: string; // route_desc
}
```

v1 からの変更: `desc` 追加。`route_url` は lookup に移動。

### tripPatterns (v=2) — 新規

```typescript
interface TripPatternJson {
    v: 2;
    r: string; // route_id FK (prefixed)
    h: string; // trip_headsign
    dir?: 0 | 1; // direction_id
    stops: string[]; // ordered stop IDs (prefixed)
    sd?: number[]; // shape_dist_traveled per stop
}
```

同一ルート、同一方面、同一停車パターンの trip をグループ化したもの。timetable の `tp` フィールドから参照される。

### timetable (v=2)

```typescript
// Record<stop_id, TimetableGroupV2Json[]>
interface TimetableGroupV2Json {
    v: 2;
    tp: string; // trip pattern ID FK
    d: Record<string, number[]>; // service_id → departure minutes
    a: Record<string, number[]>; // service_id → arrival minutes
    pt?: Record<string, (0 | 1 | 2 | 3)[]>; // pickup_type per departure
    dt?: Record<string, (0 | 1 | 2 | 3)[]>; // drop_off_type per departure
}
```

v1 からの変更: `r`/`h`/`ai` → `tp` (trip pattern FK)。`a` (arrival) 追加。`pt`/`dt` 追加。

### lookup (v=2) — 新規

```typescript
interface LookupV2Json {
    stopUrls?: Record<string, string>; // stop_id → stop_url
    routeUrls?: Record<string, string>; // route_id → route_url
    stopDescs?: Record<string, string>; // stop_id → stop_desc
}
```

URL や description など、全 stop/route に存在しない任意フィールドを分離して格納。メインの stops/routes 配列を軽量に保つ。

### agency (v=1), calendar (v=1), feedInfo (v=1), translations (v=1)

v1 から変更なし。型定義は `src/types/data/transit-json.ts` で定義され、`transit-v2-json.ts` から re-import されている。

## v1 → v2 変更サマリ

| セクション   | v1                  | v2                                           |
| ------------ | ------------------- | -------------------------------------------- |
| stops        | 個別ファイル        | DataBundle 内、`ps`/`wb`/`pc` 追加           |
| routes       | 個別ファイル        | DataBundle 内、`desc` 追加、URL は lookup へ |
| timetable    | `r,h,ai` でグループ | `tp` (pattern FK) でグループ、`a` 追加       |
| tripPatterns | なし                | 新規 — trip のパターン化                     |
| lookup       | なし                | 新規 — URL/desc の分離格納                   |
| shapes       | 同一ファイル        | 別バンドル (ShapesBundle) に分離             |
| 出力形式     | 8ファイル/ソース    | 1ファイル/ソース (data.json)                 |

## 処理フロー

### GTFS ソースの処理フロー

```text
SQLite DB → extractStopsV2
          → extractRoutesV2
          → extractCalendarV2
          → extractAgenciesV2
          → extractFeedInfoV2
          → extractTranslationsV2
          → extractLookupV2
          → extractTripPatternsAndTimetable
          → writeDataBundle (atomic write)
```

### ODPT Train ソースの処理フロー

```text
ODPT JSON → buildStopsV2
           → buildRoutesV2
           → buildCalendarV2
           → buildAgencyV2
           → buildFeedInfoV2
           → buildTranslationsV2
           → buildTripPatternsAndTimetableFromOdpt
           → writeDataBundle (atomic write)
```

## 実装構成

| ファイル                                                         | 役割                            |
| ---------------------------------------------------------------- | ------------------------------- |
| `pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts`       | GTFS CLI スクリプト             |
| `pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts` | ODPT Train CLI スクリプト       |
| `pipeline/src/lib/pipeline/app-data-v2/gtfs/extract-*.ts`        | GTFS セクション抽出 (8ファイル) |
| `pipeline/src/lib/pipeline/app-data-v2/odpt/build-*.ts`          | ODPT セクション構築 (7ファイル) |
| `pipeline/src/lib/pipeline/app-data-v2/bundle-writer.ts`         | DataBundle 書き込み             |
| `src/types/data/transit-v2-json.ts`                              | 型定義                          |

## Exit Code

| code | label           | 意味                |
| ---- | --------------- | ------------------- |
| 0    | ok              | 成功                |
| 1    | error / partial | 失敗 / 一部失敗     |
| 2    | all failed      | 全失敗 (バッチのみ) |
