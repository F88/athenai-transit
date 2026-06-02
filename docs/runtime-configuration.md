# Runtime Configuration

Runtime and debugging details live here so `DEVELOPMENT.md` can stay focused on day-to-day development rules.

## Logger

### Basic usage

```typescript
import { createLogger } from '../lib/logger';

const logger = createLogger('GTFS');

logger.debug('Loading sources:', prefixes);
logger.info('Repository initialized');
logger.warn('Skipping invalid source:', prefix);
logger.error('Failed to fetch data:', error);
```

### Log levels

| Level   | Use case                     |
| ------- | ---------------------------- |
| `debug` | detailed development traces  |
| `info`  | notable lifecycle events     |
| `warn`  | recoverable issues           |
| `error` | failures requiring attention |

Output format:

```text
[14:05:23.456] [GTFS] Loading sources: ["tobus", "toaran"]
```

### Filters

Default levels are controlled by environment variables.

| Environment | `VITE_LOG_LEVEL` | `VITE_LOG_TAGS` |
| ----------- | ---------------- | --------------- |
| development | `debug`          | `*`             |
| production  | `warn`           | empty           |

Tag patterns:

| Pattern | Meaning        |
| ------- | -------------- |
| `*`     | match all tags |
| `GTFS`  | exact match    |
| `Stop*` | prefix match   |
| `-App`  | exclude tag    |

`warn` and `error` always bypass tag filtering.

### Gating expensive arguments

`logger.debug(...)` / `logger.verbose(...)` short-circuit internally when filtered, but arguments are evaluated before the call. Gate non-trivial argument construction.

```typescript
if (logger.isEnabled('debug')) {
    const elapsed = Math.round(performance.now() - t0);
    logger.debug(`getStopsNearby: ${data.length}/${sorted.length} in ${elapsed}ms`);
}
```

Gate function calls, array iteration, large template interpolation, and any computation that only feeds logs. Do not gate string literals, single-variable interpolation, or always-emitted `info` / `warn` / `error` calls.

### DevTools helper

In development builds, `window.__log` is available in the browser console.

```javascript
__log.setLevel('debug');
__log.setLevel('warn');
__log.setTags('GTFS', 'Stop*');
__log.setTags('*', '-App');
__log.getConfig();
```

Changes are in-memory and reset on reload.

## Mode definitions

### Perf Mode (`lite | normal | full`)

Perf mode controls data volume (nearby radius, result limit) as a profile. Render mode and route-shape visibility are independent of it: changing perf mode does not reset render mode or toggle route shapes.

| Mode     | Description                             |
| -------- | --------------------------------------- |
| `lite`   | low-end devices, 500m nearby radius     |
| `normal` | default, 1000m nearby radius            |
| `full`   | higher-end devices, 2000m nearby radius |

### Render Mode (`auto | standard | lightweight`)

| Mode          | Description                                   |
| ------------- | --------------------------------------------- |
| `auto`        | switches standard / lightweight by zoom level |
| `standard`    | DOM-based rendering                           |
| `lightweight` | Canvas-based rendering                        |

### Data Config

Perf mode determines repository query parameters.

- `stops.nearbyRadius`: radius for `getStopsNearby` in meters
- `stops.maxResults`: max stops returned by bounds / nearby queries

## URL parameter helpers

### `?time=`

`?time=` sets the initial datetime for demos or reproductions.

```text
http://localhost:5173/?time=2026-03-25T20:55
http://localhost:5173/?time=2026-03-25T20:55:00+09:00
http://localhost:5173/?time=2026-03-25T20:55:00Z
http://localhost:5173/?lat=35.68&lng=139.39&zm=16&time=2026-03-25T20:55
```

Use RFC 3339. Seconds and timezone are optional; omitted timezone means local time. Supplying `?time=` enters custom-time mode.

### `?repo=` mode

`?repo=` switches repository implementation. It is available in production builds.

```text
http://localhost:5173/              -> v2 (default)
http://localhost:5173/?repo=mock    -> MockRepository
```

`MockRepository` in `src/repositories/mock-repository.ts` is an in-memory implementation for valid-but-fictional data shapes that real GTFS sources may not contain. Use real data for normal development.

Mock data is around 熊野前駅 and includes stops with multiple route types, including tram, subway, rail, and bus. Edit `STOPS`, `ROUTES`, and `STOP_ROUTES` when a special test pattern is needed. `STOP_ROUTE_TYPES` is derived automatically.

## Diagnostics (`?diag=` mode)

`?diag=<name>` runs a diagnostic tool after repository creation and before React rendering. Diagnostics are dynamically imported and log to the browser console.

```text
http://localhost:5173/?diag=v2-load
```

| name         | Description                                                    |
| ------------ | -------------------------------------------------------------- |
| `v2-load`    | benchmark loading v2 data / shapes / insights / global bundles |
| `repo-bench` | benchmark repository APIs across HOME_LOCATIONS                |

Targets are based on `DataSourceManager` enabled sources and can be narrowed with `?sources=` or localStorage.

### `v2-load` output

- Phase 1: parallel `data.json` loading
- Phase 2: parallel `shapes.json` + `insights.json` loading for successful sources
- Phase 3: `global/insights.json` loading
- Summary: `Total: Xms (data=Xms, shapes+insights=Xms, global=Xms)`

`FetchDataSourceV2` debug logs include per-source network / parse detail.

### `repo-bench` output

```text
?diag=repo-bench
```

Measures `getAllStops`, `getRouteShapes`, `getAllSourceMeta`, `getStopsInBounds`, `getStopsNearby`, `getUpcomingTimetableEntries`, `getRouteTypesForStop`, and `getFullDayTimetableEntries`.

### Adding diagnostics

Add a `case` in `src/diagnostics/index.ts`. `src/main.tsx` does not need changes.
