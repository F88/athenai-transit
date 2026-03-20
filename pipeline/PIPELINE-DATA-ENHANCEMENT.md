# パイプライン データ拡張設計

## 1. 背景と目的

現在のパイプライン (`build-app-data-from-gtfs.ts`) は以下の5つの JSON を生成している:

| ファイル         | 内容                                               | サイズ (tobus / toaran) |
| ---------------- | -------------------------------------------------- | ----------------------- |
| `stops.json`     | 停留所 + 翻訳                                      | 664K / 20K              |
| `routes.json`    | 路線                                               | 12K / 4K                |
| `calendar.json`  | 運行カレンダー + 例外                              | 20K / 4K                |
| `timetable.json` | 時刻表 (stop → route/headsign → service → minutes) | 5.1M / 600K             |
| `shapes.json`    | 路線形状                                           | 944K / 48K              |

しかし、GTFS/GTFS-JP に含まれる以下の重要データが欠落している:

- **事業者情報** (agency) — 路線がどの事業者のものか不明
- **路線翻訳** — route_long_name の多言語名がない
- **行先翻訳** — headsign の多言語名がない
- **提供情報** (feed_info) — データの有効期間やバージョンがない
- **帰属情報** (attributions) — データの出典/ライセンス情報がない

これらは今後の多事業者対応、i18n、データ鮮度管理に不可欠。

また、GTFS 以外のデータソース (ODPT JSON API) にも対応し、GTFS では提供されない路線の駅情報や時刻表を取り込む。

---

## 2. リソース定義 (実装済み)

### 2.1 概要

データソースの定義は**1リソース = 1 TypeScript ファイル**の構造で管理している。各ファイルはメタデータ + パイプライン設定を自己完結で持つ。

### 2.2 ディレクトリ構造

```plain
pipeline/
├── types/                          ← 型定義
│   ├── resource-common.ts           ← 共通型 (Provider, License, Catalog, Authentication, PipelineConfig)
│   ├── gtfs-resource.ts             ← GTFS Static 固有型 (GtfsSourceDefinition, GtfsResource, DataFormat, GtfsRouteType)
│   └── odpt-json-resource.ts        ← ODPT JSON API 固有型 (OdptJsonSourceDefinition, OdptJsonResource, OdptDataType)
├── resources/                      ← リソース定義 (git 管理、data/ とは分離)
│   ├── gtfs/
│   │   ├── toei-bus.ts              ← 都営バス (GTFS-JP 3.0)
│   │   ├── toei-train.ts            ← 都営電車 (GTFS-JP 3.0)
│   │   └── suginami-gsm.ts          ← 杉並区グリーンスローモビリティ (GTFS-JP)
│   └── odpt-json/
│       ├── yurikamome-station.ts     ← ゆりかもめ 駅情報
│       ├── yurikamome-railway.ts     ← ゆりかもめ 路線情報
│       └── yurikamome-station-timetable.ts ← ゆりかもめ 駅時刻表
├── data/                           ← ダウンロードデータ (消して再取得可能)
│   └── gtfs/
│       ├── toei-bus/
│       └── toei-train/
└── scripts/
```

**`pipeline/resources/` と `pipeline/workspace/data/` を分離した理由**: `workspace/data/` はダウンロードした生データの格納先であり、`rm -rf pipeline/workspace/data` で再取得可能にすべき。リソース定義は git 管理されるコードなので混在させない。

### 2.3 型設計

共通型 (`resource-common.ts`):

| 型               | 説明                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| `PipelineConfig` | `outDir`, `prefix`, `outFileName?` — 全リソース共通のパイプライン設定     |
| `Provider`       | `nameJa`, `nameEn`, `url?` — データ提供者                                 |
| `License`        | `name`, `url` — ライセンス情報                                            |
| `Catalog`        | Discriminated Union: `CatalogOdpt` / `CatalogMunicipal` / `CatalogDirect` |
| `Authentication` | Discriminated Union: `AuthenticationRequired` / `AuthenticationNone`      |

GTFS 固有型 (`gtfs-resource.ts`):

| 型                     | 説明                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| `GtfsSourceDefinition` | `{ resource: GtfsResource, pipeline: PipelineConfig }`                      |
| `GtfsResource`         | GTFS ZIP のメタデータ (名称, ライセンス, DL URL, プロバイダ等)              |
| `DataFormat`           | Discriminated Union: `DataFormatGtfsJp` (`jpVersion?`) / `DataFormatGtfs`   |
| `GtfsRouteType`        | `'bus' \| 'tram' \| 'subway' \| 'rail' \| 'monorail' \| ...` (文字列 union) |

ODPT JSON 固有型 (`odpt-json-resource.ts`):

| 型                         | 説明                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `OdptJsonSourceDefinition` | `{ resource: OdptJsonResource, pipeline: PipelineConfig }`           |
| `OdptJsonResource`         | ODPT JSON API エンドポイントのメタデータ                             |
| `OdptDataType`             | `'odpt:Station' \| 'odpt:Railway' \| 'odpt:StationTimetable' \| ...` |

### 2.4 データソース一覧

| リソース                     | 形式        | プロバイダ   | prefix   | routeTypes / odptType            |
| ---------------------------- | ----------- | ------------ | -------- | -------------------------------- |
| toei-bus                     | GTFS-JP 3.0 | 東京都交通局 | `tobus`  | `['bus']`                        |
| toei-train                   | GTFS-JP 3.0 | 東京都交通局 | `toaran` | `['tram', 'subway', 'monorail']` |
| suginami-gsm                 | GTFS-JP     | 杉並区       | `sggsm`  | `['bus']`                        |
| yurikamome-station           | ODPT JSON   | ゆりかもめ   | `yrkm`   | `odpt:Station`                   |
| yurikamome-railway           | ODPT JSON   | ゆりかもめ   | `yrkm`   | `odpt:Railway`                   |
| yurikamome-station-timetable | ODPT JSON   | ゆりかもめ   | `yrkm`   | `odpt:StationTimetable`          |

### 2.5 移行状況

全パイプラインスクリプトは TypeScript ベースのリソース定義ローダー `loadAllGtfsSources()` を使用している。

---

## 3. 現状のデータソース棚卸し (GTFS)

### 3.1 GTFS ファイル一覧

| ファイル              | toei-bus        | toei-train   | 現在の利用                     | 今回追加 |
| --------------------- | --------------- | ------------ | ------------------------------ | -------- |
| `agency.txt`          | あり            | あり         | DB のみ                        | **対象** |
| `stops.txt`           | あり            | あり         | JSON 出力済み                  | —        |
| `routes.txt`          | あり            | あり         | JSON 出力済み (agency_id 欠落) | **拡張** |
| `trips.txt`           | あり            | あり         | timetable 構築に使用           | —        |
| `stop_times.txt`      | あり            | あり         | timetable 構築に使用           | —        |
| `calendar.txt`        | あり            | あり         | JSON 出力済み                  | —        |
| `calendar_dates.txt`  | あり            | あり         | JSON 出力済み                  | —        |
| `shapes.txt`          | あり            | なし         | JSON 出力済み                  | —        |
| `translations.txt`    | あり (12,253行) | あり (405行) | stop_name のみ抽出             | **拡張** |
| `feed_info.txt`       | あり            | あり         | 未使用                         | **対象** |
| `attributions.txt`    | あり            | なし         | 未使用                         | **対象** |
| `agency_jp.txt`       | あり            | なし         | 未使用                         | 対象外   |
| `office_jp.txt`       | あり            | なし         | 未使用                         | 対象外   |
| `fare_attributes.txt` | あり            | あり         | 未使用                         | 対象外   |
| `fare_rules.txt`      | あり            | あり         | 未使用                         | 対象外   |

### 3.2 translations.txt の内容

**toei-bus** (record_id 形式):

| table_name   | field_name      | 言語            | 行数               |
| ------------ | --------------- | --------------- | ------------------ |
| `stops`      | `stop_name`     | ja, ja-Hrkt, en | ~4,000 stops x 3   |
| `trips`      | `trip_headsign` | ja, ja-Hrkt, en | ~184 headsigns x 3 |
| `stop_times` | `stop_headsign` | ja              | ~616               |

**toei-train** (field_value 形式):

| table_name | field_name        | 言語   | 行数              |
| ---------- | ----------------- | ------ | ----------------- |
| `agency`   | `agency_name`     | ja, en | 2                 |
| `routes`   | `route_long_name` | ja, en | 12 (6 routes x 2) |
| `stops`    | `stop_name`       | ja, en | ~190 stops x 2    |
| `trips`    | `trip_headsign`   | ja, en | ~20 headsigns x 2 |

### 3.3 agency.txt の内容

```plain
# toei-bus
agency_id: 8000020130001
agency_name: 都営バス
agency_url: https://www.kotsu.metro.tokyo.jp/bus/

# toei-train
agency_id: toei
agency_name: 東京都交通局
agency_url: https://www.kotsu.metro.tokyo.jp/
```

### 3.4 feed_info.txt の内容

```plain
feed_publisher_name: 東京都交通局
feed_start_date: 20260305
feed_end_date: 20290304
feed_version: 20260305_030658

# toei-train
feed_publisher_name: 東京都交通局
feed_start_date: 20251213
feed_end_date: 20261231
feed_version: 20260224
```

### 3.5 attributions.txt の内容 (toei-bus のみ)

```plain
organization_name: 東京都交通局 (operator, authority, data_source)
organization_name: 公共交通オープンデータ協議会 (producer)
```

---

## 4. 設計方針

### 4.1 ファイル構成

新規 JSON ファイルは**独立ファイル**として追加する。既存ファイルの構造変更を最小限に抑え、DataSource の fetch を追加する形とする。

変更後のファイル構成 (per source):

```plain
public/data/{prefix}/
  stops.json          (既存)
  routes.json         (既存 → 拡張: agency_id, translations)
  calendar.json       (既存)
  timetable.json      (既存)
  shapes.json         (既存)
  agency.json          ← 新規
  feed-info.json       ← 新規
  translations.json    ← 新規 (headsign 等の翻訳ルックアップ)
```

### 4.2 翻訳データの格納戦略

| 対象            | 格納先                                 | 理由                                                                                                          |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| stop_name       | `stops.json` の `m` フィールド (既存)  | 1 stop : 1 翻訳セット、重複なし                                                                               |
| route_long_name | `routes.json` の `m` フィールド (新規) | 1 route : 1 翻訳セット、重複なし                                                                              |
| agency_name     | `agency.json` の `m` フィールド (新規) | 1 agency : 1 翻訳セット、重複なし                                                                             |
| trip_headsign   | **`translations.json`** (新規)         | 同一 headsign が多数の timetable group で重複。ルックアップテーブルに分離して timetable.json のサイズ増を回避 |
| stop_headsign   | **`translations.json`** (新規)         | 同上                                                                                                          |

### 4.3 translations.json の構造

headsign 文字列をキーとしたルックアップテーブル:

```jsonc
{
    "headsigns": {
        // trip_headsign の翻訳 (trips.trip_headsign)
        "東京駅丸の内北口": {
            "en": "Tokyo Sta. Marunouchi North Exit",
            "ja-Hrkt": "とうきょうえきまるのうちきたぐち",
        },
        "浅草寿町": { "en": "Asakusa-Kotobukicho", "ja-Hrkt": "あさくさことぶきちょう" },
        // ...
    },
    "stop_headsigns": {
        // stop_times.stop_headsign の翻訳 (toei-bus のみ、ja のみ)
        // 現時点では ja しかないため、実質空になる可能性が高い
        // → 将来の多言語化に備えて構造だけ用意
    },
}
```

**サイズ見積もり**: toei-bus ~184 headsigns x 3 lang + toei-train ~20 headsigns x 2 lang → 数 KB 程度。timetable.json に埋め込む場合と比較して大幅に軽量。

---

## 5. 変更詳細

### 5.1 新規: `agency.json`

```ts
// Wire 型 (transit-json.ts)
interface AgencyJson {
    i: string; // agency_id (prefixed, e.g. "tobus:8000020130001")
    n: string; // agency_name
    m: Record<string, string>; // agency_names (translations: lang → name)
    u: string; // agency_url
    l: string; // agency_lang
}
```

```ts
// App 型 (transit.ts)
interface Agency {
    agency_id: string;
    agency_name: string;
    agency_names: Record<string, string>;
    agency_url: string;
    agency_lang: string;
}
```

**パイプライン**: `extractAgencies(db, prefix)` を追加。translations テーブルから `table_name='agency' AND field_name='agency_name'` を結合。

### 5.2 新規: `feed-info.json`

```ts
// Wire 型 (transit-json.ts)
interface FeedInfoJson {
    pn: string; // feed_publisher_name
    pu: string; // feed_publisher_url
    l: string; // feed_lang
    s: string; // feed_start_date "YYYYMMDD"
    e: string; // feed_end_date "YYYYMMDD"
    v: string; // feed_version
}
```

```ts
// App 型 (transit.ts)
interface FeedInfo {
    feed_publisher_name: string;
    feed_publisher_url: string;
    feed_lang: string;
    feed_start_date: string; // "YYYYMMDD"
    feed_end_date: string; // "YYYYMMDD"
    feed_version: string;
}
```

**パイプライン**: `extractFeedInfo(db, prefix)` を追加。feed_info テーブルの1行を読み取り。

**用途**:

- データ鮮度バリデーション (`feed_end_date` < 今日 → 警告)
- InfoDialog でのデータバージョン/有効期間表示
- TODO.md「日時指定の限界」課題への対応基盤

### 5.3 新規: `translations.json`

```ts
// Wire 型 (transit-json.ts)
interface TranslationsJson {
    /** trip_headsign → { lang → translation } */
    headsigns: Record<string, Record<string, string>>;
    /** stop_headsign → { lang → translation } (stop_times 由来) */
    stop_headsigns: Record<string, Record<string, string>>;
}
```

**パイプライン**: `extractTranslations(db, prefix)` を追加。

```sql
-- trip_headsign translations
SELECT DISTINCT t.language, t.translation, t.field_value
FROM translations t
WHERE t.table_name = 'trips' AND t.field_name = 'trip_headsign'

-- stop_headsign translations
SELECT DISTINCT t.language, t.translation, t.field_value
FROM translations t
WHERE t.table_name = 'stop_times' AND t.field_name = 'stop_headsign'
```

### 5.4 拡張: `routes.json`

現在:

```ts
interface RouteJson {
    i: string; // route_id
    s: string; // route_short_name
    l: string; // route_long_name
    t: number; // route_type
    c: string; // route_color
    tc: string; // route_text_color
}
```

変更後:

```ts
interface RouteJson {
    i: string; // route_id
    s: string; // route_short_name
    l: string; // route_long_name
    t: number; // route_type
    c: string; // route_color
    tc: string; // route_text_color
    m: Record<string, string>; // route_names (translations) ← 追加
    ai: string; // agency_id (prefixed) ← 追加
}
```

```ts
// App 型 (transit.ts) Route の拡張
interface Route {
    // ... existing
    route_names: Record<string, string>; // ← 追加
    agency_id: string; // ← 追加
}
```

**パイプライン** (`extractRoutes`):

- translations テーブルから route_long_name の翻訳を取得 (extractStops と同じパターン)
- routes テーブルの `agency_id` カラムを取得してプレフィックス付きで出力

---

## 6. WebApp 側の変更

### 6.1 型定義

| ファイル                         | 変更内容                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `src/types/data/transit-json.ts` | `AgencyJson`, `FeedInfoJson`, `TranslationsJson` 追加。`RouteJson` に `m`, `ai` 追加 |
| `src/types/app/transit.ts`       | `Agency`, `FeedInfo` 追加。`Route` に `route_names`, `agency_id` 追加                |

### 6.2 DataSource

| ファイル                                 | 変更内容                                                             |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `src/datasources/transit-data-source.ts` | `SourceData` に `agencies`, `feedInfo`, `translations` を追加        |
| `src/datasources/fetch-data-source.ts`   | `agency.json`, `feed-info.json`, `translations.json` の fetch を追加 |

### 6.3 Repository

| ファイル                                 | 変更内容                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/repositories/athenai-repository.ts` | Agency マージ、FeedInfo マージ、Route 変換に `route_names`/`agency_id` 追加、headsign 翻訳マップの保持、新メソッド追加 |
| `src/repositories/transit-repository.ts` | インターフェースに `getAgencies()`, `getFeedInfo()` 追加                                                               |
| `src/repositories/mock-repository.ts`    | 新フィールド対応                                                                                                       |

### 6.4 i18n 関数

| ファイル                                          | 変更内容                                     |
| ------------------------------------------------- | -------------------------------------------- |
| `src/domain/transit/i18n/translate-route-name.ts` | `route.route_names[lang]` を使用するよう更新 |
| `src/domain/transit/i18n/translate-headsign.ts`   | **新規**: headsign 翻訳関数                  |
| `src/domain/transit/get-route-display-names.ts`   | `subNames` に翻訳名を含める                  |

### 6.5 バリデーション

| ファイル                                         | 変更内容                             |
| ------------------------------------------------ | ------------------------------------ |
| `pipeline/scripts/app-data/validate-app-data.ts` | 新規 JSON ファイルの存在チェック追加 |

---

## 7. データフロー (変更後)

```plain
GTFS CSV (15 files)
  ↓ build-gtfs-db.ts
SQLite DB (全テーブル格納済み)
  ↓ build-app-data-from-gtfs.ts
JSON (8 files per source):
  stops.json          ← stops + translations(stop_name)
  routes.json         ← routes + translations(route_long_name) + agency_id
  calendar.json       ← calendar + calendar_dates
  timetable.json      ← trips + stop_times (headsign は生テキスト)
  shapes.json         ← shapes (via trips)
  agency.json         ← agency + translations(agency_name)     [NEW]
  feed-info.json      ← feed_info                              [NEW]
  translations.json   ← translations(trip_headsign, stop_headsign) [NEW]
  ↓ data:sync
public/data/{prefix}/
  ↓ FetchDataSource.load()
SourceData (8 JSON files)
  ↓ GtfsRepository.create()
In-memory domain objects (Stop, Route, Agency, FeedInfo, ...)
```

---

## 8. 実装フェーズ

### Phase 1: パイプライン + 型定義

**目的**: 新しい JSON ファイルを生成できるようにする

- `build-app-data-from-gtfs.ts` に `extractAgencies`, `extractFeedInfo`, `extractTranslations` を追加
- `extractRoutes` に translations と agency_id の取得を追加
- `transit-json.ts` に Wire 型を追加/拡張
- `transit.ts` に App 型を追加/拡張
- `validate-app-data.ts` に新規ファイルのチェック追加
- パイプライン実行して JSON 生成を確認

### Phase 2: DataSource + Repository

**目的**: WebApp が新しいデータを読み込めるようにする

- `SourceData`, `TransitDataSource` に新フィールド追加
- `FetchDataSource` に新規 JSON の fetch 追加
- `GtfsRepository` に Agency, FeedInfo, translations のマージ/保持ロジック追加
- Route 変換に `route_names`, `agency_id` を追加
- `TransitRepository` インターフェースに新メソッド追加
- `MockRepository` を新インターフェースに対応

### Phase 3: i18n 関数 + UI 統合

**目的**: 翻訳データを実際の UI で活用する

- `translateRouteName` の更新
- `translateHeadsign` の新規作成
- `getRouteDisplayNames` の `subNames` 更新
- テスト追加
- InfoDialog へのデータバージョン表示 (FeedInfo 活用)

---

## 9. 未決定事項

- [ ] `attributions.txt` の扱い: toei-bus にのみ存在。InfoDialog の出典表示に使えるが、今回のスコープに含めるか?
- [ ] DepartureGroup への headsign_names 追加: Repository が translations.json のルックアップテーブルを保持し、headsign → translations を解決する。DepartureGroup 自体に持たせるか、UI が直接ルックアップするか?
- [ ] StopWithMeta の `source_id` / `source_name` 追加 (TODO.md 記載): Agency 情報が入れば対応可能だが、今回のスコープに含めるか?
- [ ] feed_info によるデータ鮮度警告 UI: 設計のみか、表示まで実装するか?
- [ ] MLIT 鉄道データ (`pipeline/workspace/data/mlit/N02-24_RailroadSection.geojson`) の DL 自動化:
    - 利用規約: <https://nlftp.mlit.go.jp/ksj/other/agreement_01.html>
    - データ: <https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2024.html>
    - 年1回更新。DL スクリプトは低優先度。

---

## 10. 参照ファイル

### リソース定義

- `pipeline/types/resource-common.ts` — 共通型 (PipelineConfig, Provider, License, Catalog, Authentication)
- `pipeline/types/gtfs-resource.ts` — GTFS Static 型 (GtfsSourceDefinition, DataFormat, GtfsRouteType)
- `pipeline/types/odpt-json-resource.ts` — ODPT JSON API 型 (OdptJsonSourceDefinition, OdptDataType)
- `pipeline/resources/gtfs/` — GTFS リソース定義 (toei-bus, toei-train, suginami-gsm)
- `pipeline/resources/odpt-json/` — ODPT JSON リソース定義 (yurikamome-station, railway, station-timetable)

### パイプラインスクリプト

- `pipeline/scripts/app-data/build-app-data-from-gtfs.ts` — メイン変更対象
- `pipeline/scripts/build-gtfs-db.ts` — DB スキーマ (変更なし)
- `pipeline/scripts/app-data/validate-app-data.ts` — バリデーション拡張

### WebApp 型定義

- `src/types/data/transit-json.ts` — Wire 型
- `src/types/app/transit.ts` — App 型

### DataSource / Repository

- `src/datasources/transit-data-source.ts` — SourceData
- `src/datasources/fetch-data-source.ts` — HTTP fetch
- `src/repositories/athenai-repository.ts` — データマージ/クエリ
- `src/repositories/transit-repository.ts` — インターフェース
- `src/repositories/mock-repository.ts` — テスト用

### i18n

- `src/domain/transit/i18n/translate-route-name.ts`
- `src/domain/transit/i18n/translate-stop-name.ts` (参考パターン)
- `src/domain/transit/get-route-display-names.ts`
- `src/domain/transit/get-stop-display-names.ts` (参考パターン)

### GTFS 仕様

- `pipeline/docs/gtfs-jp-spec-v3.txt` — GTFS-JP v3 仕様書
- `pipeline/docs/GTFS-JP_UPDATE.md` — v4 改訂情報
