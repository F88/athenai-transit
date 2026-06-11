# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Athenai (あてのない乗換案内)** is a completely frontend-only transit web app that intentionally omits destination search. Instead, it surfaces "where can I go from here?" — enabling serendipitous exploration and leisurely walks.

- **Target device**: Smartphone (mobile browser first)
- **Backend**: None. All data processing runs entirely in the browser.

This is a TypeScript project using Leaflet, React, shadcn/ui, and Vite. Always ensure `tsc` and the build pass after changes. Run `npm run build` to verify.

## General Rules

Do not remove, rename, or modify code that the user did not explicitly ask to change. When in doubt, ask before making additional changes.

## Tech Stack

| Layer       | Technology                                                                        |
| ----------- | --------------------------------------------------------------------------------- |
| Frontend    | React 19 + TypeScript + Vite                                                      |
| Styling     | Tailwind CSS v4 + shadcn/ui (Radix UI)                                            |
| Map         | Leaflet.js + react-leaflet + GSI (Geospatial Information Authority of Japan) tile |
| Linting     | ESLint (typescript-eslint, type-checked) + Prettier (prettier-plugin-tailwindcss) |
| Testing     | Vitest + Storybook 10 (react-vite + Playwright)                                   |
| Data Source | GTFS / GTFS-JP open data (static, v4 baseline + legacy v3 feed compat)            |

## Architecture

Before proposing architecture or data flow changes, thoroughly investigate the existing codebase first. Do not assume simpler approaches exist — ask the user or explore the code to confirm.

### Repository Pattern

UI components depend only on `TransitRepository`, keeping UI and data layers loosely coupled. User-data (anchor / stop selection) lives in separate repositories with their own interfaces.

```text
TransitRepository                                  <- interface used by UI for transit data
  ├── AthenaiRepositoryV2  (athenai-repository/)   <- production (v2 DataBundle JSON)
  └── MockRepository       (mock-repository/)      <- for UI testing with fictional data

User-data repositories (separate from transit data):
  ├── AnchorRepository        (anchor/)            <- portal / anchor preference
  └── StopSelectionRepository (stop-selection/)    <- persistent stop selection
```

#### MockRepository (`?repo=mock` mode)

`MockRepository` is an in-memory implementation with fictional stops/routes for testing UI behavior with data that is valid per GTFS spec but does not exist in real datasets (e.g., stops served by multiple route types).

- **Activation**: Add `?repo=mock` to the URL (e.g., `http://localhost:5173/?repo=mock`). Available in all builds including production.
- **When to use**: Only when testing requires data shapes not present in real GTFS sources. For normal development, use real data.
- **Location**: `src/repositories/mock-repository/`

### Data Pipeline

A Node.js pre-build pipeline (`pipeline/`) converts GTFS CSV files into per-source SQLite databases (`pipeline/workspace/_build/db/`), then generates optimized JSON files for the app (`public/data-v2/`). See [pipeline/README.md](./pipeline/README.md) for details.

## Development Commands

```bash
npm run dev             # start Vite dev server
npm run build           # production build (tsc + vite build)
npm run typecheck       # tsc -b --noEmit
npm run lint            # ESLint (type-checked)
npm run lint:fix        # ESLint with auto-fix
npm run format          # Prettier format all files
npm run format:check    # Prettier check (CI)
npm run test            # Vitest run
npm run test:coverage   # Vitest with coverage
npm run preview         # preview production build
npm run storybook       # Storybook dev server
npm run build-storybook # Storybook production build
```

### Data preparation

```bash
npm run pipeline:download:gtfs              # 1.  download GTFS data (batch)
npm run pipeline:download:odpt-json         # 2.  download ODPT JSON data (batch, requires .env.pipeline.local)
npm run pipeline:build:db                   # 3.  convert GTFS CSV -> pipeline/workspace/_build/db/*.db
npm run pipeline:build:v2-data              # 4.  generate v2 DataBundle from GTFS
npm run pipeline:build:v2-odpt-train        # 5.  generate v2 ODPT Train DataBundle
npm run pipeline:build:v2-shapes:gtfs       # 6.  generate v2 route shapes from GTFS
npm run pipeline:build:v2-shapes:ksj        # 7.  generate v2 route shapes from KSJ railway
npm run pipeline:build:v2-insights          # 8.  generate v2 InsightsBundle from DataBundle
npm run pipeline:build:v2-global-insights   # 9.  generate v2 GlobalInsightsBundle
npm run pipeline:build:v2-data-source-catalog # 10. generate v2 DataSourceCatalog
npm run pipeline:validate:v2                # 11. validate generated v2 bundles
npm run data:sync                           # 12. copy pipeline/workspace/_build/data-v2/ -> public/<PIPELINE_TRANSIT_DATA_DIR>/ (default: public/data-v2/, destination may vary by environment)
```

Auxiliary pipeline commands:

```bash
npm run pipeline:check:odpt-resources # check ODPT resource availability
npm run pipeline:describe             # describe configured resources
npm run pipeline:dev-tools            # ad-hoc dev tooling
```

## Key UX Requirements

See [PRD.md](./PRD.md) section 3 for detailed UI/UX requirements. Key points for implementation:

- **Edge Markers**: direction indicators at screen edges for stops outside viewport (~1–2 km). Real-time update on pan. Bus/train visually differentiated.
- **Bottom Sheet**: max 3 departures per route/headsign. 1st = relative time ("in X min"), 2nd/3rd = absolute time (e.g., `14:30`).

## Map / Leaflet

When implementing UI positioning or z-index changes on the map, be aware of Leaflet's pane/stacking context system. Test visibility of all existing UI elements after changes. See [docs/map-architecture.md](./docs/map-architecture.md) for z-index layer assignments, layout mode, and click/tap event control details.

## Code Guidelines

- **No logic in TSX**: Business logic belongs in `src/domain/`, `src/utils/`, or `src/lib/`, not inline in components.
- **Pure functions first, Hooks for wiring**: Testable logic belongs in `src/domain/` or `src/utils/` as pure functions. Custom Hooks are for state orchestration (state + effect + callback), not for business logic.

For coding conventions (TSDoc, naming, braces), file placement, app-level orchestration, stop ID lookup, testing guidelines, and lint/format workflow, see [DEVELOPMENT.md](./DEVELOPMENT.md). Topic-specific implementation details (Map / Leaflet, runtime configuration, PWA, styling, repository API, dependencies, etc.) are split across `docs/**/*.md`; see [docs/README.md](./docs/README.md) for the up-to-date index.

## Refactoring

When refactoring or moving files, always verify path resolution and imports still work correctly before committing. Run the build after any file moves.

## Documentation

| File                 | Purpose                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| `README.md`          | Project entry point.                                                                  |
| `PRD.md`             | Product requirements (concept, UX, architecture overview). **What** to build and why. |
| `DEVELOPMENT.md`     | Developer entry point: code quality, file placement, app orchestration, stop lookup.  |
| `docs/README.md`     | Index of detailed implementation docs under `docs/**/*.md`.                           |
| `pipeline/README.md` | Independent data-build subsystem entry point.                                         |
| `CLAUDE.md`          | This file. High-level architecture and rules for Claude Code.                         |

Individual `docs/**/*.md` files may be added or reorganized over time; consult [README.md](./README.md) and [docs/README.md](./docs/README.md) for the current set.

## MCP Setup

Chrome DevTools MCP is configured in `.claude/settings.json` and starts automatically via `npx chrome-devtools-mcp@latest`.
