# Transit Resources Status

Latest snapshot of the transit-resource triage, written by the
`check-transit-resources` skill. This file is a summary for humans and
agents; the authoritative record is the GitHub Actions run log linked
below. If this file conflicts with a newer run, the run wins.

## Trial Operation Notes (試験運用中)

- This file is in TRIAL OPERATION. Its format and workflow may still
  change.
- The content describes the state AS OF the check timestamp below. The
  source data may have been updated since then.
- This file is NOT rewritten when the transit data itself updates (the
  daily CI update job). It is rewritten only when the check skill runs.
- Therefore, newer data may already be live even where this file reports
  an approaching expiry or a pending adoption. When freshness matters,
  consult the linked CI runs, not this file.

## Snapshot

- Checked at: 2026-10-02 09:48 +09:00 (run executed 2026-10-01 19:09 +09:00)
- Source run: <https://github.com/F88/athenai-transit/actions/runs/36847354944>
- Update job: 2026-10-02 09:38 +09:00 daily run of
  upload-transit-data-to-vercel-blob.yml concluded success with partial
  failures: the GTFS download failed with HTTP 404 for 3 sources
  (itabashi-rin2-bus: fixed URL rinringo_gtfs_20260401asshuku.zip;
  iyotetsu-bus: date=20260901; keio-bus: date=20260914). Every downstream
  step skipped those 3 (GTFS build 43 of 46 succeeded; insights 44 ok /
  3 skipped). The other 43 sources succeeded. Blob upload: Done: 134
  uploaded, 0 failed
  (<https://github.com/F88/athenai-transit/actions/runs/36946965903>)

## Triage

<!-- Overwritten on every check run. Absolute dates only. -->

Total: 41 sources checked, 20 errors, 4 warnings, 21 info (exit 1 critical).

### CRITICAL

(none) -- every expired / removed adopted feed in this run has an
in-period replacement; those sources are listed under UPDATE CANDIDATE.

### UPDATE CANDIDATE

A. Adopted feed expired or download failing (12 sources). The adopted
row is `after` or absent from remote; a replacement row is `in`.

| Source             | Adopted (start_at, feed)                                                     | Run status                                 | Newer (start_at, feed)                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| oshima-bus         | date=20260701 (2026-07-01, feed 2026-07-01 - 2026-09-30)                     | ADOPTED_EXPIRED                            | date=20261001 (2026-10-01, feed 2026-10-01 - 2027-02-05) -> adopted date=20261001 (2026-10-02)                                                                                           |
| itsukishima-kisen  | date=20251001 (2025-10-01, feed 2025-10-01 - 2026-09-30)                     | ADOPTED_EXPIRED                            | date=20261001 (2026-10-01, feed 2026-10-01 - 2027-09-30) [NEW] -> adopted date=20261001 (2026-10-02)                                                                                     |
| hankyu-ferry       | date=20260610 (2026-06-10, feed 2026-06-10 - 2026-09-30)                     | ADOPTED_MISSING + ADOPTED_EXPIRED          | date=20260929 (2026-09-29, feed 2026-10-01 - 2027-01-31) -> adopted date=20260929 (2026-10-02)                                                                                           |
| uwajima-unyu       | date=20260701 (2026-07-01, feed 2026-07-01 - 2026-09-30)                     | ADOPTED_MISSING + ADOPTED_EXPIRED          | date=20261001 (2026-10-01, feed 2026-07-01 - 2026-12-31) -> adopted date=20261001 (2026-10-02)                                                                                           |
| shinagawa-c-bus    | date=20260601 (2026-06-01, feed 2026-06-01 - 2026-09-30)                     | ADOPTED_MISSING + ADOPTED_EXPIRED          | date=20261001 (2026-10-01, feed 2026-10-01 - 2027-01-31) -> adopted date=20261001 (2026-10-02)                                                                                           |
| ota-c-bus          | date=20260601 (2026-06-01, feed 2026-06-01 - 2026-09-30)                     | ADOPTED_MISSING + ADOPTED_EXPIRED          | date=20261001 (2026-10-01, feed 2026-10-01 - 2027-01-31) -> adopted date=20261001 (2026-10-02)                                                                                           |
| meguro-c-bus       | date=20260601 (2026-06-01, feed 2026-06-01 - 2026-09-30)                     | ADOPTED_MISSING + ADOPTED_EXPIRED          | date=20261001 (2026-10-01, feed 2026-10-01 - 2027-01-31) -> adopted date=20261001 (2026-10-02)                                                                                           |
| nishi-tokyo-bus    | date=20260912 (2026-09-12, feed 2026-09-12 - 2026-09-26)                     | ADOPTED_EXPIRED                            | date=20261001 (2026-10-01, feed 2026-10-01 - 2026-12-31) -> adopted date=20261001 (2026-10-02); also date=20260926 (2026-09-26, feed 2026-09-26 - 2026-10-10) is `in`                    |
| tokai-kisen        | date=20260701 (2026-07-01, feed 2026-07-01 - 2026-09-30)                     | ADOPTED_MISSING + ADOPTED_EXPIRED          | date=20261001 (2026-10-01, feed 2026-10-01 - 2026-12-31) -> adopted date=20261001 (2026-10-02)                                                                                           |
| meimon-taiyo-ferry | date=20260901 (2026-09-01, feed 2026-09-01 - 2026-09-30)                     | ADOPTED_MISSING + ADOPTED_EXPIRED          | date=20261001 (2026-10-01, feed 2026-10-01 - 2026-10-31) -> adopted date=20261001 (2026-10-02); date=20261101 (2026-11-01, feed 2026-11-01 - 2026-11-30) is `before`, adopt on/after 2026-11-01 |
| keio-bus           | date=20260914 (not in remote; download HTTP 404 on 2026-10-01 and 2026-10-02) | LAST DOWNLOAD FAILED / LOCAL_NO_DOWNLOAD_REPORT | date=20261001 (2026-10-01, feed 2026-10-01 - 2026-12-31) -> adopted date=20261001 (2026-10-02); date=20260925 / 20260924 / 20260916 are also `in` (feed each to 2026-12-31)         |
| iyotetsu-bus       | date=20260901 (not in remote; download HTTP 404 on 2026-10-01 and 2026-10-02) | LAST DOWNLOAD FAILED / LOCAL_NO_DOWNLOAD_REPORT | date=20261001 (2026-10-01, feed 2026-10-01 - 2026-10-31) [NEW] -> adopted date=20261001 (2026-10-02)                                                                                 |

B. Adopted feed still valid and still downloadable; a newer revision is
`in` (4 sources).

| Source            | Adopted (start_at, feed)                                            | Run status                                 | Newer (start_at, feed)                                                                                                   |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| kyoto-bus         | date=20260911 (2026-09-11, feed 2026-09-11 - 2026-11-30) `in`       | REMOTE_KNOWN_IN_PERIOD                     | date=20260928 (2026-09-28, feed 2026-09-28 - 2027-03-31) -> adopted date=20260928 (2026-10-02)                                                                 |
| odakyu-bus        | date=20260716 (2026-07-16, feed 2026-07-16 - no end)                | ADOPTED_MISSING (download succeeded 2026-10-02) | date=20260924 (2026-09-24, feed 2026-10-01 - no end, `in-no-end`) -> adopted date=20260924 (2026-10-02); remote URL path is `AIILines.zip` (capital I, I) as in the current definition |
| suginami-gsm      | date=20260601 (2026-06-01, feed 2026-07-24 - 2028-06-30)            | ADOPTED_MISSING (download succeeded 2026-10-02) | date=20261001 (2026-10-01, feed 2026-07-24 - 2028-06-30) [NEW] -> adopted date=20261001 (2026-10-02); same feed window as adopted                              |
| kawasaki-city-bus | date=20260828 (2026-08-28, feed 2026-07-01 - 2027-07-01)            | ADOPTED_MISSING (download succeeded 2026-10-02) | date=20260928 (2026-09-28, feed 2026-07-01 - 2027-07-01) -> adopted date=20260928 (2026-10-02); same feed window as adopted                                    |

### UPCOMING

| Source | Adopted | Newer | Adopt on/after |
| ------ | ------- | ----- | -------------- |

(none as a separate source. meimon-taiyo-ferry date=20261101 (feed
2026-11-01 - 2026-11-30, adopt on/after 2026-11-01) is recorded in its
UPDATE CANDIDATE row above.)

### No action

Adopted is the newest valid revision for (16): rinko-bus,
yokohama-municipal-subway, yokohama-municipal-bus, kita-bus, bunkyo-c-bus,
chiyoda-bus, miyake-bus, chuo-bus, orange-ferry, okushiri-ferry,
sanwa-shosen, taito-c-bus, kanto-bus, keisei-transit-bus, kyoto-city-bus,
nagoya-srt.

Watch: the adopted feed of kanto-bus (date=20260824) ends on 2026-10-30
and no remote resource newer than LOCAL exists (as of 2026-10-01).
Re-check before 2026-10-31.

### OUT OF SCOPE

9 sources with no remote table in Members Portal API
(kagoshima-maritime-bureau, mir-train, seibu-bus, tama-monorail, toei-bus,
toei-train, tokyo-cruise-ship, tokyometro, twr-rinkai); all 9 downloaded
OK in the 2026-10-02 update job. tokyo-cruise-ship local feed ends
2026-10-31. Not in the checker's target list: itabashi-rin2-bus (fixed
URL) failed its download with HTTP 404 in the 2026-10-02 update job; no
replacement URL is known from the run. -> adopted fixed URL
rinringo_gtfs_20260803.zip (feed 2026-08-03 - 2027-03-31) on 2026-10-02.

## Decisions / Pending

<!-- Preserved across check runs. Date-stamp every entry. -->

- APPLIED (PR #370, merged 2026-09-13): keio-bus date=20260914,
  kyoto-city-bus date=20260831, nagoya-srt date=20260911, nishi-tokyo-bus
  date=20260912, kyoto-bus date=20260911 (all decided 2026-09-13). The
  2026-09-13 check run above confirms all 5 as adopted; data built and
  uploaded to Blob by the update job linked above.
- iyotetsu-bus: leave as-is. User checked the CKAN resource page on
  2026-09-13: no resource is published at all right now. This source
  regularly has monthly gaps with no published feed, so the download 404
  is expected; adopt a new date= when a resource reappears
  (decided 2026-09-13). -- RESOLVED by the 2026-10-01 check run: a
  resource reappeared (date=20261001, feed 2026-10-01 - 2026-10-31); it is
  now an UPDATE CANDIDATE awaiting the user's decision (noted 2026-10-02).
- APPLIED (uncommitted, 2026-10-02): iyotetsu-bus date=20261001
  (CKAN resource 8b4e5d9b-dec9-45cf-af5d-3ed891d3f611, feed 2026-10-01 -
  2026-10-31), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): oshima-bus date=20261001 (CKAN
  resource 289f8580-54c2-41d7-bb70-3093cefdd7a5, feed 2026-10-01 -
  2027-02-05) and itsukishima-kisen date=20261001 (CKAN resource
  b555fd9e-9e21-4058-b315-a025cba07010, feed 2026-10-01 - 2027-09-30),
  decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): hankyu-ferry date=20260929 (CKAN
  resource ea4d54d8-2e97-41d2-a9e6-0bca22198566, feed 2026-10-01 -
  2027-01-31) and uwajima-unyu date=20261001 (CKAN resource
  12f67dee-624b-49f3-b185-09b4c99ec6a4, feed 2026-07-01 - 2026-12-31),
  decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): tokai-kisen date=20261001 (CKAN
  resource 506a932e-8c1c-4ec9-98da-092560ed973f, feed 2026-10-01 -
  2026-12-31), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): meimon-taiyo-ferry date=20261001
  (CKAN resource 8af45a4c-01c9-4570-8b08-997c8a86337a, feed 2026-10-01 -
  2026-10-31), decided by the user 2026-10-02. Its date=20261101 (feed
  2026-11-01 - 2026-11-30) remains UPCOMING: adopt on/after 2026-11-01.
- APPLIED (uncommitted, 2026-10-02): shinagawa-c-bus date=20261001 (CKAN
  resource efe4eb1d-4a36-4188-8cfa-41f0654264d4, feed 2026-10-01 -
  2027-01-31), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): ota-c-bus date=20261001 (CKAN
  resource 4a4d90c7-dd8c-4d5c-8876-90af85a296c1, feed 2026-10-01 -
  2027-01-31), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): meguro-c-bus date=20261001 (CKAN
  resource 5b579d30-618e-4c83-ac2c-37ac39fea5d9, feed 2026-10-01 -
  2027-01-31), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): nishi-tokyo-bus date=20261001 (CKAN
  resource f679701a-ff32-45ec-a780-9175d20d569e, feed 2026-10-01 -
  2026-12-31), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): keio-bus date=20261001 (CKAN
  resource 2f3c80b2-a439-412a-83e0-9fda732ac89e, feed 2026-10-01 -
  2026-12-31), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): suginami-gsm date=20261001 (CKAN
  resource 6b9a3126-6bc7-4b97-b32f-a7be0c959215, feed 2026-07-24 -
  2028-06-30), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): kawasaki-city-bus date=20260928
  (CKAN resource b352c6ed-5abe-42b5-9061-1d0df8be904f, feed 2026-07-01 -
  2027-07-01), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): odakyu-bus date=20260924 (CKAN
  resource 3ecd38b4-f366-4ac0-aee7-80723c40ee4a, feed 2026-10-01 - no
  end), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): kyoto-bus date=20260928 (CKAN
  resource 34734439-3911-4a07-952b-230d08b3c8e7, feed 2026-09-28 -
  2027-03-31), decided by the user 2026-10-02.
- APPLIED (uncommitted, 2026-10-02): itabashi-rin2-bus downloadUrl ->
  rinringo_gtfs_20260803.zip (fixed URL on the Itabashi city page, zip
  last-modified 2026-09-24, feed 2026-08-03 - 2027-03-31), decided by the
  user 2026-10-02. The previous file name rinringo_gtfs_20260401asshuku.zip
  returns HTTP 404.
- The 2026-09-13 UPCOMING items (keio-bus date=20260916 on 2026-09-16,
  nishi-tokyo-bus date=20260926 on 2026-09-26, meimon-taiyo-ferry
  date=20261001 on 2026-10-01) were not applied before their adopt dates;
  all three sources now appear in UPDATE CANDIDATE A with newer
  revisions (noted 2026-10-02).
- PENDING (as of 2026-10-02): all 16 UPDATE CANDIDATEs from the
  2026-10-01 run and the itabashi-rin2-bus fixed-URL fix have been
  applied (uncommitted).
