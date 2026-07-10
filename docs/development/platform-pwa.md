# Platform and PWA

> [!IMPORTANT]
> When documenting data sizes, file sizes, counts, or similar numbers, include the measurement date (`YYYY-MM-DD`). Re-measure before using old numbers for design or estimates.

## Overview

The app uses `vite-plugin-pwa` (`generateSW` + `autoUpdate`). Standalone installation removes browser UI and provides app-shell offline caching.

## Cache strategy

| Target                           | Strategy             | Settings                | Expected size                                                                                                     |
| -------------------------------- | -------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| App shell (JS/CSS/HTML/icons)    | precache             | generated at build time | ~1 MB                                                                                                             |
| GTFS data (`/data/v2/**/*.json`) | StaleWhileRevalidate | 7 days, max 50 entries  | default all-enabled `data.json` total about 91 MB; the full data-v2 bundle set about 132 MB (measured 2026-05-12) |
| GSI map tiles                    | CacheFirst           | 30 days, max 50 entries | real data size varies; Chrome quota can count up to about 350 MB                                                  |

### GTFS data cache

- `StaleWhileRevalidate` returns cached data immediately and updates in the background.
- A single source `data.json` ranges from a few KB to about 18 MB (`snws` about 3 KB, `minkuru` about 18 MB, measured 2026-05-12).
- Default all-enabled `data.json` totals about 91 MB; including `shapes.json` / `insights.json`, the full data-v2 bundle set totals about 132 MB (measured 2026-05-12).
- `public/data-v2/` is not precached (`globIgnores: ['data/**', 'data-v2/**']`). `data/**` remains for legacy v1.
- App-shell precache uses `globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']`.

### Map tile cache

- GSI tiles do not send CORS headers and are stored as opaque responses.
- Chrome adds about 7 MB quota padding per opaque response.
- Increasing `maxEntries` can significantly affect storage quota.

## JSON compression delivery

Current GTFS JSON is served and cached uncompressed. Default all-enabled `data.json` is about 91 MB, and the full data-v2 bundle set is about 132 MB including shapes / insights (measured 2026-05-12).

Potential optimization:

```text
pipeline generates .json.gz
  -> serve as normal application/gzip resource, not Content-Encoding
  -> service worker caches compressed bytes
  -> app decompresses with DecompressionStream, then JSON.parse
```

Measured gzip compression for default all-enabled `data.json` was about 91 MB -> 9 MB, about 10x smaller (measured 2026-05-12).

`Content-Encoding: gzip` optimizes network transfer, but Cache API stores the decoded body. Cache-size reduction requires `.gz` as the actual cached resource.

## Platform behavior

### App name / icon label

| Platform        | Source                                     | Current value        |
| --------------- | ------------------------------------------ | -------------------- |
| iOS             | `<meta name="apple-mobile-web-app-title">` | `アテナイ`           |
| Android         | manifest `short_name`                      | `アテナイ`           |
| macOS / Windows | manifest `name`                            | `あてのない乗換案内` |

### Install requirements

| Platform               | HTTPS required | Notes                                      |
| ---------------------- | -------------- | ------------------------------------------ |
| iOS Safari             | No             | `localhost` and LAN IP can use A2HS        |
| Android Chrome         | Yes            | `localhost` is an exception; LAN IP is not |
| macOS / Windows Chrome | Yes            | `localhost` is an exception                |

### Status bar

| Platform        | `theme-color` media query | Behavior                                            |
| --------------- | ------------------------- | --------------------------------------------------- |
| iOS Safari      | supported                 | light / dark automatic switching                    |
| Android Chrome  | unstable                  | manifest `theme_color` may win depending on version |
| macOS / Windows | -                         | title bar uses `theme_color`                        |

### Viewport zoom limit

`index.html` sets `maximum-scale=1.0, user-scalable=no`. Leaflet directly controls map pinch gestures, so browser-level pinch zoom would conflict with map zoom.

## iOS standalone viewport

### viewport-fit / status-bar-style combinations

| Pattern | viewport-fit | status-bar-style  | iOS top               | iOS bottom      | Android |
| ------- | ------------ | ----------------- | --------------------- | --------------- | ------- |
| A       | cover        | black-translucent | map draws to top edge | safe-area issue | best    |
| B       | none         | default           | solid theme color     | full bottom     | best    |
| C       | cover        | default           | solid theme color     | full bottom     | best    |
| D       | none         | black-translucent | solid theme color     | full bottom     | best    |

- Android behaves the same for all combinations because it ignores `apple-mobile-web-app-*`.
- `black-translucent` requires `viewport-fit=cover`.
- `viewport-fit=cover` alone does not affect bottom.
- Top full-bleed map and full bottom usage cannot currently both be satisfied on iOS.
- Current setting: pattern A.
- Fallback candidate: pattern B.
- `black-translucent` is deprecated since iOS 14.5 (2021), but remains the only available full-screen option.
- Google Maps on iOS / Android behaves similarly to pattern A.
- Apple Maps achieves full map + full floating UI with native privileges.

## iOS safe-area handling

When `apple-mobile-web-app-status-bar-style` is `black-translucent`, the map extends to the top edge. UI that overlaps the notch / Dynamic Island must add `env(safe-area-inset-top)`.

`safe-area-inset-bottom` is intentionally unused. It is large (34px) and can cause BottomSheet / panel overlap issues; the home-indicator area does not block taps.

ControlPanel-based panels use `edge` + `offset` props for top safe-area handling:

- `MapLayerPanel`: top, 0.75rem
- `RenderingPanel`: top, 0.75rem
- `StopTypeFilterPanel`: top, 10.25rem
- `InfoPanel`: top, 13rem
- `MapNavigationPanel`: bottom, 2rem, no safe-area
- `StopControlPanel`: bottom, 2rem, no safe-area

Components with inline `calc()` safe-area handling:

- `TimeControls`: `top-[calc(1.25rem+env(safe-area-inset-top))]`
- `StopHistory`: `top-[calc(4rem+env(safe-area-inset-top))]`
- `SelectionIndicator`: `top-[calc(4rem+env(safe-area-inset-top))]`
