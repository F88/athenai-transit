# Timetable Stop-Event State Model

How the app models the state of a single stop event (one trip stopping at
one stop). This is the spec deliverable for Issue #162. It records the
chosen model, the decision not to introduce a normalized operational-state
enum, and the data caveats that drove that decision.

## The two axes

A stop event answers two distinct questions that must not be collapsed
into one:

1. **Faithful facts** -- "what does the source say about this stop event",
   read straight from the GTFS signals and the pattern role, with no
   inference. This is the data-viewer philosophy: display the data as-is.
2. **Value for the passenger** -- "what does this mean for a passenger"
   (can they board / alight here), combining the signal with the pattern
   position via the current (interim) rule.

These are not exclusive: they are often shown together. The canonical
case is a through-service last row -- faithfully "terminal" (it is the
pattern's last stop) AND, for the passenger, potentially "boardable" (the
train continues onto another operator). On the surface this reads as a
contradiction; the correct model presents it as information ("last stop of
this feed, but you can still board"), not a conflict. Resolving that
display tension is per-source policy in Issue #145.

The faithful axis has two faithful sub-kinds: pattern **position** (role
in the trip) and raw **signal** (pickup / drop-off).

## Code map

| Layer                  | Concern                              | Code                                                                                                          |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Faithful: position     | first / last / mid                   | `patternPosition.isFirstStop` / `isLastStop`; `getTimetableEntryAttributes`                                   |
| Faithful: signal       | raw pickup / drop-off                | `canBoardSignal` / `canAlight`; `isNoPassengerService` (explicit 1/1); `requiresArrangement` (2/3)            |
| Interpreted: passenger | can board / alight (inference incl.) | `isBoardableForPassenger` / `isAlightableForPassenger` (and `*Signal` form for raw-array scans)               |
| Display: transit board | departure / arrival                  | `timetable-entry-for-transit-display.ts` (`isDeparture` / `isArrival`), delegating to the passenger judgments |

Aggregation mirrors the axes: `TimetableEntryStats` groups counts into
`position` / `signal` (faithful) and `passenger` (interpreted), plus
`routeDirection` / `tripLocator`; `StopsCounts` into `position` /
`passenger`. See Issue #162 item 5 (landed).

A separate collection-level state already exists:
`TimetableEntriesState = 'boardable' | 'drop-off-only' | 'no-service'`
(`StopServiceState`). It is per-stop/collection ("does this stop have any
boardable entry today"), already an interpreted rollup via
`isBoardableForPassenger`, and is NOT a per-stop-event state.

## Decision (Issue #162 item 3)

**Do not introduce a per-stop-event operational-state enum** (the
`regular` / `drop-off-only` / `boarding-only` / `pass-through`
normalization). Keep the axes separate; if a surface ever needs a single
operational label, derive it in the presentation layer as an
inference-inclusive value, kept distinct from the explicit-signal
pass-through (`isNoPassengerService`).

Rationale:

- **No consumer needs it.** Stats, the verbose dump, filters, and labels
  are all served by the separate axes. A per-event enum would be premature
  abstraction.
- **It would collapse the two axes.** A single `drop-off-only` value folds
  faithful position, faithful signal, and interpreted boardability into one
  bucket -- exactly the layer-mixing Issue #162 set out to remove.
- **Vocabulary duplication.** It would overlap the existing collection-level
  `TimetableEntriesState` (same value names, different scope).
- **Fragile to Issue #145.** When the feed-boundary rule changes, a single
  enum's definition would need reworking; separate axes simply let the
  faithful "terminal" fact and the interpreted "boardable" value coexist.

This is not permanent: a concrete per-event operational-label need, plus a
resolved Issue #145, could justify revisiting it (likely as a presentation
-layer derivation that rolls up into the collection-level state).

## StopServiceType 2/3 (Issue #162 item 4)

Arrangement-required values (2 = phone agency, 3 = coordinate with driver)
are treated as boardable/alightable on a **separate restriction axis**
(`requiresArrangement`), not as distinct states. A future operational
label, if ever derived, would treat 2/3 as "available with restriction",
not its own state.

## Caveat: explicit 1/1 is source- AND trip-dependent

`isNoPassengerService` returns true for explicit `pickup_type === 1 &&
drop_off_type === 1`. GTFS Best Practices cite deadhead trips / internal
timing points / garages as the canonical referents, but a true return does
NOT guarantee "no passenger service" in reality. Measured on the
2026-06-13 feed:

- 360 rows of 1/1 exist, only in `ktbus` (関東バス, 316) and `tome`
  (Tokyo Metro, 44); the other 45 sources omit pickup/drop-off signals.
- `tome` uses 1/1 to mark **through-service feed boundaries** (Kita-Senju /
  Yoyogi-Uehara / Kotake-Mukaihara), not deadhead/garage. The real meaning
  varies trip by trip:
    - Express (Metro Hakone Romancecar, pattern `tome:p117`) genuinely passes
      Yoyogi-Uehara without serving it -- a real no-stop.
    - Local (`tome:p107` toward Hon-Atsugi) marks the same real, used
      interchange stop 1/1 -- a feed-boundary artifact, not a real
      no-service.

Therefore `isNoPassengerService` must not be used as a standalone
cross-source "is this a pass-through" test; it needs source/trip context.
The explicit-signal pass-through (faithful) and any derived pass-through
(interpreted) must stay distinct. Per-source resolution is Issue #145.

## Related / out of scope

- **Issue #145** -- per-source feed-boundary signal-trust policy. Required
  to release through-service boarding ("terminal but boardable"); not a
  prerequisite for this spec.
- **Passenger-axis display component** -- a display part for the passenger
  axis parallel to the faithful `TimetableEntryAttributesLabels` (so
  "terminal" and "boardable" can be shown side by side). A follow-up
  enhancement, tracked separately, not part of Issue #162.
