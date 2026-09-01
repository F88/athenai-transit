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

- Checked at: 2026-09-01 11:46 +09:00 (run executed 2026-09-01 10:34 +09:00)
- Source run: <https://github.com/F88/athenai-transit/actions/runs/33459257704>
- Update job: 2026-09-01 run of upload-transit-data-to-vercel-blob.yml
  succeeded with no partial failure (all Warn/Fail steps skipped)
  (<https://github.com/F88/athenai-transit/actions/runs/33458247813>)

## Triage

<!-- Overwritten on every check run. Absolute dates only. -->

Total: 41 sources checked, 0 errors, 0 warnings, 30 info (exit 2 attention).

### CRITICAL

(none)

### UPDATE CANDIDATE

(none)

### UPCOMING

| Source             | Adopted (start_at)                                       | Newer (start_at)                                                                                                        | Adopt on/after                                                                 |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| keio-bus           | date=20260901 (2026-09-01, feed 2026-09-01 - 2026-12-31) | date=20260903 (2026-09-03, feed 2026-09-03 - 2026-12-31)                                                                | 2026-09-03                                                                     |
| nagoya-srt         | date=20260213 (2026-02-13, feed 2026-02-13 - 2027-03-31) | date=20260911 (2026-09-11, feed 2026-09-11 - 2027-03-31)                                                                | 2026-09-11                                                                     |
| nishi-tokyo-bus    | date=20260901 (2026-09-01, feed 2026-09-01 - 2026-09-15) | date=20260912 (2026-09-12, feed 2026-09-12 - 2026-09-26), then date=20260926 (2026-09-26, feed 2026-09-26 - 2026-10-10) | 2026-09-12 (adopted feed ends 2026-09-15; source publishes short 2-week feeds) |
| meimon-taiyo-ferry | date=20260901 (2026-09-01, feed 2026-09-01 - 2026-09-30) | date=20261001 (2026-10-01, feed 2026-10-01 - 2026-10-31)                                                                | 2026-10-01 (adopted feed ends 2026-09-30)                                      |

### No action

Adopted is the newest valid revision for: kyoto-bus, kyoto-city-bus,
rinko-bus, yokohama-municipal-subway, yokohama-municipal-bus, kita-bus,
bunkyo-c-bus, chiyoda-bus, oshima-bus, itsukishima-kisen, miyake-bus,
chuo-bus, orange-ferry, okushiri-ferry, sanwa-shosen, taito-c-bus,
kanto-bus, keisei-transit-bus, iyotetsu-bus, odakyu-bus, uwajima-unyu,
shinagawa-c-bus, ota-c-bus, meguro-c-bus, suginami-gsm, hankyu-ferry,
tokai-kisen, kawasaki-city-bus.

Watch: the adopted feeds of oshima-bus, itsukishima-kisen, iyotetsu-bus,
uwajima-unyu, shinagawa-c-bus, ota-c-bus, meguro-c-bus, hankyu-ferry, and
tokai-kisen all end on 2026-09-30 and no newer remote resource exists yet
(as of 2026-09-01). Re-check before 2026-10-01.

### OUT OF SCOPE

9 fixed/latest-URL sources with no remote table (kagoshima-maritime-bureau,
mir-train, seibu-bus, tama-monorail, toei-bus, toei-train,
tokyo-cruise-ship, tokyometro, twr-rinkai); health covered by the update
job above.

## Decisions / Pending

<!-- Preserved across check runs. Date-stamp every entry. -->

- (none)
