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

Commands and execution order are documented in `CLAUDE.md` "Data preparation" section. Run steps 1-6 in order; each step depends on the previous one.

## When to skip steps

- **Steps 1-2 (download)**: Skip if GTFS source files are already up to date. Files live in `pipeline/data/gtfs/{toei-bus,toei-train}/`.
- **Step 5 (train-shapes)**: Skip if only bus data changed. Requires `pipeline/data/mlit/N02-24_RailroadSection.geojson`.
- **Step 6 (data:sync)**: Always run last — this copies built data to `public/data/` where Vite serves it.

## Data flow

```
ODPT API (GTFS ZIP)
  -> pipeline/data/gtfs/{source}/*.txt    (steps 1-2)
  -> pipeline/build/{prefix}.db           (step 3)
  -> pipeline/build/data/{prefix}/*.json  (steps 4-5)
  -> public/data/{prefix}/*.json          (step 6)
```

## Sources

Defined in `pipeline/resources/gtfs/`. Each `.ts` file is a single source definition. See each script's TSDoc header for detailed input/output paths.

## Troubleshooting

- GTFS ZIP download does not require authentication (publicly accessible)
- ODPT JSON download requires `ODPT_ACCESS_TOKEN` environment variable
- `build:db` expects GTFS CSV files in `pipeline/data/gtfs/{directory}/`
- `build:train-shapes` expects MLIT GeoJSON in `pipeline/data/mlit/`
- If JSON output looks stale, check that `data:sync` was run after `build:json`
