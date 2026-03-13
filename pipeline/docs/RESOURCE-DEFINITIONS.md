# Resource Definitions

パイプラインが扱うデータソースの定義。各ソースは TypeScript ファイルとして `pipeline/resources/` に配置する。

## 概要

Resource Definition はデータソースのメタデータ (何を、どこから、どのライセンスで取得するか) とパイプライン処理設定 (どこに、どの prefix で出力するか) を1つのファイルにまとめたものである。

**ファイル名 (拡張子なし) がソース名**となり、CLI 引数や targets ファイルで使用する。

```
pipeline/resources/
├── gtfs/
│   ├── toei-bus.ts          → source-name: "toei-bus"
│   ├── toei-train.ts        → source-name: "toei-train"
│   └── suginami-gsm.ts      → source-name: "suginami-gsm"
└── odpt-json/
    ├── yurikamome-station.ts → source-name: "yurikamome-station"
    ├── yurikamome-railway.ts → source-name: "yurikamome-railway"
    └── yurikamome-station-timetable.ts
```

## 型構造

全てのリソース定義は `BaseResource` (`pipeline/types/resource-common.ts`) を共通基盤とし、フォーマット固有のインターフェースで拡張する。

```
BaseResource
├── GtfsResource         — GTFS/GTFS-JP 固有フィールド
└── OdptJsonResource     — ODPT JSON API 固有フィールド
```

各定義ファイルは `{ resource, pipeline }` を `export default` する。

### BaseResource

全リソース共通のフィールド。

| フィールド       | 型               | 説明                                           |
| ---------------- | ---------------- | ---------------------------------------------- |
| `nameEn`         | `string`         | 英語表示名                                     |
| `nameJa`         | `string`         | 日本語表示名                                   |
| `description`    | `string`         | リソースの自由記述                             |
| `dataFormat`     | `DataFormat`     | データフォーマット (discriminated union)       |
| `license`        | `License`        | ライセンス情報 (name, url)                     |
| `catalog`        | `Catalog`        | データカタログ情報 (odpt / municipal / direct) |
| `provider`       | `Provider`       | データ提供者 (事業者名、URL)                   |
| `authentication` | `Authentication` | 認証要件 (required / none)                     |

### GtfsResource (extends BaseResource)

GTFS/GTFS-JP ソース固有のフィールド。

| フィールド    | 型                | 説明                                                |
| ------------- | ----------------- | --------------------------------------------------- |
| `downloadUrl`       | `string`            | GTFS ZIP のダウンロード URL                                  |
| `routeTypes`        | `GtfsRouteType[]`   | 含まれる路線種別 (`'bus'`, `'rail'`, `'subway'` 等)          |
| `mlitShapeMapping?` | `MlitShapeMapping`  | MLIT GeoJSON からの路線形状マッピング (shapes 生成に使用) |

### OdptJsonResource (extends BaseResource)

ODPT JSON API ソース固有のフィールド。

| フィールド    | 型       | 説明                                        |
| ------------- | -------- | ------------------------------------------- |
| `endpointUrl`      | `string`            | API エンドポイント URL (認証パラメータなし)                  |
| `odptType`         | `string`            | ODPT データ型 (例: `'odpt:Station'`)                         |
| `mlitShapeMapping?` | `MlitShapeMapping` | MLIT GeoJSON からの路線形状マッピング (shapes 生成に使用) |

### PipelineConfig

パイプライン処理設定。全リソース共通。

| フィールド     | 型       | 説明                                                   |
| -------------- | -------- | ------------------------------------------------------ |
| `outDir`       | `string` | 出力ディレクトリ名 (例: `"toei-bus"`, `"yurikamome"`)  |
| `prefix`       | `string` | ID 名前空間の短縮接頭辞 (例: `"tobus"`, `"yrkm"`)      |
| `outFileName?` | `string` | 出力ファイル名 (省略時は URL やメタデータから自動導出) |

## DataFormat

`dataFormat.type` で判別する discriminated union。

| type             | インターフェース     | 追加フィールド            |
| ---------------- | -------------------- | ------------------------- |
| `'GTFS/GTFS-JP'` | `DataFormatGtfsJp`   | `revision?`, `jpVersion?` |
| `'GTFS'`         | `DataFormatGtfs`     | `revision?`               |
| `'ODPT-JSON'`    | `DataFormatOdptJson` | (なし)                    |

```typescript
if (resource.dataFormat.type === 'GTFS/GTFS-JP') {
    resource.dataFormat.jpVersion; // string | undefined
}
```

## Catalog

データカタログの出典情報。`catalog.type` で判別する discriminated union。

| type          | 説明                                  | フィールド          |
| ------------- | ------------------------------------- | ------------------- |
| `'odpt'`      | ODPT (公共交通オープンデータセンター) | `resourceId`, `url` |
| `'municipal'` | 自治体等のカタログサイト              | `url?`              |
| `'direct'`    | カタログなし (直接 URL)               | (なし)              |

## Authentication

認証要件。`authentication.required` で判別する discriminated union。

| required | 説明     | フィールド                  |
| -------- | -------- | --------------------------- |
| `true`   | 認証必要 | `method`, `registrationUrl` |
| `false`  | 認証不要 | (なし)                      |

## 定義ファイルの例

### GTFS ソース

```typescript
// pipeline/resources/gtfs/toei-bus.ts
import type { GtfsSourceDefinition } from '../../types/gtfs-resource';

const toeiBus: GtfsSourceDefinition = {
    resource: {
        nameEn: 'Toei Bus',
        nameJa: '都営バス',
        description:
            'GTFS static data for Toei Bus operated by Bureau of Transportation, Tokyo Metropolitan Government',
        dataFormat: { type: 'GTFS/GTFS-JP', jpVersion: '3.0' },
        license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
        downloadUrl: 'https://api-public.odpt.org/api/v4/files/Toei/data/ToeiBus-GTFS.zip',
        routeTypes: ['bus'],
        catalog: {
            type: 'odpt',
            resourceId: '171a583d-4bf3-4f71-ae57-16f2140babda',
            url: 'https://ckan.odpt.org/dataset/b_bus_gtfs_jp-toei/resource/171a583d-...',
        },
        provider: {
            nameJa: '東京都交通局',
            nameEn: 'Bureau of Transportation, Tokyo Metropolitan Government',
            url: 'https://www.kotsu.metro.tokyo.jp/bus/',
        },
        // GTFS ZIP is publicly accessible; no token needed
        authentication: { required: false },
    },
    pipeline: {
        outDir: 'toei-bus',
        prefix: 'tobus',
    },
};

export default toeiBus;
```

### ODPT JSON ソース

```typescript
// pipeline/resources/odpt-json/yurikamome-station.ts
import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const yurikamomeStation: OdptJsonSourceDefinition = {
    resource: {
        nameEn: 'Yurikamome Station',
        nameJa: 'ゆりかもめ 駅情報',
        description: 'Station data for Yurikamome line: location, multilingual names, ...',
        dataFormat: { type: 'ODPT-JSON' },
        license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
        odptType: 'odpt:Station',
        endpointUrl:
            'https://api.odpt.org/api/v4/odpt:Station?odpt:operator=odpt.Operator:Yurikamome',
        catalog: {
            type: 'odpt',
            resourceId: '48202580-e879-4284-9804-bed64a42356d',
            url: 'https://ckan.odpt.org/dataset/t_info_yurikamome/resource/48202580-...',
        },
        provider: {
            nameJa: 'ゆりかもめ',
            nameEn: 'Yurikamome',
            url: 'https://www.yurikamome.co.jp/',
        },
        authentication: {
            required: true,
            method: 'acl:consumerKey query parameter',
            registrationUrl: 'https://developer.odpt.org/',
        },
    },
    pipeline: {
        outDir: 'yurikamome',
        prefix: 'yrkm',
    },
};

export default yurikamomeStation;
```

## 定義の一覧確認

`npm run pipeline:describe` で全リソース定義を一覧できる。`--verbose` で全フィールド、`--format tsv` でタブ区切り出力。

## 新しいソースの追加手順

1. `pipeline/resources/gtfs/` または `pipeline/resources/odpt-json/` に定義ファイルを作成
2. `pipeline/targets/` の該当 targets ファイルにソース名を追加
3. 単体実行でテスト: `npx tsx pipeline/scripts/download-*.ts <source-name>`
4. バッチ実行で確認: `npx tsx pipeline/scripts/download-*.ts --targets pipeline/targets/...`

## prefix 命名規約

prefix はパイプライン出力における ID の名前空間として使用する。ソースを一意に識別できる短い文字列を割り当てる。

| directory      | prefix   | 由来                                             |
| -------------- | -------- | ------------------------------------------------ |
| `toei-bus`     | `tobus`  | **to**ei **bus**                                 |
| `toei-train`   | `toaran` | **to**ei **ara**kawa + **n**ippori-toneri        |
| `suginami-gsm` | `sggsm`  | **s**u**g**inami **g**reen **s**low **m**obility |
| `yurikamome`   | `yrkm`   | **y**u**r**i**k**a**m**ome                       |
