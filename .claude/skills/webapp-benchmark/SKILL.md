---
name: webapp-benchmark
description: >
    Run WebApp performance benchmarks and record results.
    Use when the user asks to "benchmark", "measure performance",
    "run benchmarks", or needs to verify performance impact of changes.
---

# WebApp Benchmark

Measure repository initialization and API performance using the built-in diagnostic tool.

## Benchmark Tool

Add `?diag=repo-bench` to the URL to run the benchmark automatically.

```
http://localhost:5173/?diag=repo-bench
```

The tool runs 12 fixed locations (`BENCH_LOCATIONS` in `src/diagnostics/repo-benchmark.ts`) and outputs results to the browser console.

## What It Measures

### Initialization (from console INFO logs)

| Metric | Source                           |
| ------ | -------------------------------- |
| fetch  | `fetchSources: Xms`              |
| merge  | `mergeSources: Xms`              |
| enrich | `Stop insights enriched in Xms`  |
| shapes | `Shapes loaded: N shapes in Xms` |

### API (from `[diag:repo-bench]` logs)

- `getAllStops`
- `getRouteShapes`
- `getAllSourceMeta`
- `getStopsInBounds` (12 locations)
- `getStopsNearby` (12 locations)
- `getUpcomingTimetableEntries` limit=3 and no-limit
- `getRouteTypesForStop`
- `getFullDayTimetableEntries`
- `getStopsForRoutes` (12 calls)
- Benchmark total

## Measurement Protocol

1. Open the page with `?diag=repo-bench`.
2. Wait for results to stabilize (discard cold-start runs if unstable).
3. Reload the page and collect results. Repeat **at least 5 times**.
4. Run 1 may be a JIT warmup outlier. Mark with `*` but do NOT exclude without increasing sample size.
5. Use **median** as the representative value.
6. Network conditions (cache, service worker) affect results significantly. Keep conditions consistent across runs.

## Report Format

Record results in `src/docs/WEBAPP-BENCHMARKS.md`. Each report must include:

1. **Change description**: What was modified and why.
2. **Raw data tables**: Initialization and API results for all runs.
3. **Comparison with previous**: Median diff table against the last recorded benchmark.
4. **Observations**: Root cause analysis of any changes, trade-offs.

## Important

- **Always use `?diag=repo-bench`**. Do NOT manually read individual console log lines.
- **Always measure both Initialization AND API**. One without the other is incomplete.
- **Read `src/docs/WEBAPP-BENCHMARKS.md` before starting**. Know the previous baseline.
- Do not discard outliers from a small sample. Increase the sample size instead.
- Note the environment (machine, browser, data size) if different from the recorded baseline.
