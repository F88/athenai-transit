---
name: gtfs-data-investigation
description: Best practices and pitfalls for investigating GTFS data. Use when searching routes/patterns, checking departure times, analyzing timetable data, or verifying data accuracy against official sources. Always consult this skill for any GTFS data investigation task.
---

# GTFS Data Investigation Tips

Pitfalls and best practices when investigating GTFS data. Based on real bugs and misdiagnoses encountered during pipeline development.

## 1. Always enumerate ALL patterns (critical)

The same route_short_name can map to multiple route_ids and patterns.

**Real example**: Kyoto City Bus route "46"

- `市バス４６` (route_id: kcbus:xxx) — 78 stops, first departure 6:35
- `市バス三条京阪４６` (route_id: kcbus:yyy) — different pattern, first departure 5:55

Searching only one pattern led to the false conclusion that "5:55 departure does not exist in GTFS."

**Rules**:

- When investigating a route, use **partial match** on route_short_name to list all route_ids
- When investigating patterns, do NOT filter by stop count or other conditions — list all patterns first
- Before concluding "not found", broaden the search criteria and try again

## 2. Late-night services use separate route_ids

Late-night buses often have different fares, so operators register them as separate routes in GTFS.

**Real example**: Keio Bus route 渋63

- `kobus:238` — 渋63 (regular service)
- `kobus:240深夜` — 渋63 late-night

When searching by route_short_name, don't miss late-night variants.

## 3. Circular route departure 2x problem

On circular routes, origin and terminal share the same stop_id. The departure array at that stop contains both outbound departures and inbound arrivals, interleaved when sorted — resulting in 2x the count of interior stops.

**Real example**: Kita-ku K-Bus Oji-Komagome route (kbus:p1)

- origin/terminal (JR Oji Station): 62 deps
- interior stops: 31 deps

**Impact**:

- freq count: use an interior stop (position 1) to avoid 2x
- positional alignment: sorted departures at origin are interleaved (start/return), making slice-based alignment unreliable

## 4. Zero travel time between consecutive stops

Consecutive stops with the same departure minute exist in real data. This is valid data, not missing data.

**Real examples**:

- Keio Bus 渋63: Hatsudai-Sakagami 23:20 → Tokyo Opera City Minami 23:20
- Toei Bus Express 05: Miraikan 8:45 → Miraikan-mae 8:45 (81m apart)

A bug was caused by treating diff=0 as "no data" in gap interpolation. Use a sentinel value (e.g., -1) to distinguish "no data" from "zero travel time."

## 5. freq=0 means no service in that group

The same pattern can have departures in some service groups but not others. freq=0 means the pattern does not operate on that day type.

**Real example**: Keio Bus 渋63 p216 (Shibuya Sta. → Nakano Garage)

- wd (weekday): no service (freq=0)
- sa (Saturday): 1 trip/day
- su (Sunday): 1 trip/day

Including freq=0 entries in output causes apps to misinterpret "0 minutes ride time."

## 6. Travel time varies significantly by time of day

rd (median) is a representative value across all trips — individual trip durations can differ substantially.

**Real example**: Keio Bus 渋63 Shibuya → Nakano (Sunday)

- Night trip (22:50 dep): 37 min
- Daytime trip: 50 min
- rd (median): 44 min

Traffic congestion causes large differences between early morning/night and daytime.

## 7. Verification methods

When verifying GTFS data accuracy:

1. **Official operator website** timetable — most reliable
2. **Google Maps** (GTFS-based) — generally matches GTFS
3. **Transit apps** (NAVITIME, etc.) may use proprietary data — differences may indicate schedule revision timing gaps
4. **Don't mix day types** — comparing weekday GTFS data with Sunday official data produces false mismatches
5. **Use the same trip index** — searching "first departure >= X" independently at each stop picks up different trips

## 8. Search templates

### List all patterns for a route

```python
for pid, p in patterns.items():
    r = routes.get(p['r'], {})
    if 'search_term' in r.get('s', '') or 'search_term' in r.get('l', ''):
        print(f'{pid}: {r.get("s", "")}, stops={len(p["stops"])}')
```

Search both route_short_name (`r["s"]`) and route_long_name (`r["l"]`).

### Search all patterns for a specific departure time

```python
target_min = 6 * 60 + 4  # 6:04
for pid, p in patterns.items():
    sid0 = p['stops'][0]
    for g in tt.get(sid0, []):
        if g['tp'] == pid:
            for svc, deps in g['d'].items():
                if target_min in deps:
                    print(f'{pid} svc={svc}')
```

### Show all stop times for a single trip

Determine trip index `j` at stop[0], then use the same `j` across all stops. Do NOT search independently per stop.
