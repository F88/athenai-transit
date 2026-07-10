# Add GTFS Source

End-to-end procedure for adding a new GTFS/GTFS-JP data source. This covers everything from catalog research to a verified, committed web app integration.

## Prerequisites

- The data source must be available as a GTFS or GTFS-JP ZIP file (ODPT/CKAN, or a direct municipal/operator URL).
- If authentication is required, `ODPT_ACCESS_TOKEN` must be set in `pipeline/.env.pipeline.local`.
- `curl`, `unzip`, and `sqlite3` are used for the recon / inspection steps.

## Ordering principle

Almost every value in the resource definition — and several go/no-go decisions — depends on facts that are only knowable once you see the actual data: the **format** (plain GTFS vs GTFS-JP), the `agency_id` (the `agency-attributes.ts` key), whether `route_color` is usable (decides `routeColorFallbacks`), whether `shapes.txt` exists **and `trips.txt` actually references it** (decides the `build-shapes-gtfs` entry and whether shapes render at all), `translations.txt` coverage, and the feed's **validity period** (an already-expired feed may not be worth adding).

So **download and inspect the data first — before writing the resource definition** — using a throwaway temp directory. Knowing the facts up front lets you write a correct definition in one pass (right `dataFormat`, `routeColorFallbacks` already decided) and make a go/no-go call before investing any further. Then proceed:

1. Gather the download URL (CKAN or direct).
2. **Recon: download to a temp dir and inspect** the GTFS overview. Decide go/no-go.
3. Write the resource definition — now informed by the data — and lock in its identity values (with user approval).
4. Register `download-gtfs.ts` and **download** into the workspace.
5. Register `build-db.ts` and **build the SQLite DB**.
6. The remaining build stages — registering each target list right before running its stage — then the web app (`src`) config, then docs and commit.

Each target list is updated immediately before the stage that consumes it — never register a target list (or touch the `src`-side config) while the facts that decide it are still unknown.

## Step-by-step Procedure

### 1. Gather resource information

The user provides a CKAN dataset/resource URL, or a direct `.zip` URL (municipal / operator site). Identify:

- **Download URL** — the actual `.zip` URL (ODPT: `https://api(-public).odpt.org/api/v4/files/...zip?date=YYYYMMDD`; municipal: a direct site URL). NOT the CKAN resource _page_ URL.
- **Resource ID** (UUID) and CKAN organization / dataset URLs (for ODPT sources).
- **License** (e.g. CC BY 4.0, CC0, 公共交通オープンデータ基本ライセンス) — verify from the page, never guess (see `data-licensing` skill).
- **Provider name** — the CKAN organization name (ODPT) or the municipal publisher name, JA and EN.
- **Whether authentication is required** — ODPT API URLs need `acl:consumerKey`; `api-public.odpt.org` file URLs and municipal direct URLs are public.

CKAN base URL: `https://ckan.odpt.org/dataset/`

### 2. Recon — download to a temp dir and inspect (BEFORE writing the definition)

Download the ZIP to a throwaway directory and read the raw `*.txt`. No resource definition is needed yet — use `curl` directly. (For an auth-required ODPT file URL, append `&acl:consumerKey=$ODPT_ACCESS_TOKEN`, sourcing the value from `pipeline/.env.pipeline.local`.)

```bash
TMP=$(mktemp -d)
curl -fsSL "<download-url>" -o "$TMP/gtfs.zip"
unzip -oq "$TMP/gtfs.zip" -d "$TMP/gtfs"
ls -1 "$TMP/gtfs"                  # which files exist? *_jp.txt? shapes.txt? translations.txt?
head -3 "$TMP/gtfs/feed_info.txt"  # validity period (expired?), publisher, version
head -5 "$TMP/gtfs/agency.txt"     # agency_id + agency_name
head -5 "$TMP/gtfs/routes.txt"     # route_color / route_text_color usable?
head -1 "$TMP/gtfs/trips.txt"      # does the header include shape_id?
# ... then: rm -rf "$TMP"  (throwaway; the canonical download happens in step 4)
```

Record these facts — each one feeds a definition field or a later decision:

- **Data format** → presence of GTFS-JP extension files (`agency_jp.txt`, `office_jp.txt`, `routes_jp.txt`, `pattern_jp.txt`, etc.). If any `*_jp.txt` exist it is GTFS-JP (`dataFormat: { type: 'GTFS/GTFS-JP' }`); if not, it is plain GTFS (`dataFormat: { type: 'GTFS' }`). Do not assume — Japanese feeds are usually GTFS-JP but not always.
- **`feed_info.txt` validity** → `feed_start_date` / `feed_end_date`. **If `feed_end_date` is already in the past, the feed is expired** — surface this to the user as a go/no-go before proceeding; an expired feed yields empty timetables for current dates and a validate warning.
- **`agency.txt`** → the `agency_id`(s) and `agency_name`. `{prefix}:{agency_id}` becomes the `agency-attributes.ts` key (step 7). The agency may be the operator or the municipality.
- **`routes.txt`** → is `route_color` present and usable? Empty, or `000000`/`000000` for both color and text color (the build treats that as "unset"), means you will need `routeColorFallbacks` in the definition. Ask the user for the brand color if not obvious.
- **`shapes.txt` + `trips.txt`** → shapes render only when `shapes.txt` exists **and** `trips.txt` has a populated `shape_id` column linking trips to shapes. `shapes.txt` present but no `shape_id` column in `trips.txt` ⇒ no shapes are emitted (still register the source in `build-shapes-gtfs.ts` so shapes auto-build if a future feed adds the linkage).
- **`translations.txt`** → present? language coverage; note quality issues (e.g. full-width spaces). Coverage varies even among feeds from the same data vendor.

Summarize the overview (format, agency_id, route count, route_color usability, shapes, translations, validity) and, if anything looks off (expired, no usable data), **confirm go/no-go with the user before writing the definition**.

### 3. Create resource definition

Now write `pipeline/config/resources/gtfs/{source-name}.ts` (type: `pipeline/src/types/gtfs-resource.ts`), filling the data-dependent fields from the recon. Key fields:

- `nameEn`, `nameJa` — service / brand display names (e.g. `B-guru`, `風ぐるま`). Brand names belong here, NOT in `provider.name`.
- `license` — from step 1 (CC BY 4.0 / CC0 / ODPT basic, etc.).
- `dataFormat` — `{ type: 'GTFS/GTFS-JP' }` or `{ type: 'GTFS' }`, per the recon (step 2).
- `routeTypes` — `['bus']`, `['rail']`, etc.
- `downloadUrl` — full `.zip` URL. For ODPT API sources, omit the `acl:consumerKey` param (added at runtime).
- `catalog` — ODPT: `{ type: 'odpt', organizationUrl, datasetUrl, resourceUrl, resourceId }`; municipal/operator direct: `{ type: 'municipal', url }`.
- `provider.name` — the CKAN organization / municipal publisher name verbatim; by default set `short` equal to `long` (the service/brand name goes in `nameJa` / `nameEn`, not here). See the `Provider` TSDoc in `pipeline/src/types/resource-common.ts`.
- `provider.url` — optional.
- `provider.colors` — required array (≥1); the operator/service brand color (ask the user).
- `authentication` — `{ required: true, ... }` only for ODPT API URLs; api-public / municipal direct URLs are `{ required: false }`.
- `routeColorFallbacks` — **set this now if the recon (step 2) found `route_color` unusable** (e.g. `{ '*': 'HEXCOLOR' }` with the brand color, or per-route keys). Omit when source colors are usable.
- `pipeline.outDir` — same as source-name.
- `pipeline.prefix` — short namespace for stop/route IDs. **Alphanumeric, no hyphens** (e.g. `tobus`, `ktbus`, `kazag`, `bgle`).

Examples: `pipeline/config/resources/gtfs/chiyoda-bus.ts` (ODPT), `pipeline/config/resources/gtfs/hachiko-bus.ts` (municipal direct).

### 3.5. STOP — confirm resource definition with user before proceeding

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

### 4. Register `download-gtfs.ts` and download

Add the **source-name** to `pipeline/config/targets/download-gtfs.ts`, then download:

```bash
npx tsx --env-file-if-exists=pipeline/.env.pipeline.local pipeline/scripts/pipeline/download-gtfs.ts {source-name}
```

This is the canonical download (archived, with download metadata); it extracts the GTFS `*.txt` files into `pipeline/workspace/data/gtfs/{outDir}/`. (The step 2 recon copy was a throwaway; this one is what the pipeline uses.)

### 5. Register `build-db.ts` and build the SQLite DB

Add the **source-name** to `pipeline/config/targets/build-db.ts`, then build:

```bash
npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts --targets pipeline/config/targets/build-db.ts {source-name}
```

This produces `pipeline/workspace/_build/db/{source-name}.db`. The step 2 recon already established the overview; query this DB with `sqlite3` if you need exact values while finalizing details (e.g. precise per-route `route_color`, trip/stop counts, orphan stops):

```bash
sqlite3 -header pipeline/workspace/_build/db/{source-name}.db "SELECT agency_id, agency_name FROM agency;"
sqlite3 -header pipeline/workspace/_build/db/{source-name}.db "SELECT route_id, route_short_name, route_color, route_text_color FROM routes;"
```

### 6. Build the remaining stages

Register each target list immediately before running its stage. Note which scripts take **source-name** vs **prefix**.

```bash
# 6.1 App JSON (register build-json.ts with source-name, then build)
npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts {source-name}

# 6.2 Route shapes — register build-shapes-gtfs.ts with source-name when shapes.txt exists
#     (see step 2). If trips lack shape_id no shapes are emitted, but keep it
#     registered so a future feed with the linkage auto-builds.
npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts {source-name}

# 6.3 Per-source insights (register build-insights.ts with PREFIX, then build)
npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts {prefix}

# 6.4 Cross-source insights (register build-global-insights.ts with PREFIX, then run full list)
npm run pipeline:build:v2-global-insights

# 6.5 Data source catalog (register build-data-source-catalog.ts with PREFIX, then run full list)
npm run pipeline:build:v2-data-source-catalog

# 6.6 Validate (register validate.ts with PREFIX) and sync
npm run pipeline:validate:v2
npm run data:deliver:local
```

Target-list key reminder: `build-json.ts` / `build-shapes-gtfs.ts` use the **source-name**; `build-insights.ts` / `build-global-insights.ts` / `build-data-source-catalog.ts` / `validate.ts` use the **prefix**. Mixing them up silently skips the source in CI.

`pipeline:validate:v2` is the same check CI runs. **Do not skip it locally** — it catches missing target-list registrations before they break CI. Treat any `❌ MISSING (required)` line as a blocker. (An expired feed surfaces here as a `Calendar has expired services` warning — expected if step 2 already flagged the expiry.)

`data:deliver:local` copies `pipeline/workspace/_build/data-v2/` to `public/<PIPELINE_TRANSIT_DATA_DIR>/`, defaulting to `public/data-v2/`. The destination is configurable, so when `PIPELINE_TRANSIT_DATA_DIR` is overridden in the environment, `public/data-v2/` is **not** the directory that gets updated — check the effective value if the app still shows stale data. See the `gtfs-data-build` skill for the full data flow.

If, after seeing the built colors, you need to adjust `routeColorFallbacks`, edit the resource definition and re-run `build-from-gtfs.ts {source-name}` + `npm run data:deliver:local`.

Verify the new source appears in the resource listing:

```bash
npm run pipeline:describe
```

### 7. Add web app config (after the pipeline side is done)

With the pipeline output built and the `agency_id` known (step 2 / step 5), register the source on the `src` side. These display strings are user-facing decisions — confirm them with the user rather than inventing names/colors.

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

Add per-agency entries to `src/config/agency-attributes.ts`, keyed by the prefixed `agency_id` (e.g. `bgle:6011801011369`). The pipeline outputs only the canonical `agency_name`; display names (long/short, multilingual) and brand colors are merged in App-side at load time. `shortName` is the service/brand name; `longName` is the operator.

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
- CC0 sources do not require attribution, but a credit may still be listed

### 10. Update NOTES.md

Add resource-specific notes to `pipeline/config/resources/NOTES.md`:

- Resource definition path
- CKAN / source URL and resource ID
- Data quality observations (route_color, shapes/trip-linkage, translations, calendar, validity)
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

- **Writing the definition before the recon**: deciding `dataFormat`, `routeColorFallbacks`, or even whether to add the source at all without seeing the data leads to wrong values and wasted work. Download to a temp dir and inspect first (step 2), then write the definition (step 3).
- **Adding an expired feed unnoticed**: check `feed_info.feed_end_date` in the recon. A past end_date means empty current-date timetables — raise it as a go/no-go before investing.
- **`shapes.txt` present but `trips` lack `shape_id`**: shapes are linked to routes only via `trips.shape_id`; a feed can ship `shapes.txt` geometry with no `shape_id` column, so no shapes are emitted. Keep the source registered in `build-shapes-gtfs.ts` for future auto-generation.
- **Running later steps out of order**: never register a target list or touch `src`-side config while the facts that decide it are still unknown. Each target list is registered immediately before its stage.
- **Skipping the Step 3.5 confirmation gate**: picking a `prefix` / `outDir` / source-name without user approval, then running everything, will cost you everything if the user wants a different value. Wait at the gate.
- **Hyphen in prefix**: existing prefixes are alphanumeric with no hyphens. Keep new prefixes hyphen-free (the prefix is a `{prefix}:{id}` namespace and an output directory name).
- **CKAN date/resourceId coupling**: ODPT CKAN has separate resources per date version. The `downloadUrl` date param and `catalog.resourceId` must match the same version.
- **Authentication**: ODPT API sources need `acl:consumerKey`; `api-public.odpt.org` file URLs and municipal direct URLs are public. Use `npm run` scripts (not `npx` directly) to pick up the env file when a key is needed.
- **route_color black-on-black**: some sources set both `route_color` and `route_text_color` to `000000`. The build treats this as "unset" and applies fallbacks.
- **source-name vs prefix in target lists**: `download-gtfs.ts` / `build-db.ts` / `build-json.ts` / `build-shapes-*.ts` use the source-name (filename); `build-insights.ts` / `build-global-insights.ts` / `build-data-source-catalog.ts` / `validate.ts` use the prefix. Forgetting either side passes local single-source runs but fails CI's batch validation with `❌ MISSING (required)`. Always run `npm run pipeline:validate:v2` locally before pushing.
- **provider.name vs brand**: `provider.name` is the CKAN organization / publisher name (short defaults to long); the service/brand name goes in `nameJa` / `nameEn` and in `agency-attributes.ts` `shortName`.
- **Workspace state files**: `pipeline/workspace/state/download-meta/*.json` is generated by the download step and must not be committed.
