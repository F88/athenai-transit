/**
 * ODPT StationTimetable pattern analysis.
 *
 * Provides pure functions to analyze ODPT StationTimetable data such as
 * time field availability, station/direction/calendar coverage,
 * destination and train type distributions, and unknown key detection.
 * Used by the analyze-odpt-station-timetable CLI script.
 */

import type {
  OdptRailway,
  OdptStationTimetable,
  OdptStationTimetableObject,
} from '../../../src/types/odpt-train';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Time field (arrivalTime / departureTime) availability. */
export interface TimeFieldSummary {
  totalObjects: number;
  withArrivalTime: number;
  withDepartureTime: number;
  withBoth: number;
  withNeither: number;
}

/** Station coverage: how many stations in stationOrder have timetables. */
export interface StationCoverage {
  /** Stations listed in railway stationOrder. */
  stationOrderCount: number;
  /** Stations that have at least one timetable entry. */
  stationsWithTimetable: number;
  /** Station IDs in stationOrder that lack any timetable. */
  missingStations: string[];
}

/** Direction coverage per station. */
export interface DirectionCoverageEntry {
  station: string;
  hasOutbound: boolean;
  hasInbound: boolean;
}

export interface DirectionCoverage {
  entries: DirectionCoverageEntry[];
  /** Stations with only Outbound (likely last station in ascending order). */
  outboundOnly: string[];
  /** Stations with only Inbound (likely first station in ascending order). */
  inboundOnly: string[];
}

/** Calendar coverage: which calendar types appear per station. */
export interface CalendarCoverage {
  /** All unique calendar IDs found. */
  calendarIds: string[];
  /** Number of stations with all calendar types. */
  stationsWithAllCalendars: number;
  /** Stations missing some calendar types: station -> missing calendars. */
  stationsMissingCalendars: Array<{ station: string; missing: string[] }>;
}

/** Destination distribution. */
export interface DestinationEntry {
  destination: string;
  count: number;
}

export interface DestinationSummary {
  totalObjectsWithDestination: number;
  totalObjectsWithoutDestination: number;
  uniqueDestinations: number;
  top: DestinationEntry[];
}

/** Train type distribution. */
export interface TrainTypeEntry {
  trainType: string;
  count: number;
}

export interface TrainTypeSummary {
  totalObjectsWithTrainType: number;
  totalObjectsWithoutTrainType: number;
  uniqueTrainTypes: number;
  top: TrainTypeEntry[];
}

/** isLast / isOrigin flag availability. */
export interface FlagSummary {
  totalObjects: number;
  withIsLast: number;
  withIsOrigin: number;
}

/** Unknown keys detection. */
export interface UnknownKeysEntry {
  key: string;
  /** Number of timetable objects containing this key. */
  count: number;
}

export interface UnknownKeysSummary {
  /** Unknown keys found in OdptStationTimetableObject entries. */
  objectKeys: UnknownKeysEntry[];
  /** Unknown keys found in top-level OdptStationTimetable entries. */
  timetableKeys: UnknownKeysEntry[];
}

/** Full analysis result for a single ODPT Train source. */
export interface OdptStationTimetableAnalysis {
  timeFields: TimeFieldSummary;
  stationCoverage: StationCoverage;
  directionCoverage: DirectionCoverage;
  calendarCoverage: CalendarCoverage;
  destinations: DestinationSummary;
  trainTypes: TrainTypeSummary;
  flags: FlagSummary;
  unknownKeys: UnknownKeysSummary;
}

export const ODPT_STATION_TIMETABLE_SECTION_NAMES = [
  'time-field-availability',
  'station-coverage',
  'direction-coverage',
  'calendar-coverage',
  'destination-distribution',
  'train-type-distribution',
  'flags',
  'unknown-keys',
] as const;

export type OdptStationTimetableSectionName = (typeof ODPT_STATION_TIMETABLE_SECTION_NAMES)[number];

// ---------------------------------------------------------------------------
// Known keys (ODPT API Spec v4.15 Section 3.3.6)
// ---------------------------------------------------------------------------

/** Known keys for OdptStationTimetableObject. */
const KNOWN_OBJECT_KEYS = new Set([
  'odpt:arrivalTime',
  'odpt:departureTime',
  'odpt:originStation',
  'odpt:destinationStation',
  'odpt:viaStation',
  'odpt:trainType',
  'odpt:trainNumber',
  'odpt:platformNumber',
  'odpt:platformName',
  'odpt:note',
  'odpt:isLast',
  'odpt:isOrigin',
]);

/** Known keys for OdptStationTimetable (top-level). */
const KNOWN_TIMETABLE_KEYS = new Set([
  '@context',
  '@id',
  '@type',
  'dc:date',
  'dct:issued',
  'owl:sameAs',
  'odpt:operator',
  'odpt:railway',
  'odpt:station',
  'odpt:calendar',
  'odpt:railDirection',
  'odpt:stationTimetableObject',
]);

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Run full StationTimetable analysis.
 *
 * @param timetables - ODPT StationTimetable entries for a single source.
 * @param railway - ODPT Railway definition used for station order and direction mapping.
 * @returns Comprehensive analysis covering time fields, coverage, destinations,
 *   train types, flags, and unknown keys.
 */
export function analyzeOdptStationTimetable(
  timetables: OdptStationTimetable[],
  railway: OdptRailway,
): OdptStationTimetableAnalysis {
  return {
    timeFields: analyzeTimeFields(timetables),
    stationCoverage: analyzeStationCoverage(timetables, railway),
    directionCoverage: analyzeDirectionCoverage(timetables, railway),
    calendarCoverage: analyzeCalendarCoverage(timetables, railway),
    destinations: analyzeDestinations(timetables),
    trainTypes: analyzeTrainTypes(timetables),
    flags: analyzeFlags(timetables),
    unknownKeys: detectUnknownKeys(timetables),
  };
}

// ---------------------------------------------------------------------------
// Individual analyses
// ---------------------------------------------------------------------------

/** Collect all timetable objects from all timetables. */
function collectAllObjects(timetables: OdptStationTimetable[]): OdptStationTimetableObject[] {
  return timetables.flatMap((tt) => tt['odpt:stationTimetableObject']);
}

function analyzeTimeFields(timetables: OdptStationTimetable[]): TimeFieldSummary {
  const objects = collectAllObjects(timetables);
  let withArr = 0;
  let withDep = 0;
  let withBoth = 0;
  let withNeither = 0;

  for (const obj of objects) {
    const hasArr = obj['odpt:arrivalTime'] != null;
    const hasDep = obj['odpt:departureTime'] != null;
    if (hasArr) {
      withArr++;
    }
    if (hasDep) {
      withDep++;
    }
    if (hasArr && hasDep) {
      withBoth++;
    }
    if (!hasArr && !hasDep) {
      withNeither++;
    }
  }

  return {
    totalObjects: objects.length,
    withArrivalTime: withArr,
    withDepartureTime: withDep,
    withBoth,
    withNeither,
  };
}

function analyzeStationCoverage(
  timetables: OdptStationTimetable[],
  railway: OdptRailway,
): StationCoverage {
  const stationOrderIds = railway['odpt:stationOrder'].map((so) => so['odpt:station']);
  const stationsInTimetable = new Set(timetables.map((tt) => tt['odpt:station']));
  const missing = stationOrderIds.filter((id) => !stationsInTimetable.has(id));

  return {
    stationOrderCount: stationOrderIds.length,
    stationsWithTimetable: new Set(stationOrderIds.filter((id) => stationsInTimetable.has(id)))
      .size,
    missingStations: missing,
  };
}

function analyzeDirectionCoverage(
  timetables: OdptStationTimetable[],
  railway: OdptRailway,
): DirectionCoverage {
  const stationOrderIds = railway['odpt:stationOrder'].map((so) => so['odpt:station']);

  // Collect directions per station
  const directionMap = new Map<string, Set<string>>();
  for (const tt of timetables) {
    let dirs = directionMap.get(tt['odpt:station']);
    if (!dirs) {
      dirs = new Set();
      directionMap.set(tt['odpt:station'], dirs);
    }
    dirs.add(tt['odpt:railDirection']);
  }

  const entries: DirectionCoverageEntry[] = [];
  const outboundOnly: string[] = [];
  const inboundOnly: string[] = [];

  for (const stationId of stationOrderIds) {
    const dirs = directionMap.get(stationId);
    const hasOutbound = dirs?.has('odpt.RailDirection:Outbound') ?? false;
    const hasInbound = dirs?.has('odpt.RailDirection:Inbound') ?? false;

    entries.push({ station: stationId, hasOutbound, hasInbound });

    if (hasOutbound && !hasInbound) {
      outboundOnly.push(stationId);
    }
    if (hasInbound && !hasOutbound) {
      inboundOnly.push(stationId);
    }
  }

  return { entries, outboundOnly, inboundOnly };
}

function analyzeCalendarCoverage(
  timetables: OdptStationTimetable[],
  railway: OdptRailway,
): CalendarCoverage {
  const stationOrderIds = railway['odpt:stationOrder'].map((so) => so['odpt:station']);

  // Collect all calendar IDs
  const allCalendars = new Set(timetables.map((tt) => tt['odpt:calendar']));
  const calendarIds = [...allCalendars].sort();

  // Collect calendars per station
  const calendarMap = new Map<string, Set<string>>();
  for (const tt of timetables) {
    let cals = calendarMap.get(tt['odpt:station']);
    if (!cals) {
      cals = new Set();
      calendarMap.set(tt['odpt:station'], cals);
    }
    cals.add(tt['odpt:calendar']);
  }

  let stationsWithAll = 0;
  const stationsMissing: Array<{ station: string; missing: string[] }> = [];

  for (const stationId of stationOrderIds) {
    const cals = calendarMap.get(stationId);
    if (!cals) {
      stationsMissing.push({ station: stationId, missing: calendarIds });
      continue;
    }
    const missing = calendarIds.filter((c) => !cals.has(c));
    if (missing.length === 0) {
      stationsWithAll++;
    } else {
      stationsMissing.push({ station: stationId, missing });
    }
  }

  return {
    calendarIds,
    stationsWithAllCalendars: stationsWithAll,
    stationsMissingCalendars: stationsMissing,
  };
}

function analyzeDestinations(timetables: OdptStationTimetable[]): DestinationSummary {
  const objects = collectAllObjects(timetables);
  const counts = new Map<string, number>();
  let withDest = 0;
  let withoutDest = 0;

  for (const obj of objects) {
    const dests = obj['odpt:destinationStation'];
    if (dests && dests.length > 0) {
      withDest++;
      const key = dests.join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else {
      withoutDest++;
    }
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([destination, count]) => ({ destination, count }));

  return {
    totalObjectsWithDestination: withDest,
    totalObjectsWithoutDestination: withoutDest,
    uniqueDestinations: sorted.length,
    top: sorted,
  };
}

function analyzeTrainTypes(timetables: OdptStationTimetable[]): TrainTypeSummary {
  const objects = collectAllObjects(timetables);
  const counts = new Map<string, number>();
  let withType = 0;
  let withoutType = 0;

  for (const obj of objects) {
    const tt = obj['odpt:trainType'];
    if (tt) {
      withType++;
      counts.set(tt, (counts.get(tt) ?? 0) + 1);
    } else {
      withoutType++;
    }
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([trainType, count]) => ({ trainType, count }));

  return {
    totalObjectsWithTrainType: withType,
    totalObjectsWithoutTrainType: withoutType,
    uniqueTrainTypes: sorted.length,
    top: sorted,
  };
}

function analyzeFlags(timetables: OdptStationTimetable[]): FlagSummary {
  const objects = collectAllObjects(timetables);
  let withIsLast = 0;
  let withIsOrigin = 0;

  for (const obj of objects) {
    if (obj['odpt:isLast'] != null) {
      withIsLast++;
    }
    if (obj['odpt:isOrigin'] != null) {
      withIsOrigin++;
    }
  }

  return { totalObjects: objects.length, withIsLast, withIsOrigin };
}

function detectUnknownKeys(timetables: OdptStationTimetable[]): UnknownKeysSummary {
  // Object-level unknown keys
  const objectKeyCounts = new Map<string, number>();
  for (const tt of timetables) {
    for (const obj of tt['odpt:stationTimetableObject']) {
      for (const key of Object.keys(obj)) {
        if (!KNOWN_OBJECT_KEYS.has(key)) {
          objectKeyCounts.set(key, (objectKeyCounts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  // Timetable-level unknown keys
  const timetableKeyCounts = new Map<string, number>();
  for (const tt of timetables) {
    for (const key of Object.keys(tt)) {
      if (!KNOWN_TIMETABLE_KEYS.has(key)) {
        timetableKeyCounts.set(key, (timetableKeyCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const toEntries = (map: Map<string, number>): UnknownKeysEntry[] =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));

  return {
    objectKeys: toEntries(objectKeyCounts),
    timetableKeys: toEntries(timetableKeyCounts),
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format analysis result as human-readable text.
 *
 * @param sourceName - Display name of the ODPT Train source (used as the report header).
 * @param analysis - Analysis result from {@link analyzeOdptStationTimetable}.
 * @returns Multi-line formatted string suitable for console output or file writing.
 */
export function formatOdptAnalysis(
  sourceName: string,
  analysis: OdptStationTimetableAnalysis,
  options: { sections?: OdptStationTimetableSectionName[] } = {},
): string {
  const lines: string[] = [];
  const {
    timeFields,
    stationCoverage,
    directionCoverage,
    calendarCoverage,
    destinations,
    trainTypes,
    flags,
    unknownKeys,
  } = analysis;
  const requestedSections = new Set(
    options.sections === undefined || options.sections.length === 0
      ? ODPT_STATION_TIMETABLE_SECTION_NAMES
      : options.sections,
  );

  lines.push(`=== ${sourceName} ===`);
  lines.push('');

  // #1 Time Fields
  if (requestedSections.has('time-field-availability')) {
    lines.push('## Time Field Availability');
    lines.push(`  Total objects:        ${timeFields.totalObjects}`);
    lines.push(`  With arrivalTime:     ${timeFields.withArrivalTime}`);
    lines.push(`  With departureTime:   ${timeFields.withDepartureTime}`);
    lines.push(`  With both:            ${timeFields.withBoth}`);
    lines.push(`  With neither:         ${timeFields.withNeither}`);
    lines.push('');
  }

  // #2 Station Coverage
  if (requestedSections.has('station-coverage')) {
    lines.push('## Station Coverage');
    lines.push(`  Station order count:      ${stationCoverage.stationOrderCount}`);
    lines.push(`  Stations with timetable:  ${stationCoverage.stationsWithTimetable}`);
    if (stationCoverage.missingStations.length > 0) {
      lines.push(`  Missing stations (${stationCoverage.missingStations.length}):`);
      for (const s of stationCoverage.missingStations) {
        lines.push(`    ${s}`);
      }
    } else {
      lines.push('  Missing stations: (none)');
    }
    lines.push('');
  }

  // #3 Direction Coverage
  if (requestedSections.has('direction-coverage')) {
    lines.push('## Direction Coverage');
    if (directionCoverage.outboundOnly.length > 0) {
      lines.push(`  Outbound only (${directionCoverage.outboundOnly.length}):`);
      for (const s of directionCoverage.outboundOnly) {
        lines.push(`    ${s}`);
      }
    }
    if (directionCoverage.inboundOnly.length > 0) {
      lines.push(`  Inbound only (${directionCoverage.inboundOnly.length}):`);
      for (const s of directionCoverage.inboundOnly) {
        lines.push(`    ${s}`);
      }
    }
    if (directionCoverage.outboundOnly.length === 0 && directionCoverage.inboundOnly.length === 0) {
      lines.push('  All stations have both directions');
    }
    lines.push('');
  }

  // #4 Calendar Coverage
  if (requestedSections.has('calendar-coverage')) {
    lines.push('## Calendar Coverage');
    lines.push(`  Calendar types: ${calendarCoverage.calendarIds.join(', ')}`);
    lines.push(`  Stations with all calendars: ${calendarCoverage.stationsWithAllCalendars}`);
    if (calendarCoverage.stationsMissingCalendars.length > 0) {
      lines.push(
        `  Stations missing calendars (${calendarCoverage.stationsMissingCalendars.length}):`,
      );
      for (const entry of calendarCoverage.stationsMissingCalendars.slice(0, 20)) {
        lines.push(`    ${entry.station}: missing ${entry.missing.join(', ')}`);
      }
      if (calendarCoverage.stationsMissingCalendars.length > 20) {
        lines.push(`    ... and ${calendarCoverage.stationsMissingCalendars.length - 20} more`);
      }
    }
    lines.push('');
  }

  // #5 Destinations
  if (requestedSections.has('destination-distribution')) {
    lines.push('## Destination Distribution');
    lines.push(`  With destination:    ${destinations.totalObjectsWithDestination}`);
    lines.push(`  Without destination: ${destinations.totalObjectsWithoutDestination}`);
    lines.push(`  Unique destinations: ${destinations.uniqueDestinations}`);
    if (destinations.top.length > 0) {
      lines.push('  Top destinations:');
      for (const d of destinations.top.slice(0, 20)) {
        lines.push(`    ${d.destination} (${d.count})`);
      }
      if (destinations.top.length > 20) {
        lines.push(`    ... and ${destinations.top.length - 20} more`);
      }
    }
    lines.push('');
  }

  // #6 Train Types
  if (requestedSections.has('train-type-distribution')) {
    lines.push('## Train Type Distribution');
    lines.push(`  With trainType:    ${trainTypes.totalObjectsWithTrainType}`);
    lines.push(`  Without trainType: ${trainTypes.totalObjectsWithoutTrainType}`);
    lines.push(`  Unique types:      ${trainTypes.uniqueTrainTypes}`);
    if (trainTypes.top.length > 0) {
      lines.push('  Train types:');
      for (const t of trainTypes.top.slice(0, 20)) {
        lines.push(`    ${t.trainType} (${t.count})`);
      }
      if (trainTypes.top.length > 20) {
        lines.push(`    ... and ${trainTypes.top.length - 20} more`);
      }
    }
    lines.push('');
  }

  // #7 Flags
  if (requestedSections.has('flags')) {
    lines.push('## isLast / isOrigin Flags');
    lines.push(`  Total objects:   ${flags.totalObjects}`);
    lines.push(`  With isLast:     ${flags.withIsLast}`);
    lines.push(`  With isOrigin:   ${flags.withIsOrigin}`);
    lines.push('');
  }

  // #8 Unknown Keys
  if (requestedSections.has('unknown-keys')) {
    lines.push('## Unknown Keys');
    if (unknownKeys.timetableKeys.length > 0) {
      lines.push('  Timetable-level:');
      for (const k of unknownKeys.timetableKeys) {
        lines.push(`    ${k.key} (${k.count})`);
      }
    }
    if (unknownKeys.objectKeys.length > 0) {
      lines.push('  Object-level:');
      for (const k of unknownKeys.objectKeys) {
        lines.push(`    ${k.key} (${k.count})`);
      }
    }
    if (unknownKeys.timetableKeys.length === 0 && unknownKeys.objectKeys.length === 0) {
      lines.push('  (none)');
    }
    lines.push('');
  }

  return lines.join('\n');
}
