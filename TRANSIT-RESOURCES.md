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

- Checked at: 2026-11-07 21:49 +09:00 (run executed 2026-11-07 21:47 +09:00)
- Source run: <https://github.com/F88/athenai-transit/actions/runs/42374037627>
- Update job: 2026-11-07 21:39 +09:00 workflow_dispatch run of
  upload-transit-data-to-vercel-blob.yml on merge commit 5c640340 (PR #372)
  concluded success with no partial failure: GTFS download 46 of 46
  succeeded, every build step 0 failed / 0 skipped. Blob upload: Done: 143
  uploaded, 0 failed
  (<https://github.com/F88/athenai-transit/actions/runs/42373481675>)

## Triage

<!-- Overwritten on every check run. Absolute dates only. -->

Total: 41 sources checked, 2 errors, 0 warnings, 19 info (exit 1 critical).

### CRITICAL

| Source    | Adopted (start_at)                                                                        | Remote                                                                           |
| --------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| kanto-bus | date=20261014 (2026-10-14, feed 2026-10-01 - 2026-10-14, status `after`; ADOPTED_EXPIRED) | 1 resource, 0 currently valid (REMOTE_NO_VALID_DATA); LOCAL is the only resource |

### UPDATE CANDIDATE

(none)

### UPCOMING

| Source             | Adopted (start_at)                                       | Newer (start_at)                                                                                                   | Adopt on/after                                        |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| kyoto-bus          | date=20261107 (2026-11-07, feed 2026-11-07 - 2027-04-04) | date=20261109 (2026-11-09, feed 2026-11-09 - 2027-04-04)                                                           | 2026-11-09                                            |
| meimon-taiyo-ferry | date=20261101 (2026-11-01, feed 2026-11-01 - 2026-11-30) | date=20261201 (2026-12-01, feed 2026-12-01 - 2026-12-31); date=20270101 (2027-01-01, feed 2027-01-01 - 2027-01-31) | 2026-12-01 (adopted feed ends 2026-11-30); 2027-01-01 |

### No action

Adopted is the newest valid revision for (29): rinko-bus,
yokohama-municipal-subway, yokohama-municipal-bus, kita-bus, bunkyo-c-bus,
chiyoda-bus, oshima-bus, keio-bus, iyotetsu-bus, itsukishima-kisen,
miyake-bus, chuo-bus, okushiri-ferry, sanwa-shosen, odakyu-bus,
hankyu-ferry, uwajima-unyu, shinagawa-c-bus, ota-c-bus, meguro-c-bus,
nishi-tokyo-bus, tokai-kisen, keisei-transit-bus, suginami-gsm,
orange-ferry, taito-c-bus, kyoto-city-bus, kawasaki-city-bus, nagoya-srt.

Watch: the adopted feed of iyotetsu-bus (date=20261025, feed end 2026-11-30)
ends within 30 days and no remote resource newer than LOCAL exists (as of
2026-11-07). Re-check before 2026-12-01. odakyu-bus reports no feed end
(`in-no-end`); its feed version string is 20261001_20261130.

### OUT OF SCOPE

9 sources with no remote table in Members Portal API
(kagoshima-maritime-bureau, mir-train, seibu-bus, tama-monorail, toei-bus,
toei-train, tokyo-cruise-ship, tokyometro, twr-rinkai); all 9 downloaded
OK in the 2026-11-07 21:39 update job. tokyo-cruise-ship local feed ends
2026-12-31. itabashi-rin2-bus (fixed URL, not in the checker's target
list) downloaded OK in the same update job.

## Decisions / Pending

<!-- Preserved across check runs. Date-stamp every entry. -->

- APPLIED (PR #370, merged 2026-09-13): keio-bus date=20260914,
  kyoto-city-bus date=20260831, nagoya-srt date=20260911, nishi-tokyo-bus
  date=20260912, kyoto-bus date=20260911 (all decided 2026-09-13).
- iyotetsu-bus: leave as-is. User checked the CKAN resource page on
  2026-09-13: no resource is published at all right now. This source
  regularly has monthly gaps with no published feed, so the download 404
  is expected; adopt a new date= when a resource reappears
  (decided 2026-09-13). -- RESOLVED: date=20261001 reappeared and was
  adopted in PR #371 (2026-10-02). The pattern (monthly feed, gaps
  between months) still applies; the date=20261025 feed adopted 2026-11-07
  ends 2026-11-30.
- The 2026-09-13 UPCOMING items (keio-bus date=20260916 on 2026-09-16,
  nishi-tokyo-bus date=20260926 on 2026-09-26, meimon-taiyo-ferry
  date=20261001 on 2026-10-01) were not applied before their adopt dates;
  all three were superseded by the 2026-10-02 bump below (noted
  2026-10-02).
- APPLIED (PR #371, merged 2026-10-02 10:13 +09:00; all decided by the
  user 2026-10-02, each CKAN resource verified against its resource page):
    - iyotetsu-bus date=20261001 (8b4e5d9b-dec9-45cf-af5d-3ed891d3f611)
    - oshima-bus date=20261001 (289f8580-54c2-41d7-bb70-3093cefdd7a5)
    - itsukishima-kisen date=20261001 (b555fd9e-9e21-4058-b315-a025cba07010)
    - hankyu-ferry date=20260929 (ea4d54d8-2e97-41d2-a9e6-0bca22198566)
    - uwajima-unyu date=20261001 (12f67dee-624b-49f3-b185-09b4c99ec6a4)
    - tokai-kisen date=20261001 (506a932e-8c1c-4ec9-98da-092560ed973f)
    - meimon-taiyo-ferry date=20261001 (8af45a4c-01c9-4570-8b08-997c8a86337a)
    - shinagawa-c-bus date=20261001 (efe4eb1d-4a36-4188-8cfa-41f0654264d4)
    - ota-c-bus date=20261001 (4a4d90c7-dd8c-4d5c-8876-90af85a296c1)
    - meguro-c-bus date=20261001 (5b579d30-618e-4c83-ac2c-37ac39fea5d9)
    - nishi-tokyo-bus date=20261001 (f679701a-ff32-45ec-a780-9175d20d569e)
    - keio-bus date=20261001 (2f3c80b2-a439-412a-83e0-9fda732ac89e)
    - suginami-gsm date=20261001 (6b9a3126-6bc7-4b97-b32f-a7be0c959215)
    - kawasaki-city-bus date=20260928 (b352c6ed-5abe-42b5-9061-1d0df8be904f)
    - odakyu-bus date=20260924 (3ecd38b4-f366-4ac0-aee7-80723c40ee4a)
    - kyoto-bus date=20260928 (34734439-3911-4a07-952b-230d08b3c8e7)
    - itabashi-rin2-bus downloadUrl -> rinringo_gtfs_20260803.zip (fixed URL
      on the Itabashi city page, feed 2026-08-03 - 2027-03-31; the previous
      file name rinringo_gtfs_20260401asshuku.zip returns HTTP 404)
      The 2026-10-02 10:21 check run above confirms all 16 ODPT sources as
      adopted (LOCAL on row #1, `in`); data built and uploaded to Blob by the
      update job linked above.
- PENDING (as of 2026-10-02): itabashi-rin2-bus fixed URL changes its file
  name per revision (`asshuku` suffix dropped in the 20260803 file); the
  next update of that source needs the URL re-read from the city page. The
  meimon-taiyo-ferry date=20261101 item is RESOLVED by the 2026-11-07
  adoption below.
- APPLIED (PR #372, merged 2026-11-07 21:38 +09:00; decided by the user
  2026-11-07, Group A and Group B candidates plus kanto-bus; each CKAN
  resource verified against its resource page):
    - kyoto-city-bus date=20261104 (cba5e1e3-2581-40e6-a18f-f9dfccb5e215)
    - iyotetsu-bus date=20261025 (719faa3e-c5a6-40d1-804a-d7655e00ea0a)
    - meimon-taiyo-ferry date=20261101 (58aaf293-42cd-4605-b885-1d02d62ab100)
    - rinko-bus date=20261101 (7265c43e-acb7-4bce-8aa6-061f24cc9c7c)
    - orange-ferry date=20261101 (a0d98c84-a739-4056-a2ea-f1330a29a52c)
    - taito-c-bus date=20261102 (8fff61b3-e035-4340-81b9-18b08f5cbeb8)
    - kyoto-bus date=20261107 (6670f1ec-5832-4329-a1c5-2f1a995835df)
    - yokohama-municipal-bus date=20261101 (083ebb2d-d593-43bd-8f7a-f07d20f1a534)
    - kawasaki-city-bus date=20261101 (cbcd9e71-4101-44ef-831d-ff27493060c3)
    - kanto-bus date=20261014 (65bffcbf-7eb3-4291-8fd4-7cb51ea1409c): the only
      resource published on CKAN as of 2026-11-07. Adopted knowing its feed
      ended 2026-10-14; the adopted feed stays expired until a newer resource
      is adopted.
      The 2026-11-07 21:47 check run confirms all 10 sources as adopted (LOCAL
      marker present); data built and uploaded to Blob by the update job linked
      above.
