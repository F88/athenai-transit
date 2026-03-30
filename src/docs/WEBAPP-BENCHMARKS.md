# WebApp Benchmarks

Repository API benchmark results measured via `?diag=repo-bench`.

Benchmarks run across 12 fixed locations (`BENCH_LOCATIONS` in `src/diagnostics/repo-benchmark.ts`).

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
6. レポートには以下の3点を含める:
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
