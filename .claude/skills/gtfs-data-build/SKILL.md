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

## When to skip steps

- **Steps 1-2 (download)**: Skip if source files are already up to date. GTFS files live in `pipeline/workspace/data/gtfs/{outDir}/`; ODPT JSON files in `pipeline/workspace/data/odpt-json/{outDir}/`.
- **Step 7 (KSJ shapes)**: Skip if only bus data changed. Requires `pipeline/workspace/data/mlit/N02-25_RailroadSection.geojson`.
- **Step 12 (data:deliver:local)**: Always run last — this copies built data from `pipeline/workspace/_build/data-v2/` to `public/<PIPELINE_TRANSIT_DATA_DIR>/` where the app serves it. The default is `public/data-v2/`, but the destination may be overridden by `PIPELINE_TRANSIT_DATA_DIR` depending on the environment.
    - Note: this step is for local development (so `npm run dev` can serve the freshly built data from `public/`). The production build procedure differs in part and does not necessarily include this step — do not assume the local and production procedures are identical.

## Data flow

```
ODPT API (GTFS ZIP / ODPT JSON)
  -> pipeline/workspace/data/{gtfs,odpt-json}/{outDir}/   (steps 1-2)
  -> pipeline/workspace/_build/db/{outDir}.db             (step 3)
  -> pipeline/workspace/_build/data-v2/{prefix}/*.json    (steps 4-10)
  -> public/<PIPELINE_TRANSIT_DATA_DIR>/{prefix}/*.json   (step 12)
```

## Sources

Defined in `pipeline/config/resources/{gtfs,odpt-json}/`. Each `.ts` file is a single source definition. See each script's TSDoc header for detailed input/output paths.

## Troubleshooting

- GTFS ZIP download does not require authentication (publicly accessible)
- ODPT JSON download requires `ODPT_ACCESS_TOKEN` environment variable (set via `pipeline/.env.pipeline.local`)
- `pipeline:build:db` expects GTFS CSV files in `pipeline/workspace/data/gtfs/{outDir}/`
- `pipeline:build:v2-shapes:ksj` expects MLIT GeoJSON at `pipeline/workspace/data/mlit/N02-XX_RailroadSection.geojson` (year-suffixed)
- If JSON output looks stale, check that `data:deliver:local` was run after the build steps and inspect the effective `PIPELINE_TRANSIT_DATA_DIR` for the current environment.
