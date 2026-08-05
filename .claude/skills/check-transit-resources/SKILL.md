---
name: check-transit-resources
description: >
    Triage the "Check Transit Resources" GitHub Action result and judge whether
    any GTFS resource definition needs updating. Primary trigger: the message
    contains a GitHub Actions run URL for this repo
    (github.com/F88/athenai-transit/actions/runs/<id>) — in ANY form: the URL alone,
    "check <url>", or a request sentence plus the URL (e.g. "更新が必要か見て <url>",
    "チェックして <url>"). Also triggers on "check transit resources", a
    check-transit-resources.yml workflow run, or asking whether adopted GTFS feeds
    are out of date. READ-ONLY triage: never edit definitions, never auto-update.
---

# Check Transit Resources (update triage)

Read the result of the `.github/workflows/check-transit-resources.yml` GitHub Action
and produce a **first-pass judgment** of which GTFS resource definitions may need a
version bump. This skill only **reports**. It does not change anything.

## Hard constraints (do not violate)

- **Judge from the GitHub Action output, not from local files.** The Action already
  resolved the ODPT Members Portal state and printed, per source, every remote sorted
  by `start_at` with the adopted one marked. Do not reconstruct that from
  `pipeline/workspace/state/**` or by parsing `downloadUrl` — read the run output.
- **Never auto-update a resource definition.** Do not edit any
  `pipeline/config/resources/**/*.ts`. Stop after presenting the triage.
- **The user reviews and decides on every new resource themselves.** Present the
  candidates; the user inspects the resource and decides whether to adopt. The decision
  to apply is the user's — not yours.

## Where the answer lives in the Action output

The Slack-extracted `[RESULT:*]` lines are a lossy summary — **do not judge from them
alone**, and do not trust their `INFO`/`KNOWN`/`[NEW]` tiers (the `[NEW]` marker only
means "absent from the previous snapshot"; a newer-than-adopted feed loses `[NEW]` after
one run). The authoritative data is the **full per-source block** in the run log / Job
Summary, printed by `printRemoteResources` (`pipeline/scripts/pipeline/lib/check-odpt-report.ts`):

```
=== kyoto-bus [CHECK] ===
  Remote:     59 resources, 9 currently valid (sorted by start_at desc)
    #1  date=20260617  start_at=2026-06-17  feed=2026-06-17 - 2026-09-30  in     uploaded=...
    #2  date=20260613  start_at=2026-06-13  feed=2026-06-07 - 2026-09-30  in     uploaded=... <-- LOCAL
    #3  date=20260607  start_at=2026-06-07  feed=2026-06-07 - 2026-06-12  after  uploaded=...
=== kyoto-bus [END] ===
```

Read it directly — and read the **whole** per-source block, not just the table:

- The `Remote:  N resources, M currently valid` header — **`M = 0` means nothing valid
  exists right now** (a critical signal, not "no update").
- `*** ... ***` lines are this source's warnings (e.g. `*** ADOPTED_EXPIRED`,
  `*** REMOTE_NO_VALID_DATA`).
- `Local feed: <from> - <to>` is the adopted feed's real validity window.
- Rows are sorted **`start_at` descending** (newest revision on top).
- **`<-- LOCAL`** marks the currently adopted resource (the reference point). Note its OWN
  status token — if LOCAL itself is `after`, the adopted feed is **expired**, even if it is
  row #1.
- The token before `uploaded=` is the **period status**: `in` (currently valid),
  `after` (expired), `before` (not started yet), plus `in-no-end` / `in-no-start` etc.
- Ignore `date=` for ordering — it is a display label, not the version order. The order is
  `start_at`, already applied for you.
- Some sources print only `Not available in Members Portal API` + a `Local:` / `Local feed:`
  line and **no remote table**. These are fetched from a fixed/latest URL (no `date=` param)
  and are **not version-tracked by this Action** — they are out of scope here, NOT critical.

## Procedure

### 1. Resolve the run and read the FULL log — mandatory

The trailing number of a pasted `.../actions/runs/<id>` URL is the run id. If none is given,
default to the latest run.

Keep the resolved run id — the triage must end by printing its run URL
(`https://github.com/F88/athenai-transit/actions/runs/<run-id>`), so the user can open the
job result directly. See step 3.

**Read the entire job output, top to bottom — every source block in full. This is required,
not optional.** Do NOT judge from a `grep`-ed subset, from the Slack `[RESULT:*]` summary, or
from the Job Summary alone. Critical facts live OUTSIDE the table rows — e.g.
`Not available in Members Portal API`, `*** ADOPTED_EXPIRED`, the `N resources, M currently
valid` header, `Local feed:` — and a filter will silently drop them and make you judge a part.

```bash
# only when no URL/id was given (--json ... url gives the run URL to report in step 3):
gh run list --workflow check-transit-resources.yml --repo F88/athenai-transit --limit 5 \
  --json databaseId,url,createdAt,conclusion

# fetch the WHOLE log, strip only the CI line prefix, and READ ALL OF IT:
gh run view <run-id> --repo F88/athenai-transit --log 2>&1 \
  | sed -E 's/^check-resources\tUNKNOWN STEP\t[0-9T:.Z+-]+ //' > /tmp/check-resources-run.txt
# then read /tmp/check-resources-run.txt in full (it is ~30-40KB; do not truncate it).
```

A `grep` is allowed only as a navigation index AFTER you have read the whole output — never as
the input to the judgment.

### 2. Judge each source from its block, relative to the `<-- LOCAL` row

Check the cases **in this order** (the first match wins):

| What you see in the block                                                                                                                              | Category                     | Note                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Not available in Members Portal API` (no remote table)                                                                                                | **OUT OF SCOPE**             | Fixed/latest-URL source, not version-tracked by this Action. NOT critical — exclude from update judgment; if it needs a refresh that is a separate workflow.                                 |
| `*** ADOPTED_EXPIRED` / `*** ADOPTED_MISSING` / `*** REMOTE_NO_VALID_DATA` (= `[RESULT:ERROR]`; LOCAL status `after`; header says `0 currently valid`) | **CRITICAL — cannot update** | Adopted feed dead AND no in-period replacement. Decide disable-vs-leave (expired-data UX shows an empty timetable). This is what fails CI (exit 1). Applies even when `<-- LOCAL` is row #1. |
| LOCAL status is `in`, AND a row **above** `<-- LOCAL` has status `in` (or `in-no-end`/`in-no-start`)                                                   | **UPDATE CANDIDATE**         | A newer revision is valid _now_. Larger `start_at` gap above LOCAL = higher priority.                                                                                                        |
| LOCAL status is `in`, AND a row **above** `<-- LOCAL` has status `before` (future `start_at`)                                                          | **UPCOMING**                 | A newer revision exists but has not started; adopt on/after its `start_at`, not now.                                                                                                         |
| LOCAL status is `in`, and every row above it is `after` (or LOCAL is row #1)                                                                           | **No action**                | Adopted is already the newest valid revision. Rows below it are older.                                                                                                                       |

Caveat: a candidate whose `feed=` window is very short (e.g. ~5 days — a temporary /
special-period feed) can _shrink_ coverage if adopted. Flag the window; do not treat it as
a routine bump.

Uncertain on a borderline source? Re-run the checker for just that source instead of
guessing: `npx tsx pipeline/scripts/pipeline/check-odpt-resources.ts <source>` (prints the
same block live).

### 3. Present the triage and hand the decision back

Output a table grouped by category (CRITICAL / UPDATE CANDIDATE / UPCOMING / No action),
each row showing the source, the adopted `start_at`, and the newer `start_at` + its `feed=`
window from the block. Then list the candidates and ask which (if any) the user wants to
adopt after reviewing the resource. **Do not edit any definition** — applying an approved
bump is a separate, user-initiated step (see "Applying an approved bump" below).

**End every triage with the run URL of the job you read** — always, whether the user pasted
it or you resolved the latest run yourself. Put it on the last line so it is easy to click:

```text
Source run: https://github.com/F88/athenai-transit/actions/runs/<run-id>
```

## Applying an approved bump (only after explicit per-source user approval)

Once the user names the sources and dates to adopt (e.g. "keio-bus -> date=20260724"):

1. **Update the three-field set** in `pipeline/config/resources/gtfs/{source}.ts`:
   the `date=` param of `downloadUrl`, `catalog.resourceUrl`, and `catalog.resourceId`.
   The CKAN resource UUID for the new date comes from the dataset page
   (`https://ckan.odpt.org/dataset/{dataset}` — the CKAN Action API returns HTML, so
   scrape the resource links; each title embeds the date, e.g. "京都バス-20260724").
   The `downloadUrl` date and `resourceId` must refer to the same version.
2. **Update `CHANGELOG.md`** under `[Unreleased]` / `### Changed`, one line per source
   in the established format: `- Data: {source} の GTFS resource を {date} 版へ更新。`
3. **Verify**: `npm run typecheck`.
4. **STOP and get explicit user confirmation before committing (RULE).** After editing
   the definition(s) + `CHANGELOG.md` and passing typecheck, show the exact diff and
   WAIT. Resource definition changes are ALWAYS committed only after the user explicitly
   approves *this* commit — naming the sources/dates to adopt (step 0) authorizes the
   *edit*, NOT the commit. The user may still add more sources or revise values before
   committing. Never run `git commit` on a resource bump without that explicit go-ahead.
   See [[feedback_resource_update_human_confirmation]].
5. **Branch -> commit -> PR. NEVER commit resource definition updates directly on main.**
   Cut a fresh branch off main named `chore/update-resources-YYYYMMDD` (today's date).
   Fixed rule (user decision, 2026-07-25): version bumps are ALWAYS `chore`, even when
   triggered by a CRITICAL / expired source. A second bump branch on the same day gets
   a serial suffix (`chore/update-resources-YYYYMMDD-2`). The name deliberately has no
   "gtfs" in it — resource definitions cover more than GTFS. Adding a NEW source is a
   different job: the `add-gtfs-source` skill, on its own `feat/add-resources-YYYYMMDD`
   branch. Commit ONLY the edited resource definitions + `CHANGELOG.md` (never
   `pipeline/workspace/state/**` — CI owns those snapshots), push, and open a PR
   with the `resource` label (`gh pr create --label resource ...`).
   The user decides when to merge.
6. The data build itself is CI's job after merge (Blob upload workflow) — do not run
   the pipeline or any production workflow locally as part of the bump.

## Related

- `pipeline/scripts/pipeline/lib/check-odpt-report.ts` — `printRemoteResources` /
  `formatRemoteResourceLine`: the `<-- LOCAL`, `start_at`-sorted block this skill reads.
- `pipeline/scripts/pipeline/check-odpt-resources.ts` — the checker; run with a source name
  for a live single-source block.
- `pipeline/scripts/pipeline/lib/odpt-resources.ts` — `RemoteResource` (`startAt` is the
  sanctioned sort key; `date=` is not) / `getPeriodStatus` (the `in`/`after`/`before` token).
- `gtfs-data-build` skill — building data after an approved version bump.
