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

### Change

Replace per-query `StopWithMeta` assembly (`stopAgenciesMap.get()` + `stopRoutesMap.get()`)
with pre-built `Map<string, StopWithMeta>` (`stopsMetaMap`) in `mergeSourcesV2()`.

### Results (5 runs each, median)

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

### Observations

#### Initialization (mergeSources)

- `mergeSources` median shows before=44ms, after=40ms, but the ranges overlap
  (before 38-51ms, after 37-48ms). The `stopsMetaMap` construction adds ~15,805
  `Map.set()` calls which costs ~1-2ms — too small to distinguish from
  measurement noise at this scale. The apparent "improvement" is not real;
  the difference is within normal browser execution variance.
- Memory overhead is minimal (shared `Stop`, `Agency[]`, `Route[]` references).

#### Benchmark (repo API queries)

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
