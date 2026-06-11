import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { computeStopsCounts } from '../domain/transit/compute-stops-counts';
import { DEFAULT_VIEW_ID } from '../domain/transit/stop-time-views';
import {
  agencyOretetsu,
  agencyTobus,
  baseStop,
  busRoute,
  busRoute2,
  createEntry,
  longNameStop,
  storyMapCenter,
  storyNow,
  tramRoute,
} from '../stories/fixtures';
import type { GlobalFilter } from '../types/app/global-filter';
import type { AppRouteTypeValue, Stop, TimetableEntriesState } from '../types/app/transit';
import type { ContextualTimetableEntry, StopWithContext } from '../types/app/transit-composed';
import { StopBrowser } from './stop-browser';

function createGlobalFilter(overrides: Partial<GlobalFilter> = {}): GlobalFilter {
  return {
    showOriginOnly: false,
    showBoardableOnly: false,
    omitEmptyStops: false,
    isOmitEmptyStopsForced: false,
    onToggleShowOriginOnly: fn(),
    onToggleShowBoardableOnly: fn(),
    onToggleOmitEmptyStops: fn(),
    ...overrides,
  };
}

function createStoryStop(
  stop: Stop,
  overrides: Partial<{
    routeTypes: AppRouteTypeValue[];
    stopTimes: ContextualTimetableEntry[];
    distance: number;
  }> = {},
): StopWithContext {
  const stopTimes = overrides.stopTimes ?? [
    createEntry({ departureMinutes: 870, route: busRoute, headsign: '大塚駅前' }),
    createEntry({ departureMinutes: 882, route: busRoute2, headsign: '日暮里駅前' }),
    createEntry({ departureMinutes: 895, route: busRoute, headsign: '大塚駅前' }),
  ];

  const routes = [
    ...new Map(
      stopTimes.map((entry) => [entry.routeDirection.route.route_id, entry.routeDirection.route]),
    ).values(),
  ];
  const agencyIds = new Set(routes.map((route) => route.agency_id));
  const agencies = [agencyTobus, agencyOretetsu].filter((agency) =>
    agencyIds.has(agency.agency_id),
  );

  return {
    stop,
    distance: overrides.distance ?? 240,
    agencies: agencies.length > 0 ? agencies : [agencyTobus],
    routes,
    routeTypes: overrides.routeTypes ?? ([3] as AppRouteTypeValue[]),
    stopTimes,
    stopServiceState: stopTimes.length > 0 ? 'boardable' : 'no-service',
  };
}

const nearbyStops: StopWithContext[] = [
  createStoryStop(baseStop, { distance: 120 }),
  createStoryStop(
    {
      ...baseStop,
      stop_id: 'stop-002',
      stop_name: '錦糸町駅北口',
      stop_names: { ja: '錦糸町駅北口', en: 'Kinshicho Sta. North Exit' },
      stop_lat: 35.697,
      stop_lon: 139.813,
    },
    {
      distance: 280,
      stopTimes: [
        createEntry({ departureMinutes: 875, route: busRoute2, headsign: '日暮里駅前' }),
        createEntry({ departureMinutes: 904, route: busRoute2, headsign: '日暮里駅前' }),
      ],
    },
  ),
  createStoryStop(
    {
      ...baseStop,
      stop_id: 'stop-003',
      stop_name: '亀戸駅前',
      stop_names: { ja: '亀戸駅前', en: 'Kameido Sta.' },
      stop_lat: 35.6976,
      stop_lon: 139.8266,
    },
    {
      distance: 640,
      routeTypes: [0] as AppRouteTypeValue[],
      stopTimes: [
        createEntry({ departureMinutes: 880, route: tramRoute, headsign: '早稲田' }),
        createEntry({ departureMinutes: 910, route: tramRoute, headsign: '早稲田' }),
      ],
    },
  ),
  createStoryStop(longNameStop, {
    distance: 880,
    routeTypes: [0, 3] as AppRouteTypeValue[],
    stopTimes: [
      createEntry({ departureMinutes: 878, route: busRoute, headsign: '大塚駅前' }),
      createEntry({ departureMinutes: 886, route: tramRoute, headsign: '三ノ輪橋' }),
    ],
  }),
];

const emptyStops: StopWithContext[] = [
  createStoryStop(baseStop, { stopTimes: [] }),
  createStoryStop({ ...longNameStop, stop_id: 'stop-empty-long' }, { stopTimes: [] }),
];

function createTimetableEntriesStateByStopId(
  stops: readonly StopWithContext[],
  fallback: TimetableEntriesState = 'boardable',
): ReadonlyMap<string, TimetableEntriesState> {
  return new Map(
    stops.map((stop) => [stop.stop.stop_id, stop.stopTimes.length > 0 ? fallback : 'no-service']),
  );
}

const defaultCounts = computeStopsCounts(nearbyStops);
const emptyCounts = computeStopsCounts(emptyStops);

const meta = {
  title: 'StopBrowser/StopBrowser',
  component: StopBrowser,
  args: {
    stopTimes: nearbyStops,
    timetableEntriesStateByStopId: createTimetableEntriesStateByStopId(nearbyStops),
    selectedStopId: null,
    isNearbyLoading: false,
    hasNearbyLoaded: true,
    stopsRadius: 1_000,
    now: storyNow,
    mapCenter: storyMapCenter,
    infoLevel: 'normal',
    dataLangs: ['ja'],
    anchorIds: new Set<string>(),
    globalFilter: createGlobalFilter(),
    nearbyStopsCounts: defaultCounts,
    filteredNearbyStopsCounts: defaultCounts,
    onStopSelected: fn(),
    onShowTimetable: fn(),
    onShowStopTimetable: fn(),
    onToggleAnchor: fn(),
    onOpenTripInspectionByStopId: fn(),
    onInspectTrip: fn(),
    stopBrowserState: {
      viewId: DEFAULT_VIEW_ID,
      hiddenRouteTypes: new Set<number>(),
      hiddenAgencyIds: new Set<string>(),
    },
    onStopBrowserStateChange: fn(),
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    hasNearbyLoaded: { control: 'boolean' },
    selectedStopId: { control: 'text' },
    stopsRadius: { control: { type: 'number', min: 0, step: 100 } },
  },
  decorators: [
    (Story) => (
      <div className="h-160 max-w-md rounded-lg bg-white py-2 shadow-sm dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopBrowser>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Loading: Story = {
  args: {
    hasNearbyLoaded: false,
    stopTimes: [],
    timetableEntriesStateByStopId: new Map<string, TimetableEntriesState>(),
    nearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    filteredNearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
  },
};

export const NoStops: Story = {
  args: {
    stopTimes: [],
    timetableEntriesStateByStopId: new Map<string, TimetableEntriesState>(),
    nearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
    filteredNearbyStopsCounts: { total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 },
  },
};

export const NoOperatingStops: Story = {
  args: {
    stopTimes: emptyStops,
    timetableEntriesStateByStopId: createTimetableEntriesStateByStopId(emptyStops),
    globalFilter: createGlobalFilter({ omitEmptyStops: true }),
    nearbyStopsCounts: emptyCounts,
    filteredNearbyStopsCounts: emptyCounts,
  },
};

export const SelectedAndAnchored: Story = {
  args: {
    selectedStopId: nearbyStops[1].stop.stop_id,
    anchorIds: new Set<string>([nearbyStops[1].stop.stop_id]),
  },
};

// --- Filters ---

export const OperatingOnlyActive: Story = {
  args: {
    globalFilter: createGlobalFilter({ omitEmptyStops: true }),
    filteredNearbyStopsCounts: { ...defaultCounts, total: defaultCounts.nonEmpty },
  },
};

export const OriginOnlyActive: Story = {
  args: {
    globalFilter: createGlobalFilter({ showOriginOnly: true }),
    stopTimes: nearbyStops.map((stop, index) => ({
      ...stop,
      stopTimes: stop.stopTimes.map((entry) => ({
        ...entry,
        patternPosition: { ...entry.patternPosition, isFirstStop: index === 0 },
      })),
    })),
  },
};

export const MultiRouteTypesAndAgencies: Story = {
  args: {
    stopTimes: nearbyStops,
    infoLevel: 'detailed',
  },
};

// --- Info levels ---

export const InfoLevelSimple: Story = {
  args: { infoLevel: 'simple' },
};

export const InfoLevelDetailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const InfoLevelVerbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Kitchen sink ---

const kitchenSinkStops = nearbyStops.map((stop, index) => ({
  ...stop,
  distance: stop.distance != null ? stop.distance + index * 120 : undefined,
}));
const kitchenSinkCounts = computeStopsCounts(kitchenSinkStops);

const kitchenSinkArgs = {
  stopTimes: kitchenSinkStops,
  timetableEntriesStateByStopId: createTimetableEntriesStateByStopId(kitchenSinkStops),
  selectedStopId: kitchenSinkStops[3].stop.stop_id,
  anchorIds: new Set<string>([kitchenSinkStops[0].stop.stop_id, kitchenSinkStops[3].stop.stop_id]),
  globalFilter: createGlobalFilter({ omitEmptyStops: true }),
  nearbyStopsCounts: kitchenSinkCounts,
  filteredNearbyStopsCounts: kitchenSinkCounts,
  stopsRadius: 2_000,
};

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
