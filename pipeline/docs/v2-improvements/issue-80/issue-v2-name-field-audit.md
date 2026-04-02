# Issue Draft: Audit GTFS/GTFS-JP Schema Coverage In V2 Output

## Summary

During the recent V2 name-field analysis, we found that some fields defined in the GTFS / GTFS-JP schema are not emitted into the current V2 JSON output.

At minimum, `trips.trip_short_name` is currently not emitted into V2 bundles.

This should not be treated as a one-off missing field. We need a full audit of GTFS / GTFS-JP schema coverage against the current V2 output model.

For each schema field, we should determine whether it is:

- emitted as a primary V2 field
- emitted via `translations` or `lookup`
- intentionally excluded
- derived indirectly rather than emitted directly
- silently not emitted due to missing implementation

## Why This Matters

- Missing fields can lead to incomplete assumptions in UI, repository, resolver, and analytics design.
- Dismissing a field because current data is empty is risky. If providers start populating it later, the value may be silently lost.
- We need a clear distinction between `intentionally excluded` and `not emitted`.
- Name-like fields exposed the problem first, but the same failure mode can happen for other GTFS / GTFS-JP fields as well.

## Confirmed Example

- `trips.trip_short_name`
    - Exists in the GTFS schema
    - Has no field in the current V2 type model
    - Is not read by the current GTFS -> V2 extraction path

## Audit Scope

At minimum, this audit should cover fields defined in the following GTFS / GTFS-JP tables:

### Full schema coverage

- `agency`
- `agency_jp`
- `stops`
- `routes`
- `trips`
- `stop_times`
- `translations`
- `feed_info`
- Any additional tables or fields that materially affect current V2 design decisions

### High-priority display-affecting fields

#### Already represented in V2 in some form

- `routes.route_short_name`
- `routes.route_long_name`
- `routes.route_desc`
- `stops.stop_name`
- `stops.stop_desc` (via lookup)
- `trips.trip_headsign`
- `stop_times.stop_headsign` (primary: `tripPatterns.stops[].sh`, translations: `translations.stop_headsigns`)
- `agency.agency_name`
- `agency.agency_short_name`

#### Defined in schema but not clearly surfaced in current V2

- `trips.trip_short_name`
- `stops.tts_stop_name`
- `agency_jp.agency_official_name`
- `trips.jp_trip_desc`
- `trips.jp_trip_desc_symbol`

## Audit Questions

For each field, at minimum document:

1. Where it is defined in the GTFS / GTFS-JP schema.
2. Whether the current pipeline reads it from raw DB / CSV input.
3. Where it appears in V2, if anywhere.
4. If it does not appear in V2, whether that is intentional or an implementation gap.
5. Whether silent loss could occur if providers start populating the field later.
6. Whether the exclusion or transformation is already documented in code comments or docs.

## Expected Output Format

Each field should end up classified into at least one of these categories:

- `emitted-primary`
- `emitted-translations`
- `emitted-lookup`
- `derived-not-direct`
- `intentionally-excluded`
- `not-emitted`
- `unknown-needs-review`

## Suggested Deliverables

1. A GTFS / GTFS-JP schema coverage table for V2 output.
2. A clear classification of `excluded` vs `not emitted` vs `derived`.
3. A prioritized list of high-impact gaps.
4. Documentation or type-comment updates where design intent is currently implicit.
5. Follow-up issues if needed, for example:
    - add `trip_short_name` to the V2 schema
    - expose additional agency / TTS fields
    - document intentionally excluded GTFS-JP extensions

## Notes

- This issue is for audit and clarification first, not for immediate schema expansion.
- Even if current data is empty, a schema-defined field that is not emitted should still be tracked.
- The current name-field analysis should be treated as one part of this broader schema audit.
