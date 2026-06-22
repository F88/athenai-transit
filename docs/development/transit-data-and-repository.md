# Transit Data and Repository

This document collects web app data-access contracts. Pipeline internals remain in [../../pipeline/README.md](../../pipeline/README.md) and [../../pipeline/docs/](../../pipeline/docs/).

## Stop ID lookup

There are two ways to resolve `stop_id` to `StopWithMeta`. Choose by where the `stop_id` came from. Using a viewport-only lookup for persisted IDs causes silent fallback outside the viewport and can break display names or translations.

### `repo.getStopMetaByIds(stopIds: Set<string>): StopWithMeta[]`

This synchronous API queries the full enabled dataset and is independent of the stop's location. In v2, it uses a prebuilt `stop_id -> StopWithMeta` map, so cost is proportional to `stopIds.size` and each lookup is O(1).

Use this for:

- Anchor / bookmark display names and refresh
- StopHistory name resolution
- selected route stop rendering
- URL `?stop=` resolution
- localStorage / search results / any persisted or non-viewport-origin stop id

When unsure, use `getStopMetaByIds`.

### `findStopWithMeta(stopId)` in `src/app.tsx`

This is viewport-only and searches `radiusStops` and `inBoundStops`. It exists for hot paths around stops the user is currently interacting with.

Use it only for:

- current map marker click
- immediate `onStopSelected` flows
- stops known to be in the current viewport or nearby radius

Never use it for persisted IDs such as anchors, history, route stops, or `?stop=`.

### Decision flow

1. Did the stop id come from a direct user action in the current viewport? Use `findStopWithMeta` only if yes.
2. Did it come from localStorage, URL, settings, selected route, search result, or a previous session? Use `repo.getStopMetaByIds`.
3. If unclear, use `repo.getStopMetaByIds` and add a short comment explaining whether the ID is persistent or viewport-local.

## Stop reference selection contract

Stop selection flows should prefer live metadata and use persisted snapshot fallback only when live metadata is unavailable. Keep this contract in shared helper functions and tests before simplifying call sites.

History / Portal / Search can have separate side effects, but navigation payload semantics should remain shared where possible.

## GTFS i18n

### `feed_lang` (`feed_info.txt`, required)

`feed_lang` defines the default language for text in the dataset, such as `stop_name` and `trip_headsign`.

- `translations.txt` can provide translations.
- `mul` means multilingual feed: base values may be written in multiple languages, with translations supplied separately.

### `agency_lang` (`agency.txt`, optional)

`agency_lang` is the agency's primary language and is a hint for casing and language-specific presentation. It does not define the language of text fields.

### `translations.txt` `language`

If a translation row has the same language as `feed_info.feed_lang`, the original field value is treated as the default for languages without a specific translation. Explicit translation rows take precedence.

### Project application

- Base value language is decided by `feed_lang`, not `agency_lang`.
- Repository `mergeSourcesV2` injects `feed_lang` into translation names to normalize base values (Issue #107).
- `feed_lang = "mul"` is not injected.
- Empty `feed_lang` falls back to `agency_lang`.

## TransitRepository API

All methods return `Result<T>` or `CollectionResult<T>`. Domain-level errors use `{ success: false, error }`, and callers decide fallback behavior.

- `getStopsInBounds(bounds, limit)`: distance-sorted from bounds center. `limit` is required. Max `MAX_STOPS_RESULT`.
- `getStopsNearby(center, radiusM, limit)`: distance-sorted. `limit` is required. Max `MAX_STOPS_RESULT`.
- `getUpcomingDepartures(stopId, now, limit?)`: up to `limit` per route / headsign group. Unknown stop id returns `success: false`.
- `getRouteTypeForStop(stopId)`: async minimum route type. Unknown stop id returns `success: false`.
- `getRouteShapes()`: all route shapes.
- `getFullDayDepartures(stopId, routeId, headsign, date)`: all departure times for the day, in minutes.
- `getAllStops()`: all stops, capped by `MAX_STOPS_RESULT`.

## Pipeline independence

`pipeline/` builds static data for the web app but is not organized under the web app `src/` placement rules. Pipeline commands, resources, and implementation details are documented in [../../pipeline/README.md](../../pipeline/README.md) and [../../pipeline/docs/](../../pipeline/docs/).

When changing pipeline code, follow pipeline docs first. Root docs may describe how the web app consumes generated files, but they should not become the source of truth for pipeline internals.
