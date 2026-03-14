---
name: add-gtfs-source
description: >
    Step-by-step guide for adding a new GTFS data source to the pipeline and web app.
    Use when the user wants to "add a new bus company", "add a new data source",
    "add [operator name] data", integrate a new GTFS feed, or mentions a CKAN dataset URL
    they want to incorporate. Also triggers when the user shares an ODPT/CKAN resource link
    and wants to use that data in the app.
---

# Add GTFS Source

End-to-end procedure for adding a new GTFS/GTFS-JP data source. This covers everything from CKAN catalog research to a verified, committed web app integration.

## Prerequisites

- The data source must be available as a GTFS or GTFS-JP ZIP file
- If authentication is required, `ODPT_ACCESS_TOKEN` must be set in `pipeline/.env.pipeline.local`

## Step-by-step Procedure

### 1. Gather resource information from CKAN

Fetch the CKAN resource page (user provides the URL or dataset name) and extract:

- **Resource ID** (UUID)
- **Download URL** (including `?date=YYYYMMDD` if applicable)
- **License** (e.g. CC BY 4.0, 公共交通オープンデータ基本ライセンス)
- **Provider name** (Japanese and English)
- **Data format** (GTFS or GTFS-JP)
- **Whether authentication is required** (ODPT API requires `acl:consumerKey`)

CKAN base URL: `https://ckan.odpt.org/dataset/`

### 2. Create resource definition

Create `pipeline/resources/gtfs/{source-name}.ts` following the `GtfsSourceDefinition` type.

Reference file for the type: `pipeline/types/gtfs-resource.ts`

Key fields to set:

- `nameEn`, `nameJa` — operator display names
- `license` — verify from CKAN page, never guess (see `data-licensing` skill)
- `dataFormat` — `{ type: 'GTFS/GTFS-JP' }` for Japanese transit data
- `routeTypes` — `['bus']`, `['rail']`, etc.
- `downloadUrl` — full URL. For ODPT sources, omit the `acl:consumerKey` param (added at runtime)
- `catalog` — `{ type: 'odpt', resourceId: '...', url: '...' }`
- `provider` — `{ nameJa, nameEn, url }`
- `authentication` — set if ODPT API key is required
- `pipeline.outDir` — directory name under `pipeline/data/gtfs/` (same as source-name)
- `pipeline.prefix` — short prefix for stop/route IDs (e.g. `tobus`, `ktbus`, `kobus`)

Do NOT set `routeColorFallbacks` yet — check the data first (step 5).

Example: `pipeline/resources/gtfs/kanto-bus.ts`

### 3. Add to pipeline target lists

Add the source-name to all three target list files:

| File                                | Purpose           |
| ----------------------------------- | ----------------- |
| `pipeline/targets/download-gtfs.ts` | GTFS ZIP download |
| `pipeline/targets/build-db.ts`      | CSV to SQLite     |
| `pipeline/targets/build-json.ts`    | DB to app JSON    |

Each file exports a string array. Entries can be commented out to temporarily skip a source during batch runs — this is useful for debugging or when a source is temporarily unavailable.

### 4. Add to web app data-source-settings

Add an entry to `src/config/data-source-settings.ts`. This registers the source in the web app so the frontend knows to load and display its data. Users can toggle individual sources on/off in the app's settings UI, so each source needs its own entry here.

```typescript
{
  id: '{source-name}',
  name_ja: '{日本語名}',
  category: 'bus', // or 'train'
  prefixes: ['{prefix}'],
},
```

### 5. Run the pipeline and check data quality

Run the full pipeline for the new source:

```bash
npm run pipeline:download:gtfs -- {source-name}
npm run pipeline:build:db -- {source-name}
npm run pipeline:build:json -- {source-name}
npm run data:sync
```

After JSON generation, check the following:

#### route_color

Check if `routes.txt` has `route_color` set. ODPT-sourced bus data often has empty or problematic values (e.g. `000000`/`000000` for both color and text_color).

If route_color is missing or unusable, add `routeColorFallbacks` to the resource definition:

```typescript
routeColorFallbacks: {
  '*': 'HEXCOLOR', // Wildcard fallback for all routes
},
```

The `'*'` key applies to all routes without a valid color. Per-route overrides use the route_id as key. After adding fallbacks, re-run `pipeline:build:json` and `data:sync`.

Ask the user for the operator's corporate/brand color if not obvious.

#### shapes.txt

Check if the GTFS ZIP contains `shapes.txt`. ODPT-sourced bus data often does not include it. Note this in `pipeline/resources/NOTES.md` but there is no workaround for bus routes (train routes can use MLIT GeoJSON).

#### translations.txt

Check if translations are available and note any quality issues (e.g. full-width spaces).

### 6. Verify build

```bash
npm run typecheck && npm run format && npm run lint:fix && npm run build
```

### 7. Update ABOUT.md credits

Use the `data-licensing` skill to add proper license credits:

- Add the operator to the `対応データ` list
- Add or update the appropriate license/credit section
- For ODPT Basic License sources, add to the existing ODPT section (shared disclaimer)
- For CC BY 4.0 sources, follow the ODPT FAQ credit format

### 8. Update NOTES.md

Add resource-specific notes to `pipeline/resources/NOTES.md`:

- Resource definition path
- CKAN URL and resource ID
- Data quality observations (route_color, shapes, translations)
- Any version/date-specific information

Keep factual and neutral — this is in a public repository.

### 9. Commit

Split into logical commits following Conventional Commits:

1. `feat(pipeline): add {operator} data source` — resource definition + targets + data-source-settings
2. `data: add {operator} app data` — generated JSON files in `public/data/`
3. `docs: add {operator} to ABOUT.md credits` — license/credit updates

## Naming Conventions

| Item               | Pattern                        | Examples                            |
| ------------------ | ------------------------------ | ----------------------------------- |
| Source name (file) | `{operator}-{type}` kebab-case | `kanto-bus`, `toei-train`           |
| Prefix             | 2-5 char abbreviation          | `tobus`, `ktbus`, `kobus`, `toaran` |
| outDir             | Same as source name            | `kanto-bus`, `keio-bus`             |

## Common Pitfalls

- **CKAN date/resourceId coupling**: ODPT CKAN has separate resources per date version. The `downloadUrl` date param and `catalog.resourceId` must match the same version.
- **Authentication**: ODPT API sources need `acl:consumerKey`. Use `npm run` scripts (not `npx` directly) to pick up the env file.
- **route_color black-on-black**: Some sources set both `route_color` and `route_text_color` to `000000`. The build script treats this as "unset" and applies fallbacks.
