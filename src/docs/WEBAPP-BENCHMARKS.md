# WebApp Benchmarks

Repository API benchmark results measured via `?diag=repo-bench`.

Benchmarks run across 12 fixed locations (`BENCH_LOCATIONS` in `src/diagnostics/repo-benchmark.ts`).

## Purpose

**計測と記録が主目的**。変更前後のスナップショットを残し、後から比較・参照できる状態を保つ。計測結果として遅い処理や肥大化が見えれば最適化する判断もありうるが、それは結果論であって、「遅い処理を探す」ことが目的ではない。

主な計測タイミング:

- **リファクタリングの前後**: 既存実装の構造を変える PR で Before/After を比較する(過去例: `stopsMetaMap` 導入)。
- **新機能追加の前後**: 新しい初期化処理・hook・hot path を追加する PR で、追加分のコストを可視化する(過去例: `enrichStopInsights` 導入、service group 切替)。
- **データセット拡張の前後**: ソース追加やデータ詳細化により bundle / 初期化 / 描画 にかかる時間・容量がどう変わったかを記録する。

### 注意点

- 計測下限以下のメソッドは ms 値で議論せず、成功カウント等で sanity check するに留める。
- 環境メタデータが揃っていないため、別マシン / 別ブラウザ間の絶対値比較は行わない(同一環境内の Before/After 比較が前提)。

## Environment

| Item    | Value                                                      |
| ------- | ---------------------------------------------------------- |
| Machine | Apple M4 Mac                                               |
| Browser | Chrome                                                     |
| Data    | 17 sources, 15,805 stops, 1,333 routes, 3,139 tripPatterns |

## Benchmark Conditions

| Parameter      | Value                      | Notes                                                  |
| -------------- | -------------------------- | ------------------------------------------------------ |
| limit / radius | 1,000 / 1,000m             | Hardcoded in benchmark (equivalent to normal perfMode) |
| bounds         | lat +/-0.005, lng +/-0.006 | ~1km viewport                                          |

## Measurement Protocol

1. 開発中は単発実行で結果の傾向を確認する。
2. 結果が安定したら、5回以上計測してレポートに記載する。
3. 各回は前回のベンチマークが完全に完了してからページをリロードして開始する。
4. Run 1 は JIT warmup の影響で外れ値になりやすい。外れ値は `*` で注記する。
5. 代表値は median を採用する。
6. レポートには以下を含める:
    - **ソースダウンロード概況** (deterministic): 各ソースの `data.json` / `insights.json` / `shapes.json` ファイルサイズ、総ダウンロードサイズ、各カテゴリ最大ソース。`FetchDataSourceV2` のログから取得するが、network 時間は環境依存のため記録対象外。データセット拡張(ソース追加・データ詳細化)が bundle 全体へ与える影響を可視化する用途。
    - **全メトリクス記録** (raw data): 初期化 (fetch, merge, enrich, shapes) と repo API (全メソッド) を分離した2テーブル。次回比較のベースライン。
    - **前回との比較**: 前回計測の median との差分テーブル。
    - **考察 (Observations)**: 変化の原因分析、トレードオフの評価。

## 2026-03-27: Baseline

Initialization (from `mergeSources` debug log, not included in benchmark):

| Metric       | Result  |
| ------------ | ------- |
| mergeSources | 38-51ms |

Benchmark results:

| Method                                           | Result                         |
| ------------------------------------------------ | ------------------------------ |
| getAllStops                                      | 0.10ms (15,805 stops)          |
| getRouteShapes                                   | 0.10ms (1,623 shapes)          |
| getAllSourceMeta                                 | 0.00ms (17 sources)            |
| getStopsInBounds (12 locations total)            | 4.40-4.90ms                    |
| getStopsNearby (12 locations total)              | 4.50-4.80ms, 653 stops         |
| getUpcomingTimetableEntries limit=3 (653 stops)  | 51-56ms, 0.08ms/stop           |
| getUpcomingTimetableEntries no-limit (653 stops) | 44-50ms, 0.07ms/stop           |
| getRouteTypesForStop (653 stops)                 | 1.3-1.4ms                      |
| getFullDayTimetableEntries (24 stops)            | 2.5-2.6ms, 2,340 departures    |
| getStopsForRoutes (12 calls)                     | 2.50ms, 0.21ms/call, 838 stops |
| **Benchmark total**                              | **~115ms**                     |

## 2026-03-27: stopsMetaMap introduction

### stopsMetaMap: Change

Replace per-query `StopWithMeta` assembly (`stopAgenciesMap.get()` + `stopRoutesMap.get()`)
with pre-built `Map<string, StopWithMeta>` (`stopsMetaMap`) in `mergeSourcesV2()`.

### stopsMetaMap: Results (5 runs each, median)

Initialization (from `mergeSources` debug log, not included in benchmark):

| Metric       | Before (median) | After (median) | Improvement |
| ------------ | --------------- | -------------- | ----------- |
| mergeSources | 44ms            | 40ms           | (noise)     |

Benchmark:

| Metric           | Before (median) | After (median) | Improvement |
| ---------------- | --------------- | -------------- | ----------- |
| getStopsInBounds | 3.80ms          | 3.10ms         | 18%         |
| getStopsNearby   | 5.20ms          | 3.60ms         | 31%         |

#### Raw data: Before (5 runs)

| Run | merge | InBounds | Nearby |
| --- | ----- | -------- | ------ |
| 1   | 51ms  | 9.00ms\* | 5.30ms |
| 2   | 46ms  | 5.30ms   | 5.20ms |
| 3   | 44ms  | 3.50ms   | 4.50ms |
| 4   | 41ms  | 3.80ms   | 6.60ms |
| 5   | 38ms  | 2.90ms   | 4.00ms |

\*Run 1 InBounds=9.00ms is an outlier (JIT warmup).

#### Raw data: After (5 runs)

| Run | merge | InBounds | Nearby |
| --- | ----- | -------- | ------ |
| 1   | 40ms  | 3.00ms   | 3.60ms |
| 2   | 37ms  | 3.10ms   | 3.60ms |
| 3   | 39ms  | 2.80ms   | 3.50ms |
| 4   | 48ms  | 3.20ms   | 3.60ms |
| 5   | 43ms  | 3.20ms   | 3.30ms |

### stopsMetaMap: Observations

#### stopsMetaMap: Initialization (mergeSources)

- `mergeSources` median shows before=44ms, after=40ms, but the ranges overlap
  (before 38-51ms, after 37-48ms). The `stopsMetaMap` construction adds ~15,805
  `Map.set()` calls which costs ~1-2ms — too small to distinguish from
  measurement noise at this scale. The apparent "improvement" is not real;
  the difference is within normal browser execution variance.
- Memory overhead is minimal (shared `Stop`, `Agency[]`, `Route[]` references).

#### stopsMetaMap: Benchmark (repo API queries)

- `getStopsNearby` shows consistent ~31% improvement (median 5.20ms → 3.60ms).
- `getStopsInBounds` shows ~18% improvement (median 3.80ms → 3.10ms).
  The improvement comes from eliminating per-stop `stopAgenciesMap.get()` +
  `stopRoutesMap.get()` + object literal construction. With `stopsMetaMap`,
  `StopWithMeta` is already assembled and a single `Map.get()` suffices.
- Before data has higher variance (2.90-9.00ms for InBounds) compared to After
  (2.80-3.20ms), suggesting the pre-built map also reduces variance by
  eliminating per-query object creation.

#### General

- Benchmarks run in a browser tab alongside UI rendering. Service Worker
  caching may affect fetch times between runs, but `mergeSources` is pure
  CPU work and should not be affected.

## 2026-03-30: enrichStopInsights introduction

### enrichStopInsights: Change

Add `enrichStopInsights()` to `create()`: loads per-source stopStats and
global stopGeo during initialization, mapping them onto `stopsMetaMap`.
Move `geo` from `StopWithContext` to `StopWithMeta`. Pass `stats` and
`geo` through `useNearbyDepartures` to `StopWithContext`.

### enrichStopInsights: Results (5 runs, median)

Initialization:

| Metric       | Result |
| ------------ | ------ |
| mergeSources | 38ms   |
| enrich       | 58ms   |
| shapes       | 48ms   |

Benchmark results:

| Method                                           | Result                                   |
| ------------------------------------------------ | ---------------------------------------- |
| getAllStops                                      | 0.10ms (15,805 stops)                    |
| getRouteShapes                                   | 0.00ms (1,623 shapes)                    |
| getAllSourceMeta                                 | 0.10ms (17 sources)                      |
| getStopsInBounds (12 locations total)            | 4.70-5.60ms                              |
| getStopsNearby (12 locations total)              | 4.40-5.00ms, 653 stops                   |
| getUpcomingTimetableEntries limit=3 (653 stops)  | 42.70-50.50ms, 0.07ms/stop               |
| getUpcomingTimetableEntries no-limit (653 stops) | 38.00-42.90ms, 0.06ms/stop               |
| getRouteTypesForStop (653 stops)                 | 1.00-1.60ms                              |
| getFullDayTimetableEntries (24 stops)            | 2.20-2.50ms, 2,247 departures            |
| getStopsForRoutes (12 calls)                     | 5.20-5.70ms, 0.43-0.48ms/call, 838 stops |
| **Benchmark total**                              | **103.70-109.00ms**                      |

Comparison with previous (2026-03-27 stopsMetaMap After median):

| Metric           | Before (median) | After (median) | Change      |
| ---------------- | --------------- | -------------- | ----------- |
| mergeSources     | 40ms            | 38ms           | (noise)     |
| enrich           | —               | 58ms           | +58ms (new) |
| getStopsInBounds | 3.10ms          | 5.10ms         | +2.0ms      |
| getStopsNearby   | 3.60ms          | 4.60ms         | +1.0ms      |
| Benchmark total  | ~115ms          | 105.30ms       | (noise)     |

#### Raw data: Initialization (5 runs)

| Run | fetch | merge | enrich | Initialized | shapes (lazy) |
| --- | ----- | ----- | ------ | ----------- | ------------- |
| 1   | 387ms | 36ms  | 61ms   | 498ms       | 47ms          |
| 2   | 387ms | 42ms  | 54ms   | 429ms       | 48ms          |
| 3   | 394ms | 38ms  | 55ms   | 432ms       | 53ms          |
| 4   | 409ms | 38ms  | 58ms   | 446ms       | 48ms          |
| 5   | 493ms | 40ms  | 59ms   | 533ms       | 47ms          |

#### Raw data: Repo API benchmark (5 runs)

| Run | InBounds | Nearby | Upcoming lim=3 | Upcoming nolim | RouteTypes | FullDay | StopsForRoutes | Bench total |
| --- | -------- | ------ | -------------- | -------------- | ---------- | ------- | -------------- | ----------- |
| 1   | 5.60ms   | 5.00ms | 50.50ms        | 38.60ms        | 1.30ms     | 2.50ms  | 5.70ms         | 104.50ms    |
| 2   | 4.10ms   | 4.40ms | 47.10ms        | 42.90ms        | 1.60ms     | 2.40ms  | 5.70ms         | 109.00ms    |
| 3   | 6.80ms\* | 4.60ms | 42.70ms        | 40.60ms        | 1.00ms     | 2.30ms  | 5.30ms         | 104.50ms    |
| 4   | 4.70ms   | 4.60ms | 46.00ms        | 39.80ms        | 1.10ms     | 2.50ms  | 5.20ms         | 105.30ms    |
| 5   | 5.10ms   | 4.90ms | 45.40ms        | 38.00ms        | 1.20ms     | 2.20ms  | 5.50ms         | 103.70ms    |

\*Run 3 InBounds=6.80ms is an outlier.

### enrichStopInsights: Observations

#### enrichStopInsights: Initialization

- `enrichStopInsights` adds ~58ms (median) to initialization. This includes:
    - Fetching 17 per-source insights.json in parallel (~30ms network)
    - Fetching global/insights.json (~35ms network, 1267KB)
    - Mapping stopStats (15,338 stops) and stopGeo (15,805 stops) onto stopsMetaMap
- The fetch is parallelized with global insights, so wall-clock time is
  dominated by the largest file (global/insights.json at 1.3MB).
- `mergeSources` is unaffected (38ms vs 40ms, within noise).

#### enrichStopInsights: Benchmark (repo API queries)

- `getStopsInBounds` median increased from 3.10ms to 5.10ms (+2.0ms).
  `getStopsNearby` median increased from 3.60ms to 4.60ms (+1.0ms).
  These increases may be due to larger `StopWithMeta` objects (now
  including `stats` and `geo` fields), increasing memory pressure and
  cache misses during iteration. However, the variance is high
  (InBounds: 4.10-6.80ms) and the before data (2.80-3.20ms) was
  measured in a different session, so the difference may partly be
  environmental noise.
- Benchmark total is actually lower (105ms vs 115ms), suggesting the
  per-query increases are within measurement noise at this scale.

#### Trade-off

- +58ms initialization cost is acceptable: it runs once at startup and
  is parallelized with network fetch. Users see stop metrics immediately
  when the bottom sheet renders, without a second loading phase.

## 2026-03-31: Date-aware service group selection (Issue #87)

### Change

Replace fixed `serviceGroups.data[0]` selection with date-aware resolution.
Store all service groups' stats/freq in `stopInsightsMap`/`routeFreqMap`
and resolve at read time via `resolveStopStats`/`resolveRouteFreq`.

- `enrichStopInsights`: iterate all groups instead of `data[0]` only
  (15,770 → 44,668 entries stored in `stopInsightsMap`)
- `loadAllShapesWithInsights`: iterate all groups for `routeFreqMap`
- `RouteShape.freq` still uses first group as default (no change)
- `resolveStopStats`/`resolveRouteFreq` added (O(1) map lookup + service group matching)

### Results (5 runs, median)

Initialization:

| Metric       | Result |
| ------------ | ------ |
| mergeSources | 42ms   |
| enrich       | 65ms   |
| shapes       | 48ms   |

Benchmark results:

| Method                                           | Result                                   |
| ------------------------------------------------ | ---------------------------------------- |
| getAllStops                                      | 0.10ms (15,805 stops)                    |
| getRouteShapes                                   | 0.00ms (1,623 shapes)                    |
| getAllSourceMeta                                 | 0.00ms (17 sources)                      |
| getStopsInBounds (12 locations total)            | 2.90-4.50ms                              |
| getStopsNearby (12 locations total)              | 3.30-4.40ms, 653 stops                   |
| getUpcomingTimetableEntries limit=3 (653 stops)  | 36.60-41.90ms, 0.06ms/stop               |
| getUpcomingTimetableEntries no-limit (653 stops) | 30.50-35.60ms, 0.05ms/stop               |
| getRouteTypesForStop (653 stops)                 | 0.90-1.40ms                              |
| getFullDayTimetableEntries (24 stops)            | 2.40-4.00ms, 2,225 departures            |
| getStopsForRoutes (12 calls)                     | 5.20-5.70ms, 0.43-0.48ms/call, 838 stops |
| resolveStopStats (653 stops)                     | 0.60-1.00ms, 0.00ms/stop, 547 resolved   |
| resolveRouteFreq (151 routes)                    | 0.20-0.70ms                              |
| **Benchmark total**                              | **84.30-90.00ms**                        |

Comparison with previous (2026-03-30 enrichStopInsights After median):

| Metric           | Before (median) | After (median) | Change       |
| ---------------- | --------------- | -------------- | ------------ |
| mergeSources     | 38ms            | 42ms           | +4ms (noise) |
| enrich           | 58ms            | 65ms           | +7ms         |
| shapes           | 48ms            | 48ms           | (unchanged)  |
| getStopsInBounds | 5.10ms          | 3.80ms         | (noise)      |
| getStopsNearby   | 4.60ms          | 4.10ms         | (noise)      |
| Benchmark total  | 105.30ms        | 91.90ms        | (noise)      |

#### Raw data: Initialization (5 runs, service group selection)

| Run | fetch | merge | enrich | shapes |
| --- | ----- | ----- | ------ | ------ |
| 1   | 394ms | 36ms  | 65ms   | 48ms   |
| 2   | 417ms | 42ms  | 63ms   | 81ms   |
| 3   | 421ms | 50ms  | 62ms   | 48ms   |
| 4   | 475ms | 36ms  | 66ms   | 47ms   |
| 5   | 381ms | 46ms  | 70ms   | 52ms   |

#### Raw data: Repo API benchmark (5 runs, service group selection)

| Run | InBounds | Nearby | Upcoming lim=3 | Upcoming nolim | RouteTypes | FullDay | StopsForRoutes | StopStats | RouteFreq | Bench total |
| --- | -------- | ------ | -------------- | -------------- | ---------- | ------- | -------------- | --------- | --------- | ----------- |
| 1   | 5.00ms   | 4.50ms | 38.20ms        | 30.30ms        | 1.10ms     | 2.80ms  | 5.20ms         | 0.60ms    | 0.70ms    | 89.30ms     |
| 2   | 4.50ms   | 4.90ms | 36.50ms        | 31.50ms        | 1.00ms     | 2.50ms  | 5.50ms         | 0.60ms    | 0.20ms    | 89.00ms     |
| 3   | 3.10ms   | 3.80ms | 37.50ms        | 30.60ms        | 1.00ms     | 2.40ms  | 4.90ms         | 1.00ms    | 0.50ms    | 86.40ms     |
| 4   | 3.90ms   | 3.70ms | 37.40ms        | 28.70ms        | 1.20ms     | 2.30ms  | 4.90ms         | 0.80ms    | 0.20ms    | 84.30ms     |
| 5   | 3.80ms   | 3.80ms | 40.00ms        | 30.40ms        | 1.30ms     | 2.30ms  | 5.90ms         | 0.80ms    | 0.20ms    | 90.00ms     |

### Service group selection: Observations

#### Service group selection: Initialization

- `enrich` increased from 58ms to 65ms (+7ms). The function now iterates
  all service groups (44,668 entries vs 15,770) to populate `stopInsightsMap`,
  but the increase is modest because network fetch (~30ms) dominates
  the total enrich time.
- `shapes` is unchanged at 48ms. `loadAllShapesWithInsights` now populates
  `routeFreqMap` with all groups' freq, but the additional Map operations
  are negligible compared to network fetch.
- `mergeSources` is unaffected (42ms vs 38ms, within noise).

#### Service group selection: Benchmark (repo API queries)

- No regression in any existing API method.
- `resolveStopStats` (653 stops): 0.80ms median (0.00ms/stop). 547/653
  stops resolved (stops without insights data return undefined).
- `resolveRouteFreq` (151 unique routes): 0.20ms median. Sub-millisecond.
- Both methods are dominated by `getActiveServiceIds` cache lookup and
  `selectServiceGroup` overlap counting (~30 iterations per call).
- Benchmark total is comparable to previous (89.00ms vs 105.30ms, noise).

#### Service group selection: Trade-off

- +7ms enrich cost is acceptable: stored data grows ~2.8x (all service
  groups instead of one), but the processing cost increase is minimal
  because network fetch remains the bottleneck.
- `resolveStopStats`/`resolveRouteFreq` are O(1) map lookups + O(30)
  service group matching. Measured at 0.80ms/653 stops and 0.20ms/151 routes.
  Called ~50 times per NearbyDepartures update, total cost is sub-millisecond.
- shapes re-render on dateTime change is avoided by stabilizing
  `resolveRouteFreq` identity on `serviceDayKey` (changes only at 03:00).

## 2026-05-08: Extend repo-bench (4 missing methods + dataset summary)

### Extend repo-bench: Change

- Added 4 previously-uncovered TransitRepository methods to `runRepoBenchmark`:
    - `getStopMetaById` — 5 calls per location (Map.get sanity check)
    - `getStopMetaByIds` — 1 batch per location (full nearby IDs per batch)
    - `getTripInspectionTargets` — every nearby stop (real work)
    - `getTripSnapshot` — first 3 targets per `getTripInspectionTargets` success (real work)
- Added a `Dataset:` summary log emitting `sources / stops / routes / tripPatterns` after `getAllSourceMeta` so future reports can populate the Environment table without manually summing per-source repo init logs.
- Extended `SourceMeta.stats` with `tripPatternCount` (no production caller — `getAllSourceMeta` is benchmark-only).
- Dataset has grown since 2026-03-31: **+7 GTFS sources** (17 → 24), broken down by addition date:
    - 2026-04-08: `vagfr` (VAG Freiburg), `actvnav` (ACTV Navigazione)
    - 2026-04-23: `tmm` (Tama Monorail), `twrr` (TWR Rinkai Line)
    - 2026-05-07: `tcship` (Tokyo Cruise Ship)
    - 2026-05-08: `tome` (Tokyo Metro), `ntbus` (Nishi Tokyo Bus)

  Existing-feed updates (e.g. seasonal GTFS revisions) account for the rest of the stop / route / pattern delta.

### Extend repo-bench: Source download summary (deterministic)

| File type     |               Count | Total size | Largest source                                   |
| ------------- | ------------------: | ---------: | ------------------------------------------------ |
| data.json     |                  24 |     75.6MB | minkuru (17.5MB), kcbus (11.4MB), sbbus (10.8MB) |
| insights.json |       24 + 1 global |      6.0MB | global (1.6MB), sbbus (902KB), minkuru (869KB)   |
| shapes.json   | 17 (7 sources skip) |      8.9MB | vagfr (4.4MB), kcbus (1.6MB), actvnav (1.2MB)    |
| **Total**     |            65 files | **90.5MB** | —                                                |

network 時間は環境依存のため記録対象外。再現性のあるサイズのみ。

### Extend repo-bench: Results (5 runs, median)

Initialization:

| Metric |                                   Result |
| ------ | ---------------------------------------: |
| fetch  | 683ms (range 578-692, network-dependent) |
| merge  |                                     67ms |
| enrich |                                     88ms |
| shapes |                                    100ms |

Benchmark results:

| Method                                           | Result                                                      |
| ------------------------------------------------ | ----------------------------------------------------------- |
| getAllStops                                      | 0.10ms (18,648 stops)                                       |
| getRouteShapes                                   | 0.10ms (2,819 shapes)                                       |
| getAllSourceMeta                                 | 0.00ms (24 sources)                                         |
| Dataset                                          | 24 sources, 18,648 stops, 1,551 routes, 4,593 trip patterns |
| getStopsInBounds (12 locations)                  | 4.80ms (range 4.70-5.50)                                    |
| getStopsNearby (12 locations)                    | 5.80ms (range 5.40-6.90), 687 stops                         |
| getUpcomingTimetableEntries limit=3 (687 stops)  | 20.90ms, 0.03ms/stop, 1,855 entries                         |
| getUpcomingTimetableEntries no-limit (687 stops) | 13.70ms, 0.02ms/stop, 45,805-46,120 entries                 |
| getRouteTypesForStop (687 stops)                 | 1.10ms                                                      |
| getFullDayTimetableEntries (24 stops)            | 2.50ms, 4,187 stop times                                    |
| getStopsForRoutes (12 calls)                     | 6.70ms, 0.55-0.63ms/call, 727 stops                         |
| resolveStopStats (687 stops)                     | 0.60ms, 0.00ms/stop, 652 resolved                           |
| resolveRouteFreq (220 routes, 203 resolved)      | 0.20ms                                                      |
| **getStopMetaById (60 calls)**                   | **0.30ms, 0.00ms/call, 60 resolved** (new)                  |
| **getStopMetaByIds (12 batches, 687 ids)**       | **0.10ms, 0.01ms/batch, 687 resolved** (new)                |
| **getTripInspectionTargets (687 calls)**         | **15.40ms, 0.02ms/call, 83,370 targets** (new)              |
| **getTripSnapshot (1,914 calls)**                | **13.50ms, 0.01ms/call, 1,914 snapshots** (new)             |
| **Benchmark total**                              | **88.30ms (range 84.80-97.00)**                             |

### Comparison with previous (2026-03-31 service group selection median)

Initialization:

| Metric | Before (median) | After (median) | Change        |
| ------ | --------------: | -------------: | ------------- |
| merge  |            42ms |           67ms | +25ms (+60%)  |
| enrich |            65ms |           88ms | +23ms (+35%)  |
| shapes |            48ms |          100ms | +52ms (+108%) |

Benchmark (existing methods):

| Metric                              | Before (median) | After (median) | Change                              |
| ----------------------------------- | --------------: | -------------: | ----------------------------------- |
| getAllStops                         |            0.10 |           0.10 | (floor)                             |
| getRouteShapes                      |            0.00 |           0.10 | (floor)                             |
| getAllSourceMeta                    |            0.00 |           0.00 | (floor)                             |
| getStopsInBounds                    |            3.80 |           4.80 | +1.0ms (+26%)                       |
| getStopsNearby                      |            4.10 |           5.80 | +1.7ms (+41%)                       |
| Upcoming lim=3                      |            38ms |          20.90 | **-17ms (-45%)**                    |
| Upcoming no-lim                     |            31ms |          13.70 | **-17ms (-56%)**                    |
| getRouteTypesForStop                |            1.20 |           1.10 | -0.1ms (within range)               |
| getFullDay                          |            2.50 |           2.50 | 0%                                  |
| getStopsForRoutes                   |            5.50 |           6.70 | +1.2ms (+22%)                       |
| resolveStopStats                    |            0.80 |           0.60 | -0.2ms (within range)               |
| resolveRouteFreq                    |            0.30 |           0.20 | -0.1ms (within range)               |
| Benchmark total (existing only)     |             ~89 |            ~58 | -31ms (existing methods got faster) |
| Benchmark total (incl. new methods) |               — |          88.30 | new methods add ~29ms               |

Dataset growth since 2026-03-31:

| Item                       | Before |  After | Change |
| -------------------------- | -----: | -----: | ------ |
| sources                    |     17 |     24 | +41%   |
| stops                      | 15,805 | 18,648 | +18%   |
| routes                     |  1,333 |  1,551 | +16%   |
| trip patterns              |  3,139 |  4,593 | +46%   |
| shapes                     |  1,623 |  2,819 | +74%   |
| nearby stops (12 locs sum) |    653 |    687 | +5%    |

#### Raw data: Initialization (5 runs, extend repo-bench)

| Run | fetch | merge | enrich |   shapes |
| --- | ----: | ----: | -----: | -------: |
| 1\* | 617ms |  64ms |   76ms |    100ms |
| 2   | 578ms |  67ms |   88ms | (missed) |
| 3   | 690ms |  68ms |  108ms |     93ms |
| 4   | 692ms |  72ms |  160ms |    105ms |
| 5   | 683ms |  62ms |   87ms |    100ms |

\*Run 1 partly affected by JIT warmup, but `merge` / `enrich` are CPU-bound and reproducible.

#### Raw data: Repo API benchmark (5 runs, extend repo-bench)

| Run | InBounds | Nearby |  Up=3 | Up nolim | RouteTypes | FullDay | ForRoutes | StopStats | RouteFreq | MetaById | MetaByIds | TripInsp | TripSnap | Total |
| --- | -------: | -----: | ----: | -------: | ---------: | ------: | --------: | --------: | --------: | -------: | --------: | -------: | -------: | ----: |
| 1   |     4.80 |   5.60 | 19.00 |    14.00 |       1.10 |    2.40 |      6.70 |      0.40 |      0.20 |     0.10 |      0.40 |    12.70 |    14.50 | 84.80 |
| 2   |     4.70 |   6.20 | 20.90 |    13.70 |       0.90 |    2.50 |      6.60 |      0.80 |      0.40 |     0.30 |      0.10 |    15.30 |    12.00 | 87.20 |
| 3   |     4.80 |   5.80 | 20.40 |    13.70 |       1.40 |    2.70 |      6.60 |      0.40 |      0.10 |     0.60 |      0.10 |    15.80 |    13.40 | 88.40 |
| 4   |     4.90 |   6.90 | 21.40 |    16.60 |       1.60 |    3.00 |      7.60 |      0.60 |      0.20 |     0.10 |      0.30 |    15.40 |    15.60 | 97.00 |
| 5   |     5.50 |   5.40 | 21.40 |    13.30 |       0.90 |    2.50 |      6.80 |      0.60 |      0.30 |     0.30 |      0.10 |    15.40 |    13.50 | 88.30 |

Run 4 has higher enrich (160ms) and slightly elevated benchmark times across the board (likely a GC pause or transient system load); not excluded from median because the elevation is consistent across multiple methods, not a single-method outlier.

### Extend repo-bench: Observations

#### Extend repo-bench: Initialization

- `merge` +60% (42→67ms) and `enrich` +35% (65→88ms) are consistent with sources +41% / stops +18%. Per-source assembly cost in `mergeSourcesV2` and per-source insights map building scale roughly with source count, not stop count.
- `shapes` +108% (48→100ms) is the largest jump and the only super-linear scaling — shape polyline count +74% (1,623 → 2,819) but runtime more than doubled.
- Per-source polyline counts for the current dataset (verified): minkuru 748, vagfr 617, kcbus 386, **tome 373** (4th), toaran 318, actvnav 173, others ≤40.
- `tome` ships 373 polylines / 3,007 points (8.1 points/polyline avg). This is consistent with other MLIT-mapped rail sources where each KSJ railway feature becomes its own `RouteShape` — `mir` 40 polylines / 1 route, `tmm` 37 / 1, `twrr` 15 / 1, all giving ~15-40 polylines per route. Tome's 9 routes therefore contribute 373 polylines, which is comparable on a per-route basis but large in absolute terms.
- The dominant cost in `loadAllShapesWithInsights` scales with **polyline count**, not point count: per-polyline `RouteShape` construction + Map registration runs once per polyline regardless of how many points each polyline holds. JSON parse cost (which would scale with points) is paid in the earlier fetch stage.
- **Watch list**: `shapes` 100ms is the closest section to a future bottleneck. The next MLIT-mapped train source (multiple routes × ~40 polylines/route) would amplify this fastest. If/when this section approaches user-perceptible (~300ms+), candidates for investigation:
    - Subdivide the stage in benchmark to isolate per-polyline construction vs pattern enrichment.
    - Consider whether MLIT polylines for the same route can be merged into a single `RouteShape` per route (would change the data model, not just the build code).
- `fetch` median 683ms is network-dependent and not directly comparable to historical 387-475ms ranges. Total payload is now 90.5MB (vs ~50MB previously estimated), so the absolute increase makes sense regardless of network state.

#### Extend repo-bench: Benchmark methods

- **`getStopsNearby` +41% / `getStopsInBounds` +26%** — both scale with stops (+18%), but the runtime grew faster than data. These methods iterate the full stops set per query (no spatial index), so behavior is super-linear when combined with cache effects from a larger working set.
- **`getUpcomingTimetableEntries` -45 to -56%** — significant improvement despite +18% stops. Likely cumulative effect of refactors landing between 2026-03-31 and 2026-05-08:
    - `useTimetable` hook extraction (PR #176)
    - service group selection refinements
    - DepartureGroup → TimetableEntry migration completion (in-memory structure simplified)

    This is the single largest user-facing improvement in the timetable hot path.

- **`getStopsForRoutes` +22%** scales with route count +16% (full route enumeration cost).
- **Floor-near methods** (`getAllStops` / `getRouteShapes` / `getAllSourceMeta` / `resolveStopStats` / `resolveRouteFreq` / `getStopMetaById` / `getStopMetaByIds`): all stay within `performance.now()` resolution noise. Treat resolved/total counts as the signal, not ms.

#### Extend repo-bench: New methods

- `getTripInspectionTargets` — 15.40ms over 687 calls returning 83,370 targets means **~121 targets/stop avg**, **0.02ms/call**. The Trip Inspection feature is well within UX budget for stop selection.
- `getTripSnapshot` — 13.50ms over 1,914 calls (3 snapshots per stop with successful targets) means **0.01ms/call** for full snapshot reconstruction. Negligible per-snapshot cost.
- Combined +29ms in benchmark total. Future regression analysis on these methods should compare against this baseline (range 12.70-15.80 / 12.00-15.60 individually).

#### Extend repo-bench: Measurement stability

- Total range 84.80-97.00ms (span 14% of median). Run 4 alone accounts for the upper bound; Runs 1-3 / 5 sit in 84.80-88.40ms.
- 5 consecutive reloads (no other tasks between) eliminated the 145.70ms outlier seen earlier in non-consecutive runs (~58% spike was attributed to background activity).
- Median over 5 consecutive runs is the appropriate representative value for both regression detection and forward-looking baselines.

#### Extend repo-bench: Trade-off

- The +29ms cost of measuring 4 new methods raises Benchmark total from ~58ms (existing only) to 88.30ms (incl. new). This is acceptable because:
    - The 4 new methods are real production hot paths (trip inspection, portal/anchor, `?stop=` URL).
    - Without measuring them, regressions in those paths would be invisible.
    - Total still completes in <100ms for a 5-run cycle of <2 minutes.
- Floor-near methods are kept in the report for sanity-check purposes and historical continuity, even though their ms values are below `performance.now()` resolution.
