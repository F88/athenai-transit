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
| Data Source | GTFS open data (static)                                                           |

## Architecture

Before proposing architecture or data flow changes, thoroughly investigate the existing codebase first. Do not assume simpler approaches exist — ask the user or explore the code to confirm.

### Repository Pattern

UI components depend only on `TransitRepository`, keeping UI and data layers loosely coupled.

```text
TransitRepository          <- interface used by UI
  ├── GtfsRepository        <- production (GTFS JSON data)
  └── MockRepository        <- for UI testing with fictional data
```

#### MockRepository (`?repo=mock` mode)

`MockRepository` is an in-memory implementation with fictional stops/routes for testing UI behavior with data that is valid per GTFS spec but does not exist in real datasets (e.g., stops served by multiple route types).

- **Activation**: Add `?repo=mock` to the URL (e.g., `http://localhost:5173/?repo=mock`). Available in all builds including production.
- **When to use**: Only when testing requires data shapes not present in real GTFS sources. For normal development, use real data.
- **Location**: `src/repositories/mock-repository.ts`

### Data Pipeline

A Node.js pre-build pipeline (`pipeline/`) converts GTFS CSV files into per-source SQLite databases (`pipeline/workspace/_build/db/`), then generates optimized JSON files for the app (`public/data/`). See [pipeline/README.md](./pipeline/README.md) for details.

## Development Commands

```bash
npm run dev          # start Vite dev server
npm run build        # production build (tsc + vite build)
npm run lint         # ESLint (type-checked)
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier format all files
npm run format:check # Prettier check (CI)
npm run preview      # preview production build
```

### Data preparation

```bash
npm run pipeline:download:gtfs            # 1. download GTFS data (batch)
npm run pipeline:download:odpt-json      # 2. download ODPT JSON data (batch, requires .env.pipeline.local)
npm run pipeline:build:db                # 3. convert GTFS CSV -> pipeline/workspace/_build/db/*.db
npm run pipeline:build:json              # 4. generate JSON -> pipeline/workspace/_build/data/
npm run pipeline:build:odpt-train        # 5. generate ODPT Train JSON -> pipeline/workspace/_build/data/
npm run pipeline:build:shapes:gtfs       # 6. generate route shapes from GTFS
npm run pipeline:build:shapes:ksj        # 7. generate route shapes from KSJ railway
npm run pipeline:build:v2-shapes:gtfs    # 6v2. generate v2 route shapes from GTFS
npm run pipeline:build:v2-shapes:ksj     # 7v2. generate v2 route shapes from KSJ railway
npm run pipeline:build:v2-insights       # 8v2. generate v2 InsightsBundle from DataBundle
npm run data:sync                        # 9. copy pipeline/workspace/_build/data/ -> public/data/
```

## Key UX Requirements

See [PRD.md](./PRD.md) section 3 for detailed UI/UX requirements. Key points for implementation:

- **Edge Markers**: direction indicators at screen edges for stops outside viewport (~1–2 km). Real-time update on pan. Bus/train visually differentiated.
- **Bottom Sheet**: max 3 departures per route/headsign. 1st = relative time ("in X min"), 2nd/3rd = absolute time (e.g., `14:30`).

## Map / Leaflet

When implementing UI positioning or z-index changes on the map, be aware of Leaflet's pane/stacking context system. Test visibility of all existing UI elements after changes. See [DEVELOPMENT.md](./DEVELOPMENT.md) for z-index layer assignments and click/tap event control details.

## Code Guidelines

- **No logic in TSX**: Business logic belongs in `src/domain/`, `src/utils/`, or `src/lib/`, not inline in components.
- **Pure functions first, Hooks for wiring**: Testable logic belongs in `src/domain/` or `src/utils/` as pure functions. Custom Hooks are for state orchestration (state + effect + callback), not for business logic.

For coding conventions (TSDoc, naming, braces), file organization, testing guidelines, and lint/format workflow, see [DEVELOPMENT.md](./DEVELOPMENT.md).

## Refactoring

When refactoring or moving files, always verify path resolution and imports still work correctly before committing. Run the build after any file moves.

## Documentation

| File             | Purpose                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `PRD.md`         | Product requirements (concept, UX requirements, architecture overview). **What** to build and **why**.          |
| `DEVELOPMENT.md` | Developer guide (code quality, z-index layers, mode definitions, API specs, styling, logger). **How** to build. |
| `CLAUDE.md`      | This file. High-level architecture and rules for Claude Code.                                                   |

## MCP Setup

Chrome DevTools MCP is configured in `.claude/settings.json` and starts automatically via `npx chrome-devtools-mcp@latest`.
