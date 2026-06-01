# Add GTFS Source

End-to-end procedure for adding a new GTFS/GTFS-JP data source. This covers everything from CKAN catalog research to a verified, committed web app integration.

## Prerequisites

- The data source must be available as a GTFS or GTFS-JP ZIP file
- If authentication is required, `ODPT_ACCESS_TOKEN` must be set in `pipeline/.env.pipeline.local`

## Ordering principle

Downstream steps depend on facts that are only known once the data is in hand: whether `shapes.txt` exists (decides the `build-shapes-gtfs` target entry), whether `route_color` is usable (decides `routeColorFallbacks`), and the `agency_id` (the `agency-attributes.ts` key). So do the minimum to get the data first, inspect it, then proceed:

1. Write the resource definition and lock in its identity values (with user approval).
2. Register `download-gtfs.ts` and **download** — extracts the `*.txt` files.
3. Register `build-db.ts` and **build the SQLite DB**.
4. **Inspect the data overview** — `*.txt` and the DB now exist, so `agency_id`, `route_color`, `shapes.txt`, and `translations.txt` are all observable here.
5. Only then do the subsequent work: the remaining build stages (registering each target list right before running its stage), then the web app (`src`) config, then docs and commit.

Each target list is updated immediately before the stage that consumes it — never register a target list (or touch the `src`-side config) while the facts that decide it are still unknown.

## Step-by-step Procedure

### 1. Gather resource information from CKAN

Fetch the CKAN resource page (user provides the URL or dataset name) and extract:

- **Resource ID** (UUID)
- **Download URL** (the actual `.zip` file URL — usually `https://api(-public).odpt.org/api/v4/files/...zip?date=YYYYMMDD`, not the CKAN resource page URL)
- **License** (e.g. CC BY 4.0, 公共交通オープンデータ基本ライセンス)
- **Provider name** (the CKAN organization name, Japanese and English)
- **Data format** (GTFS or GTFS-JP)
- **Whether authentication is required** (ODPT API requires `acl:consumerKey`; `api-public.odpt.org` file URLs are public)

CKAN base URL: `https://ckan.odpt.org/dataset/`

### 2. Create resource definition

Create `pipeline/config/resources/gtfs/{source-name}.ts` following the `GtfsSourceDefinition` type.

Reference file for the type: `pipeline/src/types/gtfs-resource.ts`

Key fields to set:

- `nameEn`, `nameJa` — service / brand display names (e.g. `B-guru`, `風ぐるま`). Brand names belong here, NOT in `provider.name`.
- `license` — verify from CKAN page, never guess (see `data-licensing` skill)
- `dataFormat` — `{ type: 'GTFS/GTFS-JP' }` for Japanese transit data
- `routeTypes` — `['bus']`, `['rail']`, etc.
- `downloadUrl` — full `.zip` URL. For ODPT sources, omit the `acl:consumerKey` param (added at runtime)
- `catalog` — `{ type: 'odpt', organizationUrl, datasetUrl, resourceUrl, resourceId }`
- `provider.name` — use the CKAN **organization** name verbatim; by default set `short` equal to `long` (do not put the service/brand name here — that goes in `nameJa` / `nameEn`). See the `Provider` TSDoc in `pipeline/src/types/resource-common.ts`.
- `provider.url` — optional
- `provider.colors` — required array (may be `[]`); the operator/service brand color
- `authentication` — `{ required: true }` only if the ODPT API key is required (api-public file URLs are `required: false`)
- `pipeline.outDir` — directory name under `pipeline/workspace/data/gtfs/` (same as source-name)
- `pipeline.prefix` — short namespace for stop/route IDs. **Alphanumeric, no hyphens** (e.g. `tobus`, `ktbus`, `kobus`, `kazag`, `bgle`)

Do NOT set `routeColorFallbacks` yet — decide that after inspecting the data (step 4).

Example: `pipeline/config/resources/gtfs/chiyoda-bus.ts`

### 2.5. STOP — confirm resource definition with user before proceeding

**This is a hard gate.** Every subsequent step depends on values defined here. Changing any of them later means redoing the dependent steps. Do not proceed until the user has explicitly approved the resource definition.

**Lock-in values** — once any of these is used downstream, changing it forces a redo:

| Field                  | Used by                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipeline.prefix`      | All `*-insights.ts` / `validate.ts` / `build-data-source-catalog.ts` target lists, `data-source-settings.ts`, `agency-attributes.ts` keys, output paths under `_build/data-v2/{prefix}/` |
| `pipeline.outDir`      | Workspace dirs under `pipeline/workspace/data/gtfs/{outDir}/` and archives                                                                                                               |
| Source-name (filename) | All `download-gtfs.ts` / `build-db.ts` / `build-json.ts` / `build-shapes-*.ts` target lists                                                                                              |
| `nameEn` / `nameJa`    | `pipeline:describe` output, web app display                                                                                                                                              |
| `provider.name.*`      | Web app display (long/short, multilingual)                                                                                                                                               |
| `provider.colors`      | App-side brand colors; copy must match `agency-attributes.ts` colors                                                                                                                     |
| `routeTypes`           | `data-source-settings.ts` `routeTypes` mapping (must match)                                                                                                                              |

**How to confirm.** After writing the file, present a short summary of the lock-in values to the user (use `AskUserQuestion` or a plain bullet list) and wait for explicit approval. If the user changes any value, edit the resource definition first, present the updated summary again, and re-confirm.

### 3. Register `download-gtfs.ts` and download

Add the **source-name** to `pipeline/config/targets/download-gtfs.ts`, then download:

```bash
npx tsx --env-file-if-exists=pipeline/.env.pipeline.local pipeline/scripts/pipeline/download-gtfs.ts {source-name}
```

This extracts the GTFS `*.txt` files into `pipeline/workspace/data/gtfs/{outDir}/`.

### 4. Register `build-db.ts` and build the SQLite DB

Add the **source-name** to `pipeline/config/targets/build-db.ts`, then build:

```bash
npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts --targets pipeline/config/targets/build-db.ts {source-name}
```

This produces `pipeline/workspace/_build/db/{source-name}.db`.

### 5. Inspect the data overview

The `*.txt` files and the DB now exist, so the data-dependent facts can be observed. Inspect and record:

- **`agency.txt` / `agency` table** — the `agency_id`(s) and `agency_name`. The `agency_id` is the `agency-attributes.ts` key (`{prefix}:{agency_id}`), needed in step 7.
- **`shapes.txt`** — present or not? Decides the `build-shapes-gtfs.ts` entry and whether shapes are built (step 6). ODPT-sourced bus data often omits it.
- **`routes.txt` / `routes` table** — is `route_color` present and usable? ODPT bus data often has empty values, or `000000`/`000000` for both color and text color (the build treats that as "unset"). If unusable, plan a `routeColorFallbacks` entry (step 6). Ask the user for the operator's brand color if not obvious.
- **`translations.txt`** — present? Note quality issues (e.g. full-width spaces).

```bash
ls pipeline/workspace/data/gtfs/{outDir}/
sqlite3 pipeline/workspace/_build/db/{source-name}.db "SELECT agency_id, agency_name FROM agency;"
sqlite3 -header pipeline/workspace/_build/db/{source-name}.db "SELECT route_id, route_short_name, route_color, route_text_color FROM routes;"
```

Summarize the overview (route count, agency_id, shapes/colors/translations status) before moving on.

### 6. Build the remaining stages

Register each target list immediately before running its stage. Note which scripts take **source-name** vs **prefix**.

```bash
# 6.1 App JSON (register build-json.ts with source-name, then build)
npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts {source-name}

# 6.2 Route shapes — ONLY if shapes.txt is present (step 5).
#     Register build-shapes-gtfs.ts with source-name, then build.
npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts {source-name}

# 6.3 Per-source insights (register build-insights.ts with PREFIX, then build)
npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts {prefix}

# 6.4 Cross-source insights (register build-global-insights.ts with PREFIX, then run full list)
npm run pipeline:build:v2-global-insights

# 6.5 Data source catalog (register build-data-source-catalog.ts with PREFIX, then run full list)
npm run pipeline:build:v2-data-source-catalog

# 6.6 Validate (register validate.ts with PREFIX) and sync
npm run pipeline:validate:v2
npm run data:sync
```

Target-list key reminder: `build-json.ts` / `build-shapes-gtfs.ts` use the **source-name**; `build-insights.ts` / `build-global-insights.ts` / `build-data-source-catalog.ts` / `validate.ts` use the **prefix**. Mixing them up silently skips the source in CI.

`pipeline:validate:v2` is the same check CI runs. **Do not skip it locally** — it catches missing target-list registrations before they break CI. Treat any `❌ MISSING (required)` line as a blocker.

`data:sync` copies `pipeline/workspace/_build/data-v2/` to `public/<PIPELINE_TRANSIT_DATA_DIR>/`, defaulting to `public/data-v2/`. The destination is configurable, so when `PIPELINE_TRANSIT_DATA_DIR` is overridden in the environment, `public/data-v2/` is **not** the directory that gets updated — check the effective value if the app still shows stale data. See the `gtfs-data-build` skill for the full data flow.

**route_color fallback (if step 5 found unusable colors).** Add `routeColorFallbacks` to the resource definition:

```typescript
routeColorFallbacks: {
  '*': 'HEXCOLOR', // Wildcard fallback for all routes
},
```

The `'*'` key applies to all routes without a valid color; per-route overrides use the route_id as key. After adding fallbacks, re-run `build-from-gtfs.ts {source-name}` and `npm run data:sync`.

Verify the new source appears in the resource listing:

```bash
npm run pipeline:describe
```

### 7. Add web app config (after the pipeline side is done)

With the pipeline output built and the `agency_id` known, register the source on the `src` side.

#### 7a. data-source-settings

Add a `SourceGroup` entry to `src/config/data-source-settings.ts` (schema: `src/types/app/source-group.ts`). `routeTypes` uses GTFS numeric route_type values (0=tram, 1=subway, 2=rail, 3=bus, 4=ferry, 12=monorail).

```typescript
{
  id: '{source-name}',
  prefixes: ['{prefix}'],
  routeTypes: [3],
  systemEnabledByDefault: true,
  userEnabledByDefault: true,
  name: {
    name: 'Brand Name',
    names: { ja: 'ブランド名 (区市名)', en: 'Brand Name (City)' },
  },
  countries: ['JP'],
},
```

#### 7b. agency display attributes

Add per-agency entries to `src/config/agency-attributes.ts`, keyed by the prefixed `agency_id` from step 5 (e.g. `bgle:6011801011369`). The pipeline outputs only the canonical `agency_name`; display names (long/short, multilingual) and brand colors are merged in App-side at load time. `shortName` is the service/brand name; `longName` is the operator.

```typescript
'{prefix}:{agency_id}': {
  shortName: { ja: '...', en: '...' },
  longName: { ja: '...', en: '...' },
  colors: [{ bg: 'HEX', text: 'HEX' }],
},
```

Register every agency that appears in the pipeline output. If no entry is provided, the UI falls back to the canonical `agency_name` and has no brand colors. The `colors` must match `provider.colors` in the resource definition.

### 8. Verify build

```bash
npm run typecheck && npm run format && npm run lint:fix && npm run build
```

### 9. Update ABOUT.md credits

Use the `data-licensing` skill to add proper license credits:

- Add the operator to the `対応データ` list
- Add or update the appropriate license/credit section
- For ODPT Basic License sources, add to the existing ODPT section (shared disclaimer)
- For CC BY 4.0 sources, follow the ODPT FAQ credit format

### 10. Update NOTES.md

Add resource-specific notes to `pipeline/config/resources/NOTES.md`:

- Resource definition path
- CKAN URL and resource ID
- Data quality observations (route_color, shapes, translations)
- Any version/date-specific information

Keep factual and neutral — this is in a public repository.

### 11. Commit

Split into logical commits following Conventional Commits. **Do not commit generated app data** (`public/<PIPELINE_TRANSIT_DATA_DIR>/{prefix}/*.json`, default `public/data-v2/{prefix}/*.json`) — the `Update Transit Data` GitHub Action regenerates and pushes those after merge:

1. `feat(pipeline): add {operator} data source` — resource definition + every applicable target list + `data-source-settings.ts` + `agency-attributes.ts`
2. `docs: add {operator} credits and notes` — `ABOUT.md` license/credit updates + `pipeline/config/resources/NOTES.md` data-quality notes

## Naming Conventions

| Item               | Pattern                                          | Examples                            |
| ------------------ | ------------------------------------------------ | ----------------------------------- |
| Source name (file) | `{operator}-{type}` kebab-case                   | `kanto-bus`, `toei-train`           |
| Prefix             | 2-5 char abbreviation, alphanumeric (no hyphens) | `tobus`, `ktbus`, `kobus`, `toaran` |
| outDir             | Same as source name                              | `kanto-bus`, `keio-bus`             |

## Common Pitfalls

- **Running steps out of order**: registering target lists or `src`-side config before downloading, building the DB, and inspecting the data means guessing at `shapes.txt` presence, `route_color` usability, and `agency_id`. Download + build-db + inspect first (steps 3-5).
- **Skipping the Step 2.5 confirmation gate**: picking a `prefix` / `outDir` / source-name without user approval, then running everything, will cost you everything if the user wants a different value. Wait at the gate.
- **Hyphen in prefix**: existing prefixes are alphanumeric with no hyphens. Keep new prefixes hyphen-free (the prefix is a `{prefix}:{id}` namespace and an output directory name).
- **CKAN date/resourceId coupling**: ODPT CKAN has separate resources per date version. The `downloadUrl` date param and `catalog.resourceId` must match the same version.
- **Authentication**: ODPT API sources need `acl:consumerKey`; `api-public.odpt.org` file URLs are public. Use `npm run` scripts (not `npx` directly) to pick up the env file when a key is needed.
- **route_color black-on-black**: some sources set both `route_color` and `route_text_color` to `000000`. The build treats this as "unset" and applies fallbacks.
- **source-name vs prefix in target lists**: `download-gtfs.ts` / `build-db.ts` / `build-json.ts` / `build-shapes-*.ts` use the source-name (filename); `build-insights.ts` / `build-global-insights.ts` / `build-data-source-catalog.ts` / `validate.ts` use the prefix. Forgetting either side passes local single-source runs but fails CI's batch validation with `❌ MISSING (required)`. Always run `npm run pipeline:validate:v2` locally before pushing.
- **provider.name vs brand**: `provider.name` is the CKAN organization name (short defaults to long); the service/brand name goes in `nameJa` / `nameEn` and in `agency-attributes.ts` `shortName`.
- **Workspace state files**: `pipeline/workspace/state/download-meta/*.json` is generated by the download step and must not be committed.
