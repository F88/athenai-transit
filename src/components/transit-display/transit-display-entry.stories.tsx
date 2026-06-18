import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type {
  TransitDisplayDatum,
  TransitDisplayMeta,
} from '../../domain/transit/transit-info-display/build-transit-display-data';
import {
  agencyGx,
  agencyNoColor,
  agencyOretetsu,
  agencyTobus,
  baseStop,
  busRoute,
  createEntry,
  emptyHeadsign,
  headsignShort,
  longNameStop,
  noColorRoute,
  railRoute,
  stopHeadsignLong,
  stopHeadsignShort,
  storyMapCenter,
  storyNow,
  tramRoute,
  tripHeadsignLong,
} from '../../stories/fixtures';
import type { Agency, Route, Stop } from '../../types/app/transit';
import type { StopServiceType, TranslatableText } from '../../types/app/transit-composed';
import { TransitDisplayEntry } from './transit-display-entry';

/** Flat override knobs for {@link makeDatum}, assembled into the raw row shape. */
interface MakeDatumOverrides {
  stop?: Stop;
  route?: Route;
  agency?: Agency;
  distance?: number;
  tripHeadsign?: TranslatableText;
  stopHeadsign?: TranslatableText;
  departureMinutes?: number;
  arrivalMinutes?: number;
  stopIndex?: number;
  isLastStop?: boolean;
  isFirstStop?: boolean;
  pickupType?: StopServiceType;
  dropOffType?: StopServiceType;
}

/**
 * Build a raw {@link TransitDisplayDatum} for stories.
 *
 * Unlike the classic view, `TransitDisplayEntry` consumes RAW data and resolves
 * names / colors at the leaf via `dataLangs`, so stories construct the unresolved
 * candidate ({@link createEntry} entry + its {@link StopWithContext}) rather than
 * a presentational row. `agency` is kept in the stop context so the route agency
 * (matched by `agency_id`) resolves for the AgencyBadge.
 */
function makeDatum(overrides: MakeDatumOverrides = {}): TransitDisplayDatum {
  const route = overrides.route ?? busRoute;
  const agency = overrides.agency ?? agencyTobus;
  const entry = createEntry({
    route,
    tripHeadsign: overrides.tripHeadsign,
    stopHeadsign: overrides.stopHeadsign,
    departureMinutes: overrides.departureMinutes,
    arrivalMinutes: overrides.arrivalMinutes,
    stopIndex: overrides.stopIndex,
    isLastStop: overrides.isLastStop,
    isFirstStop: overrides.isFirstStop,
    pickupType: overrides.pickupType,
    dropOffType: overrides.dropOffType,
  });
  return {
    timetableEntry: entry,
    stop: {
      stop: overrides.stop ?? baseStop,
      distance: overrides.distance ?? 235,
      agencies: [agency],
      routes: [route],
      routeTypes: [route.route_type],
      stopTimes: [],
      stopServiceState: 'boardable',
    },
  };
}

/** Assemble a {@link TransitDisplayMeta} from overrides. */
function makeMeta(overrides: Partial<TransitDisplayMeta> = {}): TransitDisplayMeta {
  return {
    category: 'departures',
    routeTypes: [3],
    routes: [],
    directions: [0],
    selection: {
      radiusMeters: 100,
      maxEntries: 20,
      splitByRoute: false,
      splitByDirection: false,
    },
    ...overrides,
  };
}

const meta = {
  title: 'TransitDisplay/TransitDisplayEntry',
  component: TransitDisplayEntry,
  args: {
    data: makeDatum(),
    meta: makeMeta(),
    dataLangs: ['ja'],
    now: storyNow,
    mapCenter: storyMapCenter,
    infoLevel: 'normal' as const,
    size: 'md' as const,
    onStopSelected: fn(),
    onInspectTrip: fn(),
  },
  argTypes: {
    data: { control: 'object' },
    meta: { control: 'object' },
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
  },
  // TransitDisplayEntry renders an <li>; wrap in a <ul> on the board's
  // theme-aware panel face, mirroring the parent TransitDisplay body.
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-sm bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <ul className="m-0 list-none p-0">
          <Story />
        </ul>
      </div>
    ),
  ],
} satisfies Meta<typeof TransitDisplayEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

/** Default: a single bus departure row. Use Controls to tweak any field. */
export const Default: Story = {};

// --- Variants ---

/** Arrival row: the single time shown is the arrival time (the board's basis). */
export const ArrivalRow: Story = {
  args: {
    data: makeDatum({ isLastStop: true }),
    meta: makeMeta({ category: 'arrivals' }),
  },
};

/** Rail row: route / agency colors and badges follow the trip's route + agency. */
export const TrainRow: Story = {
  args: {
    data: makeDatum({ route: railRoute, agency: agencyGx, distance: 410 }),
    meta: makeMeta({ routeTypes: [2] }),
  },
};

/** Tram row: a different route type, color, and operating agency. */
export const TramRow: Story = {
  args: {
    data: makeDatum({ route: tramRoute, agency: agencyOretetsu }),
    meta: makeMeta({ routeTypes: [0] }),
  },
};

// --- Headsign states ---

/** Trip-only headsign: the classic case (`trip_headsign` populated). */
export const HeadsignTripOnly: Story = {
  args: {
    data: makeDatum({ tripHeadsign: tripHeadsignLong }),
  },
};

/**
 * Stop-only headsign (Keio-bus pattern): `trip_headsign` is empty and
 * `stop_headsign` is promoted to the destination slot.
 */
export const HeadsignStopOnly: Story = {
  args: {
    data: makeDatum({ tripHeadsign: emptyHeadsign, stopHeadsign: stopHeadsignShort }),
  },
};

/** Both headsigns present: `stop_headsign` wins per GTFS (`prefer: 'stop'`). */
export const HeadsignBoth: Story = {
  args: {
    data: makeDatum({ tripHeadsign: tripHeadsignLong, stopHeadsign: stopHeadsignLong }),
  },
};

// --- Edge cases ---

/** Long stop name + long headsign exercise wrapping in the right / second columns. */
export const LongText: Story = {
  args: {
    data: makeDatum({ stop: longNameStop, tripHeadsign: tripHeadsignLong }),
  },
};

/** Single-character headsign — minimum-length rendering. */
export const ShortHeadsign: Story = {
  args: {
    data: makeDatum({ route: railRoute, agency: agencyGx, tripHeadsign: headsignShort }),
    meta: makeMeta({ routeTypes: [2] }),
  },
};

/** Route + agency without brand colors: the head bar falls back, badges stay readable. */
export const NoColor: Story = {
  args: {
    data: makeDatum({ route: noColorRoute, agency: agencyNoColor }),
  },
};

/** Platform code shown next to the stop name (longNameStop carries `platform_code`). */
export const WithPlatformCode: Story = {
  args: {
    data: makeDatum({ route: railRoute, agency: agencyGx, stop: longNameStop }),
    meta: makeMeta({ routeTypes: [2] }),
  },
};

/**
 * Verbose info level: the distance + direction badge and the pickup / drop-off
 * unavailability labels appear (hidden at lower levels).
 */
export const VerboseDistanceAndFlags: Story = {
  args: {
    data: makeDatum({ distance: 80, pickupType: 1, dropOffType: 1 }),
    infoLevel: 'verbose' as const,
  },
};

// --- Variants: size ---

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/**
 * The same row at every display size, smallest to largest: a short row that fits,
 * then a long-text row so truncation / wrapping can be read at each size.
 */
export const SizeComparison: Story = {
  render: (args) => (
    <>
      {SIZES.map((size) => (
        <TransitDisplayEntry
          key={`short-${size}`}
          data={makeDatum()}
          meta={args.meta}
          dataLangs={args.dataLangs}
          now={args.now}
          mapCenter={args.mapCenter}
          infoLevel={args.infoLevel}
          size={size}
          onStopSelected={args.onStopSelected}
          onInspectTrip={args.onInspectTrip}
        />
      ))}
      {SIZES.map((size) => (
        <TransitDisplayEntry
          key={`long-${size}`}
          data={makeDatum({ stop: longNameStop, tripHeadsign: tripHeadsignLong })}
          meta={args.meta}
          dataLangs={args.dataLangs}
          now={args.now}
          mapCenter={args.mapCenter}
          infoLevel={args.infoLevel}
          size={size}
          onStopSelected={args.onStopSelected}
          onInspectTrip={args.onInspectTrip}
        />
      ))}
    </>
  ),
};

// --- Kitchen sink ---

/**
 * Maximum-content row: long stop name + headsign, platform code, near distance,
 * and both pickup / drop-off unavailable so every label can appear. Rendered per
 * info level since the right-column badge and the unavailability flags are
 * verbose-only.
 */
const kitchenSinkArgs = {
  data: makeDatum({
    route: railRoute,
    agency: agencyGx,
    stop: longNameStop,
    tripHeadsign: tripHeadsignLong,
    stopHeadsign: stopHeadsignLong,
    distance: 12,
    isLastStop: true,
    isFirstStop: true,
    pickupType: 1 as StopServiceType,
    dropOffType: 1 as StopServiceType,
  }),
  meta: makeMeta({ routeTypes: [2] }),
} as const;

export const KitchenSinkInfoLevelSimple: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'simple' as const },
};
export const KitchenSinkInfoLevelNormal: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'normal' as const },
};
export const KitchenSinkInfoLevelDetailed: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'detailed' as const },
};
export const KitchenSinkInfoLevelVerbose: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'verbose' as const },
};
