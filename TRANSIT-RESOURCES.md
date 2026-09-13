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

- Checked at: 2026-09-13 09:41 +09:00 (run executed 2026-09-12 22:19 +09:00)
- Source run: <https://github.com/F88/athenai-transit/actions/runs/34696091386>
- Update job: 2026-09-12 12:31 +09:00 run of
  upload-transit-data-to-vercel-blob.yml concluded success but had PARTIAL
  FAILURES: iyotetsu-bus, keio-bus, kyoto-city-bus failed the GTFS download
  with HTTP 404 on the adopted date= URL, and the same 3 sources failed in
  every downstream build step. Blob upload of the built sources:
  Done: 134 uploaded, 0 failed
  (<https://github.com/F88/athenai-transit/actions/runs/34670590121>)

## Triage

<!-- Overwritten on every check run. Absolute dates only. -->

Total: 41 sources checked, 1 error, 4 warnings, 27 info (exit 1 critical;
check run conclusion: failure).

### CRITICAL

Adopted resource no longer exists in remote for 3 sources. In-period
replacements exist for all 3, so an immediate bump is possible.

| Source         | Adopted (state)                                                          | Replacement in remote (start_at)                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| keio-bus       | date=20260901: download HTTP 404 (2026-09-12), removed from remote       | date=20260903 (2026-09-03, feed 2026-09-03 - 2026-12-31, in); also date=20260914 (start 2026-09-14) and date=20260916 (start 2026-09-16), both feeds ending 2026-12-31 -> adopted date=20260914 (2026-09-13) |
| kyoto-city-bus | date=20260729: download HTTP 404 (2026-09-12), removed from remote       | date=20260831 (2026-08-31, feed 2026-08-31 - 2027-03-31, in); only remote resource -> adopted date=20260831 (2026-09-13)                                                 |
| nagoya-srt     | date=20260213: ADOPTED_MISSING (removed from remote; download still OK on 2026-09-12) | date=20260911 (2026-09-11, feed 2026-09-11 - 2027-03-31, in); only remote resource -> adopted date=20260911 (2026-09-13)                                       |

### UPDATE CANDIDATE

| Source          | Adopted (start_at)                                       | Newer valid now (start_at)                                                                                                              |
| --------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| nishi-tokyo-bus | date=20260901 (2026-09-01, feed 2026-09-01 - 2026-09-15) | date=20260912 (2026-09-12, feed 2026-09-12 - 2026-09-26); adopted feed ends 2026-09-15; source publishes short 2-week feeds; date=20260926 (feed 2026-09-26 - 2026-10-10) follows -> adopted date=20260912 (2026-09-13) |
| kyoto-bus       | date=20260901 (2026-09-01, feed 2026-09-01 - 2026-11-30) | date=20260911 (2026-09-11, feed 2026-09-11 - 2026-11-30) -> adopted date=20260911 (2026-09-13)                                           |

### UPCOMING

| Source             | Adopted (start_at)                                       | Newer (start_at)                                                                                     | Adopt on/after                            |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| meimon-taiyo-ferry | date=20260901 (2026-09-01, feed 2026-09-01 - 2026-09-30) | date=20261001 (2026-10-01, feed 2026-10-01 - 2026-10-31), then date=20261101 (feed 2026-11-01 - 2026-11-30) | 2026-10-01 (adopted feed ends 2026-09-30) |

### No action

Adopted is the newest valid revision for: rinko-bus,
yokohama-municipal-subway, yokohama-municipal-bus, kita-bus, bunkyo-c-bus,
chiyoda-bus, oshima-bus, itsukishima-kisen, miyake-bus, chuo-bus,
orange-ferry, okushiri-ferry, sanwa-shosen, taito-c-bus, kanto-bus,
keisei-transit-bus, odakyu-bus, uwajima-unyu, shinagawa-c-bus, ota-c-bus,
meguro-c-bus, suginami-gsm, hankyu-ferry, tokai-kisen, kawasaki-city-bus.

Watch: the adopted feeds of oshima-bus, itsukishima-kisen, uwajima-unyu,
shinagawa-c-bus, ota-c-bus, meguro-c-bus, hankyu-ferry, and tokai-kisen
all end on 2026-09-30 and no newer remote resource exists yet (as of
2026-09-12). Re-check before 2026-10-01.

### OUT OF SCOPE

10 sources with no remote table in Members Portal API
(iyotetsu-bus, kagoshima-maritime-bureau, mir-train, seibu-bus,
tama-monorail, toei-bus, toei-train, tokyo-cruise-ship, tokyometro,
twr-rinkai); health covered by the update job above. NOTE: iyotetsu-bus
(downloadUrl pinned to date=20260901) failed its download with HTTP 404 on
2026-09-12 -- the adopted version is gone from the remote and no remote
table exists to pick a replacement from; needs manual investigation.

## Decisions / Pending

<!-- Preserved across check runs. Date-stamp every entry. -->

- keio-bus: adopt date=20260914 (CKAN resource
  e3288daf-0828-45f6-90bf-1f129d39cc38; feed starts 2026-09-14)
  (decided 2026-09-13).
- kyoto-city-bus: adopt date=20260831 (CKAN resource
  6a067914-77da-4b3b-a3ac-0def94dd0857) (decided 2026-09-13).
- nagoya-srt: adopt date=20260911 (CKAN resource
  a7588aea-27fd-4962-b39a-912209f19a1b) (decided 2026-09-13).
- nishi-tokyo-bus: adopt date=20260912 (CKAN resource
  27cb73fb-c89b-48ba-8ce1-30626c79a4a0; feed 2026-09-12 - 2026-09-26, next
  date=20260926 already listed remotely) (decided 2026-09-13).
- kyoto-bus: adopt date=20260911 (CKAN resource
  7ba6e24c-a00d-47ed-a159-c071daca2da7) (decided 2026-09-13).
- iyotetsu-bus: leave as-is. User checked the CKAN resource page on
  2026-09-13: no resource is published at all right now. This source
  regularly has monthly gaps with no published feed, so the download 404
  is expected; adopt a new date= when a resource reappears
  (decided 2026-09-13).
