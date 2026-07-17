---
name: gtfs-data-build
description: >
    Run the GTFS data pipeline to build web app data files from GTFS sources.
    Use when the user asks to "update data", "rebuild data", "run the pipeline",
    "download GTFS", "refresh transit data", or wants to regenerate JSON files
    from GTFS sources.
---

# GTFS Data Build

Build web app JSON data files from GTFS open data sources.

## Pipeline Steps

Commands and execution order are documented in `CLAUDE.md` "Data preparation" section. Run steps 1-12 in order; each step depends on the previous one.

## Execution rules

- **One command per shell call — never chain pipeline steps with `&&`.** Judge each step from its full output before running the next.
- **Exit status alone is NOT a success signal.** Some pipeline scripts print usage and exit 0 on invalid arguments (`parseCliArg` returns `help` for user errors), so an `&&` chain can roll past a step that did nothing — e.g. building app data from a stale DB.
- **Per-source scripts take exactly ONE source name (or `--targets <file>`, never both).** `build-gtfs-db.ts --targets <file> <source>` is invalid and prints usage with exit 0.
- When in doubt, verify the artifact itself (mtime / content such as `feedInfo` in `data.json`), not just the log.

## When to skip steps

- **Steps 1-2 (download)**: Skip if source files are already up to date. GTFS files live in `pipeline/workspace/data/gtfs/{outDir}/`; ODPT JSON files in `pipeline/workspace/data/odpt-json/{outDir}/`.
- **Step 7 (KSJ shapes)**: Skip if only bus data changed. Requires `pipeline/workspace/data/mlit/N02-25_RailroadSection.geojson`.
- **Step 12 (pipeline:deliver:local)**: Always run last — this copies built data from `pipeline/workspace/_build/data-v2/` to `__LOCAL_AT_DATA__/<PIPELINE_TRANSIT_DATA_DIR>/` where the dev server serves it. The default is `__LOCAL_AT_DATA__/data-v2/` (git-ignored), but the destination base (`TRANSIT_DATA_DELIVERY_BASE_DIR`) and dir (`PIPELINE_TRANSIT_DATA_DIR`) may be overridden depending on the environment.
    - Note: this step is for local development (so `npm run dev` can serve the freshly built data from `__LOCAL_AT_DATA__/`). The production build procedure differs in part and does not necessarily include this step — do not assume the local and production procedures are identical.

## Data flow

```
ODPT API (GTFS ZIP / ODPT JSON)
  -> pipeline/workspace/data/{gtfs,odpt-json}/{outDir}/   (steps 1-2)
  -> pipeline/workspace/_build/db/{outDir}.db             (step 3)
  -> pipeline/workspace/_build/data-v2/{prefix}/*.json    (steps 4-10)
  -> __LOCAL_AT_DATA__/<PIPELINE_TRANSIT_DATA_DIR>/{prefix}/*.json   (step 12)
```

## Sources

Defined in `pipeline/config/resources/{gtfs,odpt-json}/`. Each `.ts` file is a single source definition. See each script's TSDoc header for detailed input/output paths.

## Troubleshooting

- GTFS ZIP download does not require authentication (publicly accessible)
- ODPT JSON download requires `ODPT_ACCESS_TOKEN` environment variable (set via `pipeline/.env.pipeline.local`)
- `pipeline:build:db` expects GTFS CSV files in `pipeline/workspace/data/gtfs/{outDir}/`
- `pipeline:build:v2-shapes:ksj` expects MLIT GeoJSON at `pipeline/workspace/data/mlit/N02-XX_RailroadSection.geojson` (year-suffixed)
- If JSON output looks stale, check that `pipeline:deliver:local` was run after the build steps and inspect the effective `PIPELINE_TRANSIT_DATA_DIR` for the current environment.
