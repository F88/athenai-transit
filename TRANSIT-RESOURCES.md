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

- Checked at: 2026-09-13 10:49 +09:00 (run executed 2026-09-13 10:45 +09:00)
- Source run: <https://github.com/F88/athenai-transit/actions/runs/34731328016>
- Update job: 2026-09-13 10:37 +09:00 run of
  upload-transit-data-to-vercel-blob.yml (triggered after PR #370 merge)
  concluded success with ONE partial failure: iyotetsu-bus failed the GTFS
  download with HTTP 404 on date=20260901 (no resource currently published;
  see Decisions). All other 45 sources succeeded, including the 5 sources
  bumped in PR #370. Blob upload: Done: 140 uploaded, 0 failed
  (<https://github.com/F88/athenai-transit/actions/runs/34731012264>)

## Triage

<!-- Overwritten on every check run. Absolute dates only. -->

Total: 41 sources checked, 0 errors, 2 warnings, 28 info (exit 2 attention).

### CRITICAL

(none)

### UPDATE CANDIDATE

(none)

### UPCOMING

| Source             | Adopted (start_at)                                       | Newer (start_at)                                                                                     | Adopt on/after                            |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| keio-bus           | date=20260914 (2026-09-14, feed 2026-09-14 - 2026-12-31; ADOPTED_BEFORE_PERIOD: not yet active as of 2026-09-13, activates 2026-09-14) | date=20260916 (2026-09-16, feed 2026-09-16 - 2026-12-31) | 2026-09-16 |
| nishi-tokyo-bus    | date=20260912 (2026-09-12, feed 2026-09-12 - 2026-09-26) | date=20260926 (2026-09-26, feed 2026-09-26 - 2026-10-10)                                             | 2026-09-26 (adopted feed ends 2026-09-26) |
| meimon-taiyo-ferry | date=20260901 (2026-09-01, feed 2026-09-01 - 2026-09-30) | date=20261001 (2026-10-01, feed 2026-10-01 - 2026-10-31), then date=20261101 (feed 2026-11-01 - 2026-11-30) | 2026-10-01 (adopted feed ends 2026-09-30) |

### No action

Adopted is the newest valid revision for: kyoto-bus, kyoto-city-bus,
nagoya-srt, rinko-bus, yokohama-municipal-subway, yokohama-municipal-bus,
kita-bus, bunkyo-c-bus, chiyoda-bus, oshima-bus, itsukishima-kisen,
miyake-bus, chuo-bus, orange-ferry, okushiri-ferry, sanwa-shosen,
taito-c-bus, kanto-bus, keisei-transit-bus, odakyu-bus, uwajima-unyu,
shinagawa-c-bus, ota-c-bus, meguro-c-bus, suginami-gsm, hankyu-ferry,
tokai-kisen, kawasaki-city-bus.

Watch: the adopted feeds of oshima-bus, itsukishima-kisen, uwajima-unyu,
shinagawa-c-bus, ota-c-bus, meguro-c-bus, hankyu-ferry, and tokai-kisen
all end on 2026-09-30 and no newer remote resource exists yet (as of
2026-09-13). Re-check before 2026-10-01.

### OUT OF SCOPE

10 sources with no remote table in Members Portal API
(iyotetsu-bus, kagoshima-maritime-bureau, mir-train, seibu-bus,
tama-monorail, toei-bus, toei-train, tokyo-cruise-ship, tokyometro,
twr-rinkai); health covered by the update job above. NOTE: iyotetsu-bus
(downloadUrl pinned to date=20260901) still fails its download with HTTP
404 (2026-09-13); no resource is published on CKAN -- left as-is per the
decision below.

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
  (decided 2026-09-13).
