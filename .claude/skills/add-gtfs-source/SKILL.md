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

Create `pipeline/config/resources/gtfs/{source-name}.ts` following the `GtfsSourceDefinition` type.

Reference file for the type: `pipeline/src/types/gtfs-resource.ts`

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

Example: `pipeline/config/resources/gtfs/kanto-bus.ts`

### 2.5. STOP — confirm resource definition with user before proceeding

**This is a hard gate.** The next steps (target list registration, web app config, pipeline run, agency-attributes key) all depend on values defined here. Changing any of them later means redoing every subsequent step. Do not proceed past this point until the user has explicitly approved the resource definition.

**Lock-in values** — once any of these is used downstream, changing it forces a full redo:

| Field                  | Used by                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `pipeline.prefix`      | All `*-insights.ts` / `validate.ts` target lists, `data-source-settings.ts`, `agency-attributes.ts` keys, output paths under `_build/data-v2/{prefix}/` |
| `pipeline.outDir`      | Workspace dirs under `pipeline/workspace/data/gtfs/{outDir}/` and archives                    |
| Source-name (filename) | All `download-gtfs.ts` / `build-db.ts` / `build-json.ts` / `build-shapes-*.ts` target lists   |
| `nameEn` / `nameJa`    | `pipeline:describe` output, web app display                                                   |
| `provider.name.*`      | Web app display (long/short, multilingual)                                                    |
| `provider.colors`      | App-side brand colors; copy must match `agency-attributes.ts` colors                          |
| `routeTypes`           | `data-source-settings.ts` `routeTypes` mapping (must match)                                   |

**How to confirm.** After writing the file, present a short summary of the lock-in values to the user (use `AskUserQuestion` or a plain bullet list) and wait for explicit approval. Do NOT run the pipeline, do NOT touch target lists, do NOT touch `data-source-settings.ts` until the user says OK. If the user changes any value, edit the resource definition first, present the updated summary again, and re-confirm.

### 3. Add to pipeline target lists

The CI workflow runs each pipeline stage against its own target list, and missing any entry will cause CI failure even if the local single-source run succeeds. Register the source in **every** applicable list:

| File                                               | Key         | Purpose                        | Always                            |
| -------------------------------------------------- | ----------- | ------------------------------ | --------------------------------- |
| `pipeline/config/targets/download-gtfs.ts`         | source-name | GTFS ZIP download              | yes                               |
| `pipeline/config/targets/build-db.ts`              | source-name | CSV to SQLite                  | yes                               |
| `pipeline/config/targets/build-json.ts`            | source-name | DB to app JSON (data.json)     | yes                               |
| `pipeline/config/targets/build-insights.ts`        | **prefix**  | DataBundle to InsightsBundle   | yes                               |
| `pipeline/config/targets/build-global-insights.ts` | **prefix**  | Cross-source spatial metrics   | yes                               |
| `pipeline/config/targets/validate.ts`              | **prefix**  | v2 bundle validation           | yes                               |
| `pipeline/config/targets/build-shapes-gtfs.ts`     | source-name | Route shapes from `shapes.txt` | only if `shapes.txt` is present   |
| `pipeline/config/targets/build-shapes-ksj.ts`      | source-name | Route shapes from MLIT KSJ     | only if `mlitShapeMapping` is set |

Each file exports a string array. **Watch the key column carefully** — `download-gtfs.ts` / `build-db.ts` / `build-json.ts` / `build-shapes-*.ts` use the source-name (filename), while `build-insights.ts` / `build-global-insights.ts` / `validate.ts` use the prefix. Mixing them up silently skips the source in CI.

Entries can be commented out to temporarily skip a source during batch runs — this is useful for debugging or when a source is temporarily unavailable.

Note: `pipeline/scripts/dev/describe-resources.ts` auto-discovers all resource definitions in `pipeline/config/resources/gtfs/`, so no manual registration is needed there.

### 4. Add to web app data-source-settings

Add an entry to `src/config/data-source-settings.ts`. This registers the source in the web app so the frontend knows to load and display its data. Users can toggle individual sources on/off in the app's settings UI, so each source needs its own entry here.

The actual schema is `SourceGroup` (see `src/types/app/source-group.ts`). The `routeTypes` array uses GTFS numeric route_type values (0=tram, 1=subway, 2=rail, 3=bus, 4=ferry, 12=monorail) and may contain multiple values for sources covering more than one mode.

```typescript
{
  id: '{source-name}',
  prefixes: ['{prefix}'],
  routeTypes: [3], // numeric GTFS route_type values
  enabled: true,
  name: { name: 'Display Name', names: { ja: '日本語名', en: 'English Name' } },
  countries: ['JP'],
},
```

### 4b. Add agency display attributes (App side)

Add per-agency entries to `src/config/agency-attributes.ts`. The pipeline outputs only data-source agency fields (canonical name from GTFS `agency_name`). Display names (long/short, multilingual) and brand colors are merged in on the App side at load time.

Key by prefixed `agency_id` (e.g. `sbbus:6013301006270`):

```typescript
'{prefix}:{agency_id}': {
  longName: { ja: '...', en: '...' },
  shortName: { ja: '...', en: '...' },
  colors: [{ bg: 'HEX', text: 'HEX' }],
},
```

Register every agency that appears in the pipeline output (one entry per `agency_id`). If no entry is provided, the UI falls back to the canonical `agency_name` and has no brand colors.

### 5. Run the pipeline and check data quality

Run each stage for the new source. Note that some scripts take **source-name** while others take **prefix** — see step 3.

```bash
# 5.1 Download / build / extract for this source only (source-name)
npx tsx --env-file-if-exists=pipeline/.env.pipeline.local pipeline/scripts/pipeline/download-gtfs.ts {source-name}
npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts {source-name}
npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts {source-name}

# 5.2 Per-source insights (prefix)
npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts {prefix}

# 5.3 Cross-source insights — must rerun across the full target list
npm run pipeline:build:v2-global-insights

# 5.4 Sync to public/ and validate
npm run data:sync
npm run pipeline:validate:v2
```

`pipeline:validate:v2` is the same check CI runs. **Do not skip it locally** — it catches missing target-list registrations (e.g. a forgotten `build-insights.ts` entry) before they break CI. Treat any `❌ MISSING (required)` line as a blocker.

After JSON generation, check the following:

#### route_color

Check if `routes.txt` has `route_color` set. ODPT-sourced bus data often has empty or problematic values (e.g. `000000`/`000000` for both color and text_color).

If route_color is missing or unusable, add `routeColorFallbacks` to the resource definition:

```typescript
routeColorFallbacks: {
  '*': 'HEXCOLOR', // Wildcard fallback for all routes
},
```

The `'*'` key applies to all routes without a valid color. Per-route overrides use the route_id as key. After adding fallbacks, re-run the build and data:sync:

```bash
npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts {source-name}
npm run data:sync
```

Ask the user for the operator's corporate/brand color if not obvious.

#### shapes.txt

Check if the GTFS ZIP contains `shapes.txt`. ODPT-sourced bus data often does not include it. Note this in `pipeline/config/resources/NOTES.md` but there is no workaround for bus routes (train routes can use MLIT GeoJSON).

If shapes.txt exists, add the source to `pipeline/config/targets/build-shapes-gtfs.ts` and run:

```bash
npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts {source-name}
npm run data:sync
```

#### translations.txt

Check if translations are available and note any quality issues (e.g. full-width spaces).

Verify the new source appears in the resource listing:

```bash
npm run pipeline:describe
```

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

Add resource-specific notes to `pipeline/config/resources/NOTES.md`:

- Resource definition path
- CKAN URL and resource ID
- Data quality observations (route_color, shapes, translations)
- Any version/date-specific information

Keep factual and neutral — this is in a public repository.

### 9. Commit

Split into logical commits following Conventional Commits. **Do not commit generated app data** (`public/next-dev/{prefix}/*.json`) — the `Update Transit Data` GitHub Action regenerates and pushes those after merge:

1. `feat(pipeline): add {operator} data source` — resource definition + every applicable target list + `data-source-settings.ts` + `agency-attributes.ts`
2. `docs: add {operator} credits and notes` — `ABOUT.md` license/credit updates + `pipeline/config/resources/NOTES.md` data-quality notes

## Naming Conventions

| Item               | Pattern                        | Examples                            |
| ------------------ | ------------------------------ | ----------------------------------- |
| Source name (file) | `{operator}-{type}` kebab-case | `kanto-bus`, `toei-train`           |
| Prefix             | 2-5 char abbreviation          | `tobus`, `ktbus`, `kobus`, `toaran` |
| outDir             | Same as source name            | `kanto-bus`, `keio-bus`             |

## Common Pitfalls

- **Skipping the Step 2.5 confirmation gate**: Picking a `prefix` / `outDir` / source-name without user approval, then registering target lists and running the pipeline, will cost you everything if the user wants a different value. Wait at the gate.
- **CKAN date/resourceId coupling**: ODPT CKAN has separate resources per date version. The `downloadUrl` date param and `catalog.resourceId` must match the same version.
- **Authentication**: ODPT API sources need `acl:consumerKey`. Use `npm run` scripts (not `npx` directly) to pick up the env file.
- **route_color black-on-black**: Some sources set both `route_color` and `route_text_color` to `000000`. The build script treats this as "unset" and applies fallbacks.
- **source-name vs prefix in target lists**: Half the target files use the source-name (e.g. `tokyometro`) and half use the prefix (e.g. `tome`). Forgetting either side passes local single-source runs but fails CI's batch validation with `❌ MISSING (required)`. Always run `npm run pipeline:validate:v2` locally before pushing.
- **Workspace state files**: `pipeline/workspace/state/download-meta/*.json` is generated by the download step and must not be committed.
