# Development Guide

## Code Quality

### テスト

- 全ての `src/utils/`、`src/domain/` 関数にはテストコード必須
- `pipeline/src/lib/`、`pipeline/scripts/` の関数にもテスト必須
- エッジケースを含め品質を保証するテストとすること
- テストはタイムゾーンに依存しないこと (相対比較やエポックミリ秒を使用)

### Lint / Format

コミット前に以下を実行:

```bash
npm run typecheck && npm run format && npm run lint:fix && npm run build
```

### コーディング規約

- **TSDoc**: エクスポートする全ての関数と型定義には TSDoc (`@param`, `@returns`) を付与
- **命名**: 変数名/関数名は自明で的確にする。曖昧な命名を避ける
- **ブレース**: if 文は単行でも必ずブレースを付ける
- **意図コメント**: 実装が意図と異なって見える箇所には、選択理由を説明するコメントを付与

### ファイル構成

以下の配置ルールは webapp の `src/` 配下に適用する。`pipeline/` は別責務のため、同じ分類基準を直接適用しない。

| ディレクトリ         | 配置基準                                                             |
| -------------------- | -------------------------------------------------------------------- |
| `src/domain/`        | ドメイン固有の純粋関数 (例: transit ロジック、i18n)                  |
| `src/utils/`         | 汎用の純粋関数 (外部ライブラリ依存なし)                              |
| `src/lib/`           | 外部ライブラリ依存ヘルパー (例: Leaflet)                             |
| `src/hooks/`         | カスタム React Hooks (状態 + 副作用のオーケストレーション)           |
| `src/components/`    | React コンポーネント (ロジックは import して使用)                    |
| `src/components/ui/` | shadcn/ui コンポーネント (CLI 管理)                                  |
| `src/repositories/`  | データアクセス層 (`TransitRepository` インターフェース)              |
| `src/types/`         | 型定義                                                               |
| `src/config/`        | 設定値                                                               |
| `pipeline/`          | データパイプライン ([pipeline/README.md](./pipeline/README.md) 参照) |

#### 配置判断の詳細

ファイルの配置は「そのコードが何を知っているか」で判断する。

- `src/domain/`
  このアプリ固有の意味やルールを持つコードを置く。ライブラリの使い方ではなく、「何を表示するべきか」「どう扱うべきか」という判断を持つもの。
- `src/lib/`
  外部ライブラリやブラウザ API に依存する技術的なヘルパーを置く。Leaflet 操作、DOM 操作、adapter 的な処理はこちら。
- `src/utils/`
  依存が薄く、ドメイン知識をほとんど持たない軽量な補助関数を置く。`utils` は domain や lib の代替置き場ではなく、domain と lib の両方から使える純粋ロジックの置き場と考える。

#### 依存方向

- `domain` と `lib` は直接依存させない
- `lib` から `domain` を import しない
- `domain` から `lib` を import しない
- domain と lib の両方から使いたい純粋関数は `src/utils/` に置く
- `hooks` / `components` は `domain`、`utils`、`lib` を組み合わせてよいが、非 UI ロジックを TSX に戻さない

#### `src/domain/` の分割方針

- `src/domain/transit/`
  GTFS、時刻表、route/stop、service day など transit 自体のルール。
- `src/domain/map/`
  地図画面における選択、route shape 表示、layer 構築、map 向け filter など、地図上の見せ方に関わるルール。
- 新しいサブディレクトリを作る判断
  `transit` や `map` に自然に収まらないまとまりが継続的に増えた場合に限る。単発の整理のために増やさないこと。少数ファイルを移すためだけに新しい分類を作らず、まず既存の `transit` / `map` / `utils` / `lib` に収まるかを検討する。

#### mixed-purpose file の扱い

- 配置は「補助的に何を使うか」ではなく「主たる責務は何か」で決める
- 技術的ヘルパーとアプリ固有の判断が同居している場合、主たる責務が明確ならその責務側に置く
- 主たる責務が 2 つに割れており、片方が `lib` で片方が `domain` / `utils` に属する場合は分割を優先する
- `utils` に置いてよいのは、移動先が決めにくいファイルではなく、アプリ固有の判断をほとんど持たない純粋関数だけ

#### 判断ルール

- アプリ固有の判断を含むなら `utils` ではなく `domain`
- Leaflet や DOM 前提なら `domain` ではなく `lib`
- 地図画面での表示・選択・可視判定に依存するなら `src/domain/map/`
- GTFS / timetable / service day の意味に依存するなら `src/domain/transit/`
- transit / map のどちらにも自然に収まらない場合でも、まず `domain` か `utils` か `lib` の責務を先に決める
- `utils` は domain の代替置き場にしない

#### 具体例

- `src/domain/map/`
  `selection.ts`, `route-shapes.ts`, `map-selection-layers.ts`, `stop-filter.ts`, `focus-position.ts`, `render-mode.ts`
- `src/domain/transit/`
  `service-day.ts`, `timetable-filter.ts`, `timetable-utils.ts`
- `src/utils/`
  `datetime.ts`, `day-of-week.ts`, `kana-normalize.ts`, `truncate-label.ts`
- `src/lib/`
  `leaflet-helpers.ts`, `map-zoom.ts`, `double-tap-zoom.ts`

## Logger

### Basic Usage

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('GTFS');

logger.debug('Loading sources:', prefixes);
logger.info('Repository initialized');
logger.warn('Skipping invalid source:', prefix);
logger.error('Failed to fetch data:', error);
```

### Log Levels

| Level   | Use case                                                       |
| ------- | -------------------------------------------------------------- |
| `debug` | Detailed trace for development (bounds queries, render counts) |
| `info`  | Notable events (initialization complete, data loaded)          |
| `warn`  | Recoverable issues (skipped source, fallback used)             |
| `error` | Failures requiring attention (fetch errors, unexpected state)  |

### Output Format

```text
[14:05:23.456] [GTFS] Loading sources: ["tobus", "toaran"]
```

Each level maps to its corresponding `console` method (`console.debug`, `console.info`, `console.warn`, `console.error`).

### Level Filter

Default levels are set via environment variables:

| Environment | `VITE_LOG_LEVEL` | `VITE_LOG_TAGS`  |
| ----------- | ---------------- | ---------------- |
| development | `debug`          | `*` (all tags)   |
| production  | `warn`           | (empty, no tags) |

### Tag Filter

Tags are comma-separated patterns set via `VITE_LOG_TAGS`.

| Pattern | Meaning                                                           |
| ------- | ----------------------------------------------------------------- |
| `*`     | Match all tags                                                    |
| `GTFS`  | Exact match                                                       |
| `Stop*` | Prefix match (matches `StopMarkerDom`, `StopMarkersCanvas`, etc.) |
| `-App`  | Exclude tag (negation takes priority)                             |

**Note:** `warn` and `error` logs always bypass tag filtering.

### DevTools Helper (development only)

In development builds, `window.__log` is available in the browser console:

```javascript
// Change log level (in-memory, resets on reload)
__log.setLevel('debug');
__log.setLevel('warn');

// Change tag filter (in-memory, resets on reload)
__log.setTags('GTFS', 'Stop*');
__log.setTags('*', '-App');

// View current config
__log.getConfig();
```

Changes take effect immediately without page reload.

## z-index 階層

Leaflet のカスタム pane を使い、描画レイヤーの前後関係を制御する。数値が大きいほど前面に描画される。

| z-index | 用途                                                                |
| ------- | ------------------------------------------------------------------- |
| 200     | `tilePane` — ベースマップタイル (地理院地図)                        |
| 340     | `routeShapeOutlinePane` — 路線図のアウトライン (選択時の縁取り)     |
| 350     | `routeShapePane` — 路線図の塗り (fill)                              |
| 400     | `overlayPane` — 停留所マーカー等のオーバーレイ                      |
| 500     | EdgeMarkerOverlay                                                   |
| 600     | `shadowPane` — マーカーの影                                         |
| 700     | `markerPane` — マーカー本体                                         |
| 1000    | MapOverlayButton, BottomSheet                                       |
| 1001    | SelectionIndicator, Portal/History dropdown trigger                 |
| 1002    | Portal/History SelectContent (dropdown list)                        |
| 2000    | モーダルダイアログ (shadcn Dialog, StopSearchModal, TimetableModal) |

> **Note**: outline pane は fill pane より低い z-index を持つ必要がある。react-leaflet の Polyline は Leaflet の `addTo()` を通じて pane 末尾に append されるため、同一 pane 内では mount 順に依存した描画順になる。pane を分離することで mount 順に関係なく正しい前後関係を保証する。

## マップのパン/ズーム制御

### パントリガー一覧

地図を移動させる全操作。全てのパンは `smoothMoveTo()` (`lib/leaflet-helpers.ts`) を経由する。

| 操作                        | 経由メソッド          | ズーム               | パン方式                  |
| --------------------------- | --------------------- | -------------------- | ------------------------- |
| StopMarker クリック         | `selectStop()`        | 維持                 | `PanToFocus`              |
| EdgeMarker クリック         | `selectStop()`        | 維持                 | `PanToFocus`              |
| BottomSheet の停留所タップ  | `selectStopById()`    | 維持                 | `PanToFocus`              |
| 検索結果から選択            | `focusStop()`         | 維持                 | `PanToFocus`              |
| 履歴から選択                | `focusStop()`         | 維持                 | `PanToFocus`              |
| SelectionIndicator クリック | 直接 `smoothMoveTo()` | 維持                 | 直接呼び出し _(現在無効)_ |
| 現在地ボタン                | 直接 `smoothMoveTo()` | **→ `LOCATE_ZOOM`**  | 直接呼び出し              |
| ホームボタン                | 直接 `smoothMoveTo()` | **→ `INITIAL_ZOOM`** | 直接呼び出し              |

パンしない操作:

| 操作                 | 経由                 | 効果                    |
| -------------------- | -------------------- | ----------------------- |
| RouteShape クリック  | `selectRouteShape()` | 選択のみ、移動なし      |
| 空の地図クリック     | `deselectStop()`     | 選択解除、移動なし      |
| ユーザーが地図をパン | `clearFocus()`       | stale な focus をクリア |

### smoothMoveTo

`lib/leaflet-helpers.ts` の `smoothMoveTo(map, target, zoom)` は移動距離に応じてアニメーション方式を選択する:

- 距離 < ~50m かつズーム一致 → `map.setView()` (即座に移動)
- それ以外 → `map.flyTo()` (1秒アニメーション)

### PanToFocus

`PanToFocus` (`components/map/map-view.tsx`) は `focusPosition` の参照変化を監視し、変化があれば `smoothMoveTo()` を呼ぶ。`focusPosition` は `useSelection` Hook 内の `resolveFocusPosition()` で解決される:

1. `directFocusPosition` (検索/履歴で設定) が優先
2. なければ `radiusStops` → `inBoundStops` から選択中の停留所を検索
3. どちらにもなければ `null` (パンなし)

`directFocusPosition` が `null` の場合 (マーカー/BottomSheet からの選択時) は `useStableLatLng` で参照を安定化するため、同じ座標では `useEffect` が発火せずパンしない。`directFocusPosition` が非 `null` の場合 (検索/履歴) は安定化をバイパスし、同じ停留所への再フォーカスでもパンが発火する。

## マップのクリック/タップイベント制御

Leaflet のデフォルトクリック挙動を複数箇所でオーバーライドしている。変更時は相互依存に注意。

### イベントフロー

```text
[touchstart] → double-tap-detector: 2nd tap 判定
    ↓
[touchend] → 1st tap 記録 (timestamp + position)
    ↓ (300ms 待機)
[click] → capture phase で遅延 → 2nd tap が来なければ再 dispatch
```

### ジェスチャー/操作仕様

#### タッチデバイス (モバイル)

| ジェスチャー            | 動作                                                               | 実装                     |
| ----------------------- | ------------------------------------------------------------------ | ------------------------ |
| タップ                  | 通常のクリック (停留所選択、地図クリック等)                        | (Leaflet デフォルト)     |
| ダブルタップ            | タップ位置に1段階ズームイン                                        | `lib/double-tap-zoom.ts` |
| ダブルタップ + スライド | 上下スライドでズーム (方向は `doubleTapDrag` 設定で切替、下表参照) | `lib/double-tap-zoom.ts` |
| ピンチズーム            | 通常のズーム                                                       | (Leaflet デフォルト)     |

#### マウスデバイス (デスクトップ)

| 操作                      | 動作                                                               | 実装                     |
| ------------------------- | ------------------------------------------------------------------ | ------------------------ |
| クリック                  | 通常のクリック                                                     | (Leaflet デフォルト)     |
| ダブルクリック            | クリック位置に1段階ズームイン                                      | `lib/double-tap-zoom.ts` |
| ダブルクリック + ドラッグ | 上下ドラッグでズーム (方向は `doubleTapDrag` 設定で切替、下表参照) | `lib/double-tap-zoom.ts` |
| スクロールホイール        | ズームイン/アウト                                                  | (Leaflet デフォルト)     |
| ドラッグ                  | パン                                                               | (Leaflet デフォルト)     |

> **Note**: Leaflet 組み込みの doubleClickZoom は `enableDoubleTapZoom()` で無効化されている。代わりに `lib/double-tap-zoom.ts` 内で `mousedown`/`mouseup` のタイミングから独自にダブルクリックを検出し、`setZoomAround()` を直接呼び出す実装になっている (Leaflet の `dblclick` イベントは使用していない)。

#### `doubleTapDrag` 設定 (`UserSettings`)

| 値                        | 上にドラッグ | 下にドラッグ | 代表アプリ  |
| ------------------------- | ------------ | ------------ | ----------- |
| `'zoom-out'` (デフォルト) | ズームアウト | ズームイン   | Google Maps |
| `'zoom-in'`               | ズームイン   | ズームアウト | Apple Maps  |

### クリック制御メカニズム一覧

| #   | メカニズム                     | ファイル                                    | イベント        | フェーズ | 目的                                                                  |
| --- | ------------------------------ | ------------------------------------------- | --------------- | -------- | --------------------------------------------------------------------- |
| 1   | クリック遅延 (300ms)           | `lib/double-tap-detector.ts`                | `click`         | capture  | 1st tap のクリックを遅延し、2nd tap が来たらキャンセル                |
| 2   | ピンチズーム後の誤クリック抑制 | `components/map/map-view.tsx`               | Leaflet `click` | —        | zoomend から 600ms 以内のクリックを無視                               |
| 3   | Edge Marker ヒット検出         | `components/marker/edge-markers-canvas.tsx` | `click`         | capture  | Canvas 上の矢印クリックを検出、`stopPropagation` で地図クリックを抑止 |
| 4   | Stop Marker クリック           | `components/marker/stop-markers-canvas.tsx` | Leaflet `click` | —        | `bubblingMouseEvents: false` で地図への伝搬を防止                     |
| 5   | Route Shape クリック           | `components/map/route-shape-polyline.tsx`   | Leaflet `click` | —        | `bubblingMouseEvents: false` で地図への伝搬を防止                     |

### 定数

全定数は `src/utils/map-click.ts` に集約。

| 定数                    | 値    | 用途                                                                     |
| ----------------------- | ----- | ------------------------------------------------------------------------ |
| `DOUBLE_TAP_WINDOW_MS`  | 300ms | 1st tap end → 2nd tap start の許容間隔                                   |
| `MAX_TAP_DRIFT_PX`      | 30px  | 2タップ間の許容ドリフト距離                                              |
| `PIXELS_PER_ZOOM_LEVEL` | 100px | スライド距離 → ズームレベル変換                                          |
| `CLICK_SUPPRESSION_MS`  | 600ms | ピンチズーム後のクリック抑制窓 (300ms ブラウザ遅延 + 300ms クリック遅延) |

### Leaflet オーバーライド

| 設定              | 変更内容                   | 理由                                     | 復元タイミング            |
| ----------------- | -------------------------- | ---------------------------------------- | ------------------------- |
| `doubleClickZoom` | `disable()`                | 独自ダブルタップ実装との競合回避         | cleanup 関数で `enable()` |
| `zoomSnap`        | スライド中 `0`、終了時 `1` | スライド中の滑らかなフラクショナルズーム | `touchend` で復元         |
| `dragging`        | スライド中 `disable()`     | パン操作との誤認防止                     | `touchend` で `enable()`  |

### 注意事項

- **クリック遅延の波及**: 全てのクリックが 300ms 遅延するため、UI の即時応答が必要な場合は `touchend` で処理するか、capture phase の `allowNextClick` フラグを考慮すること
- **CLICK_SUPPRESSION_MS の依存関係**: この値はクリック遅延 (300ms) を加味している。クリック遅延の値を変更した場合、この値も連動して更新が必要
- **capture phase の順序**: 複数の capture phase リスナー (クリック遅延、Edge Marker) が同一コンテナに登録される。`addEventListener` の登録順に実行されるため、登録順の変更に注意

## モード定義

### Perf Mode (`lite | normal | full`)

描画方式とデータ読み込み量をプロファイルとして一括制御するモード。変更時に render mode を含む他の設定をプロファイルのデフォルトにリセットする。

| Mode     | 説明                                                         |
| -------- | ------------------------------------------------------------ |
| `lite`   | 低スペック端末向け。Canvas描画、nearby半径500m、路線図非表示 |
| `normal` | 標準。zoom連動の自動切替、nearby半径1000m、路線図表示        |
| `full`   | 高スペック端末向け。DOM描画、nearby半径2000m、路線図表示     |

### Render Mode (`auto | standard | lightweight`)

描画方式の切替。perf mode 変更時にプロファイルのデフォルトにリセットされるが、ユーザーがいつでも独立して変更可能。

| Mode          | 説明                                                |
| ------------- | --------------------------------------------------- |
| `auto`        | zoom レベルに応じて standard/lightweight を自動切替 |
| `standard`    | DOM ベースの描画                                    |
| `lightweight` | Canvas ベースの描画                                 |

### Data Config

データ取得設定。perf mode のプロファイルから決定され、repository のクエリパラメータとして渡される。

- `stops.nearbyRadius`: `getStopsNearby` の検索半径 (メートル)
- `routes.enabled`: 路線図の表示有無

## TransitRepository API 仕様

全メソッドは `Result<T>` または `CollectionResult<T>` を返す。domain-level エラーは `{ success: false, error }` で表現し、呼び出し側がフォールバックを決定する。

- `getStopsInBounds(bounds, limit)`: bounds 中心からの距離順ソート。`limit` は必須。上限 `MAX_STOPS_RESULT` (5000)
- `getStopsNearby(center, radiusM, limit)`: 距離順ソート。`limit` は必須。上限 `MAX_STOPS_RESULT`
- `getUpcomingDepartures(stopId, now, limit?)`: route/headsign グループごとに最大 `limit` 件。未知の stopId は `success: false`
- `getRouteTypeForStop(stopId)`: 非同期。最小 route_type を返す。未知の stopId は `success: false`
- `getRouteShapes()`: 全 shape を返す
- `getFullDayDepartures(stopId, routeId, headsign, date)`: 指定日の全出発時刻 (分)
- `getAllStops()`: 全停留所 (上限 `MAX_STOPS_RESULT`)

## PWA

### 概要

`vite-plugin-pwa` (`generateSW` + `autoUpdate`) で PWA 対応。ホーム画面から起動時にブラウザ UI が消え (`display: standalone`)、アプリシェルのオフラインキャッシュを提供する。

### キャッシュ戦略

| 対象                                    | 方式                 | 設定                    | 想定サイズ                                   |
| --------------------------------------- | -------------------- | ----------------------- | -------------------------------------------- |
| App Shell (JS/CSS/HTML/アイコン等)      | プリキャッシュ       | ビルド時自動生成        | ~1 MB                                        |
| GTFS データ (`/data/**/*.json`)         | StaleWhileRevalidate | 7日有効、最大50エントリ | ~7 MB (2ソース時)                            |
| 地図タイル (`cyberjapandata.gsi.go.jp`) | CacheFirst           | 30日有効、最大50枚      | 実データ数 MB、Chrome Quota 上は最大 ~350 MB |

#### GTFS データキャッシュ

- `StaleWhileRevalidate`: キャッシュから即時返却しつつバックグラウンドで最新を取得
- データソース追加ごとに ~3-6 MB 増加 (timetable.json のサイズに依存)
- `public/data/` はプリキャッシュに含めない (`globIgnores: ['data/**']`)
- `globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']` でアイコン等もプリキャッシュ対象

#### 地図タイルキャッシュ

- GSI タイルは CORS ヘッダーを返さないため opaque response として保存される
- Chrome は opaque response 1件あたり ~7 MB のパディングを Storage Quota に加算する
- `maxEntries` の増加は Storage Quota への影響が大きいため慎重に設定すること

### JSON 圧縮配信 (今後の最適化)

現状 GTFS JSON は非圧縮で配信・キャッシュされている (~7 MB)。データソース増加に伴いキャッシュサイズが問題になった場合、以下の方式を検討する:

```text
pipeline で .json.gz を生成
  → 通常ファイルとして配信 (Content-Encoding ではなく application/gzip)
  → SW が圧縮状態のままキャッシュ (~1-2 MB)
  → アプリ側で DecompressionStream で解凍 → JSON.parse
```

**注意**: `Content-Encoding: gzip` によるサーバー側圧縮はネットワーク転送を最適化するが、Cache API には解凍後のサイズで保存される。キャッシュサイズの削減には `.gz` ファイルを通常リソースとして配信する必要がある。

### プラットフォーム別挙動

#### アプリ名 / アイコンラベル

| プラットフォーム | ソース                                     | 現在の値             |
| ---------------- | ------------------------------------------ | -------------------- |
| iOS              | `<meta name="apple-mobile-web-app-title">` | `アテナイ`           |
| Android          | manifest `short_name`                      | `アテナイ`           |
| macOS / Windows  | manifest `name`                            | `あてのない乗換案内` |

#### インストール要件

| プラットフォーム       | HTTPS 必須 | 備考                                 |
| ---------------------- | ---------- | ------------------------------------ |
| iOS Safari             | No         | `localhost` や LAN IP でも A2HS 可能 |
| Android Chrome         | Yes        | `localhost` は例外。LAN IP は不可    |
| macOS / Windows Chrome | Yes        | `localhost` は例外                   |

#### ステータスバー

| プラットフォーム | `theme-color` media query | 挙動                                                                         |
| ---------------- | ------------------------- | ---------------------------------------------------------------------------- |
| iOS Safari       | 対応                      | ライト/ダーク自動切替                                                        |
| Android Chrome   | 不安定                    | バージョンにより未対応。manifest `theme_color` (固定値) が優先される場合あり |
| macOS / Windows  | —                         | タイトルバーに `theme_color` が適用される                                    |

#### viewport zoom 制限

`index.html` で `maximum-scale=1.0, user-scalable=no` を設定している。Leaflet がピンチジェスチャーで地図ズームを直接制御するため、ブラウザレベルのピンチズームが有効だと二重ズームや操作の競合が発生する。地図アプリでは一般的な設定。

#### viewport-fit / status-bar-style 組み合わせ検証 (iOS standalone)

| パターン | viewport-fit | status-bar-style  | iOS top                   | iOS bottom        | Android |
| -------- | ------------ | ----------------- | ------------------------- | ----------------- | ------- |
| A        | cover        | black-translucent | 地図が上端まで描画 (best) | safe-area 問題    | ベスト  |
| B        | なし         | default           | テーマカラーべた塗り      | 目一杯描画 (best) | ベスト  |
| C        | cover        | default           | テーマカラーべた塗り      | 目一杯描画 (best) | ベスト  |
| D        | なし         | black-translucent | テーマカラーべた塗り      | 目一杯描画 (best) | ベスト  |

- Android は全組み合わせで同じ挙動 (apple-mobile-web-app-\* を無視するため)
- `black-translucent` が効くには `viewport-fit=cover` が必須
- `viewport-fit=cover` 単体では bottom に影響しない
- top 全画面描画と bottom 目一杯描画は現状両立不可 (iOS の制約)
- **現在の設定: パターン A** (top 全画面重視)
- フォールバック候補: B (bottom 重視、OS 任せ)
- `black-translucent` は iOS 14.5 (2021) で deprecated だが代替未提供。全画面表示の唯一の手段のため継続使用 ([参考](https://firt.dev/ios-14.5/))
- 参考: Google Maps (iOS/Android) は A 相当 (top 全画面、bottom は使い切らない)
- 参考: Apple Maps のみ全画面地図 + フル フロート UI を実現 (ネイティブ特権)

### iOS safe-area 対応

- `apple-mobile-web-app-status-bar-style` が `black-translucent` の場合、地図が画面上端まで広がる
- ノッチ / Dynamic Island と重なる UI 要素には `env(safe-area-inset-top)` で余白を追加
- standalone モード以外 (通常ブラウザ) では `env(safe-area-inset-top)` が 0 になるため影響なし
- `safe-area-inset-bottom` は不使用 (34px と大きく、BottomSheet 拡大やパネル重なりの原因になるため。ホームインジケータ領域はタップをブロックしないので不要)

**ControlPanel 経由のパネル** — `edge` + `offset` props で top の safe-area を自動適用:

- `MapLayerPanel` — top, 0.75rem
- `RenderingPanel` — top, 0.75rem
- `StopTypeFilterPanel` — top, 10.25rem
- `InfoPanel` — top, 13rem
- `MapNavigationPanel` — bottom, 2rem (safe-area なし)
- `StopControlPanel` — bottom, 2rem (safe-area なし)

**個別対応コンポーネント** — inline の `calc()` で safe-area を適用:

- `TimeControls` — `top-[calc(1.25rem+env(safe-area-inset-top))]`
- `StopHistory` — `top-[calc(4rem+env(safe-area-inset-top))]`
- `SelectionIndicator` — `top-[calc(4rem+env(safe-area-inset-top))]` (2箇所)

## Styling

### Tailwind CSS v4

- `@tailwindcss/vite` プラグインで Tailwind v4 を使用 (tailwind.config.js 不要)
- ダークモード: `@custom-variant dark (&:where(.dark, .dark *))` でクラスベース制御
- Leaflet DivIcon のスタイルは `src/index.css` の `@layer components` でグローバルクラスとして定義 (HTML 文字列で注入するため JSX 不可)

### Prettier

- `prettier-plugin-tailwindcss` で Tailwind クラスの自動並び替え
- `eslint-config-prettier` で ESLint との競合を回避
- 設定は `prettier.config.mjs` (printWidth: 100, シングルクォート, セミコロンあり)

### ESLint

- `typescript-eslint` の `recommendedTypeChecked` ルールセットを使用 (型情報を利用した高精度チェック)
- `projectService` で `tsconfig.app.json` と `tsconfig.node.json` の両方を参照

### shadcn/ui

- shadcn/ui をベースコンポーネントライブラリとして使用
- コンポーネントは `src/components/ui/` に配置 (shadcn CLI が管理)
- `cn()` ユーティリティは `src/lib/utils.ts`
- `@/` パスエイリアスを使用 (shadcn の規約)
- 地図オーバーレイ用ボタン (MapOverlayButton, MapToggleButton) は shadcn Button を使わない (配置・スタイルが特殊)
- shadcn Dialog の z-index はデフォルト `z-50` から `z-2000` に変更済み (上記 z-index 階層を参照)

## 日時指定 (`?time=`)

`?time=` パラメータで初期日時を指定できる。デモ URL の共有や特定時刻の動作確認に使用。

```text
http://localhost:5173/?time=2026-03-25T20:55
http://localhost:5173/?time=2026-03-25T20:55:00+09:00
http://localhost:5173/?time=2026-03-25T20:55:00Z
http://localhost:5173/?lat=35.68&lng=139.39&zm=16&time=2026-03-25T20:55
```

- RFC 3339 形式。秒、タイムゾーンは省略可 (省略時はローカル時間)
- 指定するとカスタム時間モードになる (ヘッダーにピンアイコン表示)

## Repository 切り替え (`?repo=` mode)

`?repo=` パラメータで使用する Repository 実装を切り替えられる。本番ビルドでも使用可能。

```text
http://localhost:5173/              → v2 (default)
http://localhost:5173/?repo=mock    → MockRepository (fictional in-memory data)
```

### MockRepository (`?repo=mock`)

`MockRepository` (`src/repositories/mock-repository.ts`) は、仕様上は正しいが実データには存在しないデータ構造をテストするためのインメモリ実装。通常の開発では実データを使用し、特殊なデータが必要な場合のみ使う。

### テスト用データの特徴

- 熊野前駅周辺 (~2 km 圏内) に架空の12停留所を配置
- 全ての停留所名/路線名は架空 (「あおば中央駅」「みどり丘駅」など)
- 複数の `RouteType` を持つ停留所が含まれる:

| Stop ID         | 停留所名         | Route Types                            | 用途              |
| --------------- | ---------------- | -------------------------------------- | ----------------- |
| `sta_central`   | あおば中央駅     | tram(0) + subway(1) + rail(2) + bus(3) | 4種全て           |
| `sta_central_s` | あおば中央駅南口 | subway(1) + rail(2) + bus(3)           | 3種複合           |
| `sta_hill`      | みどり丘駅       | rail(2) + bus(3)                       | 鉄道+バス複合     |
| `sta_east`      | ひかり台駅       | rail(2) + tram(0)                      | 鉄道+路面電車複合 |
| `sta_south`     | かぜの駅         | subway(1) + rail(2)                    | 地下鉄+鉄道複合   |

実データに存在する4種類の RouteType (0: tram, 1: subway, 2: rail, 3: bus) を全てカバーしている。

### テストデータの追加

特殊なデータパターンが必要な場合は、`mock-repository.ts` の `STOPS`, `ROUTES`, `STOP_ROUTES` を編集する。`STOP_ROUTE_TYPES` は `STOP_ROUTES` と `ROUTES` から自動計算される。

## Diagnostics (`?diag=` mode)

`?diag=<name>` パラメータで診断ツールを実行できる。Repository 生成後、React 描画前に実行され、結果はブラウザコンソールに出力される。diagnostics モジュールは dynamic import のため、通常アクセス時にはロードされない。

### 起動方法 Diagnostics mode

```text
http://localhost:5173/?diag=v2-load
```

### 利用可能な diagnostics

| name         | 内容                                                           |
| ------------ | -------------------------------------------------------------- |
| `v2-load`    | v2 バンドル (data/shapes/insights/global) のロードベンチマーク |
| `repo-bench` | Repository API のクエリ性能ベンチマーク (12地点)               |

対象ソースは `DataSourceManager` の有効ソース (`?sources=` や localStorage で絞り込み可能)。

### `v2-load` の出力

- Phase 1: 有効ソースの `data.json` を並列ロード (件数、所要時間)
- Phase 2: 成功ソースの `shapes.json` + `insights.json` を並列ロード
- Phase 3: `global/insights.json` をロード
- サマリー: `Total: Xms (data=Xms, shapes+insights=Xms, global=Xms)`

`FetchDataSourceV2` の debug ログでソースごとの network/parse 内訳も確認可能。

### `repo-bench` の出力

`?repo=` で選択した Repository の API を 12 の HOME_LOCATIONS で呼び出し、所要時間を計測。

```text
?diag=repo-bench           → repo のベンチマーク
```

計測対象: getAllStops, getRouteShapes, getAllSourceMeta, getStopsInBounds, getStopsNearby, getUpcomingTimetableEntries, getRouteTypesForStop, getFullDayTimetableEntries

### diagnostics の追加

`src/diagnostics/index.ts` の `switch` に `case` を追加する。`main.tsx` の変更は不要。

## セットアップ

### Setup Agent skills

外部 skill は手動でインストールが必要。clone 後に以下を実行:

#### Setup shadcn/ui

- [Skills - shadcn/ui](https://ui.shadcn.com/docs/skills)
