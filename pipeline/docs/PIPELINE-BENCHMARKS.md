# Pipeline Benchmarks

Pipeline execution time measurements for local development and CI environments.

## 2026-03-23: Full Pipeline (16 GTFS + 7 ODPT JSON sources)

### Full Pipeline Environment

|         | Local (dev)  | CI                                                                                          |
| ------- | ------------ | ------------------------------------------------------------------------------------------- |
| Machine | Apple M4 Mac | GitHub Actions ubuntu-latest                                                                |
| Node.js | v22.14.0     | v22.22.1                                                                                    |
| Runner  | —            | ubuntu-24.04 (20260309.50.1)                                                                |
| Run     | manual       | [actions/runs/23427582657](https://github.com/F88/athenai-transit/actions/runs/23427582657) |

### Full Pipeline Results

| Step                           | npm script                     | Local      | CI         | CI/Local |
| ------------------------------ | ------------------------------ | ---------- | ---------- | -------- |
| Download GTFS (15 sources)     | `download-gtfs --targets`      | 22.5s      | 54.0s      | 2.4x     |
| Download ODPT JSON (7 sources) | `download-odpt-json --targets` | 10.6s      | 18.0s      | 1.7x     |
| Build SQLite DB                | `pipeline:build:db`            | 32.9s      | 46.0s      | 1.4x     |
| Build JSON (v1)                | `pipeline:build:json`          | 31.8s      | 42.0s      | 1.3x     |
| Build ODPT Train               | `pipeline:build:odpt-train`    | 2.3s       | 2.0s       | 0.9x     |
| Build Shapes (GTFS)            | `pipeline:build:shapes:gtfs`   | 9.3s       | 9.0s       | 1.0x     |
| Build Shapes (KSJ)             | `pipeline:build:shapes:ksj`    | 4.6s       | 5.0s       | 1.1x     |
| Data Sync                      | `data:sync`                    | 1.4s       | 1.0s       | 0.7x     |
| Validate                       | `pipeline:validate`            | 1.2s       | 2.0s       | 1.7x     |
| **Pipeline Total**             |                                | **116.6s** | **179.0s** | **1.5x** |

### Full Pipeline Observations

- Download steps are network-bound: CI (US West) vs local (Japan) explains the 1.7-2.4x difference.
- CPU-bound steps (Build DB, Build JSON) show 1.3-1.4x difference (M4 vs GitHub Actions runner).
- Small tasks (ODPT Train, Shapes, Sync) show negligible difference.
- CI total pipeline fits well within the 15-minute timeout.

## 2026-03-23: Full Pipeline with v2 (16 GTFS + 7 ODPT JSON sources)

### v1+v2 Pipeline Environment

|         | CI                                                                                          |
| ------- | ------------------------------------------------------------------------------------------- |
| Machine | GitHub Actions ubuntu-latest                                                                |
| Node.js | v22.22.1                                                                                    |
| Runner  | ubuntu-24.04                                                                                |
| Run     | [actions/runs/23436460520](https://github.com/F88/athenai-transit/actions/runs/23436460520) |

### v1+v2 Pipeline Results

| Step                           | CI    |
| ------------------------------ | ----- |
| Download GTFS (16 sources)     | 54.0s |
| Download ODPT JSON (7 sources) | 17.0s |
| Build SQLite DB                | 45.0s |
| Build JSON (v1)                | 43.0s |
| Build ODPT Train (v1)          | 2.0s  |
| Build Shapes GTFS (v1)         | 10.0s |
| Build Shapes KSJ (v1)          | 5.0s  |
| **Build v2 data (GTFS)**       | 43.0s |
| **Build v2 ODPT Train**        | 2.0s  |
| **Build v2 shapes (GTFS)**     | 10.0s |
| **Build v2 shapes (KSJ)**      | 5.0s  |
| **Build v2 insights**          | 19.0s |
| **Build v2 global insights**   | 18.0s |
| Data Sync (v1+v2)              | 1.0s  |
| Validate (v1)                  | 1.0s  |
| **Validate (v2)**              | 2.0s  |
| **Pipeline Total**             | ~304s |

### v1+v2 Pipeline Observations

- v2 追加分は約 99s (1分40秒)。v1 のみの 179s から 304s に増加。
- v1 と v2 の data/shapes ビルドはほぼ同じ時間 (同じ DB から生成)。
- v2 insights (19s) + global insights (18s) が v2 固有のコスト。
- 全体 304s で timeout 15分 (900s) の 1/3。十分な余裕。

## 2026-03-23: Check Transit Resources (15 ODPT sources)

### Check Resources Environment

|         | Local (dev)  | CI                                                                                          |
| ------- | ------------ | ------------------------------------------------------------------------------------------- |
| Machine | Apple M4 Mac | GitHub Actions ubuntu-latest                                                                |
| Node.js | v22.14.0     | v22.22.1                                                                                    |
| Runner  | —            | ubuntu-24.04 (20260309.50.1)                                                                |
| Run     | manual       | [actions/runs/23427954758](https://github.com/F88/athenai-transit/actions/runs/23427954758) |

### Check Resources Results

| Step                 | Local | CI   | CI/Local |
| -------------------- | ----- | ---- | -------- |
| Check ODPT resources | 7.5s  | 8.0s | 1.1x     |

### Check Resources Observations

- Primarily network-bound (Members Portal API call). Local and CI show similar times.
- Results: 4 errors (oshima-bus EXPIRED, chuo-bus EXPIRED + NO_VALID_DATA, keisei-transit-bus EXPIRED), 2 warnings (kanto-bus EXPIRING_SOON, iyotetsu-bus EXPIRING_SOON).
- kyoto-city-bus REMOVED resolved after PR #51 (resourceId + downloadUrl update).
