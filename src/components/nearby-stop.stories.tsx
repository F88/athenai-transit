import type { Meta, StoryObj } from '@storybook/react-vite';
import type {
  ContextualTimetableEntry,
  StopServiceType,
  StopWithContext,
} from '../types/app/transit-composed';
import type { StopServiceState } from '../types/app/transit';
import type { Agency, Route, AppRouteTypeValue, Stop } from '../types/app/transit';
import {
  busRoute as fixtureBusRoute,
  busRoute2 as fixtureBusRoute2,
  createRouteDirection,
  tramRoute as fixtureTramRoute,
} from '../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison';
import { fn } from 'storybook/test';
import { NearbyStop } from './nearby-stop';

// --- Fixtures ---

const agency: Agency = {
  agency_id: 'agency-001',
  agency_name: '都営バス',
  agency_short_name: '都営',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: '00A850', text: 'FFFFFF' }],
};

const agency2: Agency = {
  agency_id: 'agency-002',
  agency_name: '京王バス',
  agency_short_name: '京王',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: 'E60012', text: 'FFFFFF' }],
};

const busRoute: Route = {
  ...fixtureBusRoute,
  route_short_names: {
    ja: fixtureBusRoute.route_short_name,
    en: 'To 02',
    ko: '도 02',
  },
  route_long_names: {
    ja: fixtureBusRoute.route_long_name,
    ...fixtureBusRoute.route_long_names,
  },
  agency_id: 'agency-001',
};

const busRoute2: Route = {
  ...fixtureBusRoute2,
  route_short_names: {
    ja: fixtureBusRoute2.route_short_name,
    en: 'To 08',
    ko: '도 08',
  },
  route_long_names: {
    ja: fixtureBusRoute2.route_long_name,
    ...fixtureBusRoute2.route_long_names,
  },
  agency_id: 'agency-001',
};

const tramRoute: Route = {
  ...fixtureTramRoute,
  route_short_names: {
    ja: fixtureTramRoute.route_short_name,
  },
  route_long_names: {
    ja: fixtureTramRoute.route_long_name,
    ...fixtureTramRoute.route_long_names,
  },
  agency_id: 'agency-002',
};

const baseStop: Stop = {
  stop_id: 'stop-001',
  stop_name: '錦糸町駅前',
  stop_names: { ja: '錦糸町駅前', 'ja-Hrkt': 'きんしちょうえきまえ', en: 'Kinshichō Sta.' },
  stop_lat: 35.6955,
  stop_lon: 139.8135,
  location_type: 0,
  agency_id: 'agency-001',
};

/** Long stop name for layout wrapping tests. Includes 6-language names matching real GTFS coverage (e.g. Kyoto City Bus). */
const longNameStop: Stop = {
  ...baseStop,
  stop_id: 'stop-long',
  stop_name: '東京都立産業技術研究センター前',
  stop_names: {
    ja: '東京都立産業技術研究センター前',
    'ja-Hrkt': 'とうきょうとりつさんぎょうぎじゅつけんきゅうせんたーまえ',
    en: 'Tokyo Metropolitan Industrial Technology Research Institute',
    ko: '도쿄도립산업기술연구센터앞',
    'zh-Hans': '东京都立产业技术研究中心前',
    'zh-Hant': '東京都立產業技術研究中心前',
  },
};

const localizedStop: Stop = {
  ...baseStop,
  stop_id: 'stop-i18n',
  stop_name: '北大路バスターミナル',
  stop_names: {
    ja: '北大路バスターミナル',
    'ja-Hrkt': 'きたおおじばすたーみなる',
    en: 'Kitaoji Bus Terminal',
    ko: '기타오지 버스 터미널',
    'zh-Hans': '北大路公交总站',
    'zh-Hant': '北大路公交總站',
  },
};

/** now = 14:25 */
const now = new Date('2026-03-30T14:25:00');

/** Map center ~70m west of the stop. */
const mapCenter = { lat: 35.6955, lng: 139.8127 };

function createEntry(
  overrides: Partial<{
    departureMinutes: number;
    arrivalMinutes: number;
    route: Route;
    headsign: string;
    stopHeadsign: string;
    pickupType: StopServiceType;
    dropOffType: StopServiceType;
    isTerminal: boolean;
    isOrigin: boolean;
    stopIndex: number;
    totalStops: number;
  }> = {},
): ContextualTimetableEntry {
  const depMin = overrides.departureMinutes ?? 870;
  return {
    schedule: {
      departureMinutes: depMin,
      arrivalMinutes: overrides.arrivalMinutes ?? depMin,
    },
    routeDirection: {
      route: overrides.route ?? busRoute,
      tripHeadsign: { name: overrides.headsign ?? '大塚駅前', names: {} },
      ...(overrides.stopHeadsign != null
        ? { stopHeadsign: { name: overrides.stopHeadsign, names: {} } }
        : {}),
    },
    boarding: {
      pickupType: overrides.pickupType ?? 0,
      dropOffType: overrides.dropOffType ?? 0,
    },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 3,
      totalStops: overrides.totalStops ?? 15,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    serviceDate: new Date('2026-03-30T00:00:00'),
  };
}

function createStopWithContext(
  overrides: Partial<{
    stop: Stop;
    routeTypes: AppRouteTypeValue[];
    departures: ContextualTimetableEntry[];
    stopServiceState: StopServiceState;
    agencies: Agency[];
    routes: Route[];
    distance: number;
  }> = {},
): StopWithContext {
  return {
    stop: overrides.stop ?? baseStop,
    routeTypes: overrides.routeTypes ?? [3],
    departures: overrides.departures ?? [
      createEntry({ departureMinutes: 870, headsign: '大塚駅前' }),
      createEntry({ departureMinutes: 885, headsign: '大塚駅前' }),
      createEntry({ departureMinutes: 900, headsign: '大塚駅前' }),
      createEntry({ departureMinutes: 872, route: busRoute2, headsign: '日暮里駅前' }),
      createEntry({ departureMinutes: 892, route: busRoute2, headsign: '日暮里駅前' }),
    ],
    stopServiceState: overrides.stopServiceState ?? 'boardable',
    agencies: overrides.agencies ?? [agency],
    routes: overrides.routes ?? [busRoute, busRoute2],
    distance: overrides.distance ?? 235,
  };
}

const localizedStopData: StopWithContext = createStopWithContext({
  stop: localizedStop,
  departures: [
    {
      ...createEntry({
        departureMinutes: 870,
        route: busRoute,
        headsign: '錦糸町駅前',
      }),
      routeDirection: createRouteDirection({
        route: busRoute,
        tripHeadsign: {
          name: '錦糸町駅前',
          names: {
            ja: '錦糸町駅前',
            'ja-Hrkt': 'きんしちょうえきまえ',
            en: 'Kinshicho Sta.',
            ko: '긴시초역',
            'zh-Hans': '锦丝町站前',
            'zh-Hant': '錦糸町站前',
          },
        },
      }),
    },
    {
      ...createEntry({
        departureMinutes: 878,
        route: busRoute2,
        headsign: '日暮里駅前',
      }),
      routeDirection: createRouteDirection({
        route: busRoute2,
        tripHeadsign: {
          name: '日暮里駅前',
          names: {
            ja: '日暮里駅前',
            'ja-Hrkt': 'にっぽりえきまえ',
            en: 'Nippori Sta.',
            ko: '닛포리역',
            'zh-Hans': '日暮里站前',
            'zh-Hant': '日暮里站前',
          },
        },
      }),
    },
  ],
  routes: [busRoute, busRoute2],
  agencies: [agency],
});

// --- Meta ---

const meta = {
  title: 'BottomSheet/NearbyStop',
  component: NearbyStop,
  args: {
    data: createStopWithContext(),
    isSelected: false,
    now,
    mapCenter,
    infoLevel: 'normal',
    dataLang: ['ja'],
    viewId: 'route-headsign',
    isAnchor: false,
    onStopSelected: fn(),
    onShowTimetable: fn(),
    onShowStopTimetable: fn(),
    onToggleAnchor: fn(),
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    viewId: { control: 'inline-radio', options: ['stop', 'route-headsign'] },
    isSelected: { control: 'boolean' },
    isAnchor: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NearbyStop>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Selected: Story = {
  args: { isSelected: true },
};

export const Anchored: Story = {
  args: { isAnchor: true },
};

export const SelectedAndAnchored: Story = {
  args: { isSelected: true, isAnchor: true },
};

// --- View modes ---

/** T1: Stop view — flat chronological list, max 5 items. */
export const StopView: Story = {
  args: { viewId: 'stop' },
};

/** T2: Route+Headsign view — grouped by route and headsign. */
export const RouteHeadsignView: Story = {
  args: { viewId: 'route-headsign' },
};

// --- Distance & direction ---

export const Near: Story = {
  args: {
    data: createStopWithContext({ distance: 12 }),
    mapCenter: { lat: 35.6955, lng: 139.8134 },
  },
};

export const Far: Story = {
  args: {
    data: createStopWithContext({ distance: 850 }),
    mapCenter: { lat: 35.691, lng: 139.805 },
  },
};

export const NoMapCenter: Story = {
  args: { mapCenter: null },
};

// --- Route types ---

/** Stop served by both bus and tram. */
export const MultipleRouteTypes: Story = {
  args: {
    data: createStopWithContext({
      routeTypes: [0, 3],
      departures: [
        createEntry({ departureMinutes: 870, headsign: '大塚駅前' }),
        createEntry({ departureMinutes: 875, route: tramRoute, headsign: '早稲田' }),
        createEntry({ departureMinutes: 885, headsign: '大塚駅前' }),
        createEntry({ departureMinutes: 890, route: tramRoute, headsign: '早稲田' }),
      ],
      agencies: [agency, agency2],
      routes: [busRoute, tramRoute],
    }),
  },
};

// --- Special states ---

export const DropOffOnly: Story = {
  args: {
    data: createStopWithContext({
      stopServiceState: 'drop-off-only',
      departures: [
        createEntry({
          departureMinutes: 870,
          pickupType: 1,
          isTerminal: true,
          arrivalMinutes: 870,
        }),
        createEntry({
          departureMinutes: 885,
          pickupType: 1,
          isTerminal: true,
          arrivalMinutes: 885,
          route: busRoute2,
          headsign: '日暮里駅前',
        }),
      ],
    }),
  },
};

export const NoDepartures: Story = {
  args: {
    data: createStopWithContext({ departures: [] }),
  },
};

export const UnknownHeadsign: Story = {
  args: {
    data: createStopWithContext({
      departures: [
        createEntry({ departureMinutes: 870, headsign: '' }),
        createEntry({ departureMinutes: 885, headsign: '大塚駅前' }),
      ],
    }),
  },
};

// --- Info levels ---

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

// --- Multiple agencies ---

export const MultipleAgencies: Story = {
  args: {
    data: createStopWithContext({
      agencies: [agency, agency2],
      routes: [busRoute, tramRoute],
      routeTypes: [0, 3],
      departures: [
        createEntry({ departureMinutes: 870, headsign: '大塚駅前' }),
        createEntry({ departureMinutes: 875, route: tramRoute, headsign: '早稲田' }),
      ],
    }),
  },
};

// --- Header only (no departures) ---

/** Header layout inspection — departures are empty to isolate the header. */
export const HeaderOnly: Story = {
  args: {
    data: createStopWithContext({ departures: [] }),
  },
};

/** Header with drop-off-only label and multiple badges. */
export const HeaderDropOffOnly: Story = {
  args: {
    data: createStopWithContext({
      stopServiceState: 'drop-off-only',
      departures: [],
    }),
  },
};

/** Header with multiple route types and agencies. */
export const HeaderMultiType: Story = {
  args: {
    data: createStopWithContext({
      routeTypes: [0, 3],
      agencies: [agency, agency2],
      routes: [busRoute, tramRoute],
      departures: [],
    }),
  },
};

/** Header with drop-off-only + multiple route types and agencies. */
export const HeaderDropOffMultiType: Story = {
  args: {
    data: createStopWithContext({
      stopServiceState: 'drop-off-only',
      routeTypes: [0, 3],
      agencies: [agency, agency2],
      routes: [busRoute, tramRoute],
      departures: [],
    }),
  },
};

/** Header with anchor enabled. */
export const HeaderAnchored: Story = {
  args: {
    isAnchor: true,
    data: createStopWithContext({ departures: [] }),
  },
};

/** Header with a long stop name to verify wrapping behavior. */
export const HeaderLongName: Story = {
  args: {
    data: createStopWithContext({
      stop: longNameStop,
      departures: [],
    }),
  },
};

/** Header with a long stop name + drop-off-only + multi-type. */
export const HeaderLongNameFull: Story = {
  args: {
    data: createStopWithContext({
      stop: longNameStop,
      stopServiceState: 'drop-off-only',
      routeTypes: [0, 3],
      agencies: [agency, agency2],
      routes: [busRoute, tramRoute],
      departures: [],
    }),
  },
};

// --- Sub names ---

export const WithSubNames: Story = {
  args: {
    data: createStopWithContext({
      stop: {
        ...baseStop,
        stop_names: {
          ja: '錦糸町駅前',
          'ja-Hrkt': 'きんしちょうえきまえ',
          en: 'Kinshichō Sta.',
        },
      },
    }),
  },
};

// --- stop_headsign patterns ---

/** trip empty + stop present (keio-bus pattern). */
export const TripEmptyStopPresent: Story = {
  args: {
    data: createStopWithContext({
      departures: [
        createEntry({ headsign: '', stopHeadsign: '武蔵小金井駅南口', departureMinutes: 870 }),
        createEntry({ headsign: '', stopHeadsign: '武蔵小金井駅南口', departureMinutes: 885 }),
        createEntry({ headsign: '大塚駅前', departureMinutes: 875 }),
      ],
      agencies: [agency2],
    }),
  },
};

/** stop overrides trip — departures show stop_headsign as effective. */
export const StopOverridesTrip: Story = {
  args: {
    data: createStopWithContext({
      departures: [
        createEntry({
          headsign: '北大路BT・下鴨神社・出町柳駅',
          stopHeadsign: '出町柳駅',
          departureMinutes: 870,
        }),
        createEntry({
          headsign: '北大路BT・下鴨神社・出町柳駅',
          stopHeadsign: '出町柳駅',
          departureMinutes: 885,
        }),
        createEntry({ headsign: '大塚駅前', departureMinutes: 875 }),
      ],
    }),
  },
};

/** All languages side by side for stop, route, and headsign resolution. */
export const LangComparison: Story = {
  args: {
    data: localizedStopData,
    viewId: 'route-headsign',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block text-[10px] text-gray-400">{label}</span>
          <NearbyStop
            data={args.data}
            isSelected={args.isSelected}
            now={args.now}
            mapCenter={args.mapCenter}
            infoLevel={args.infoLevel}
            dataLang={dataLang}
            viewId={args.viewId}
            isAnchor={args.isAnchor}
            onStopSelected={args.onStopSelected}
            onShowTimetable={args.onShowTimetable}
            onShowStopTimetable={args.onShowStopTimetable}
            onToggleAnchor={args.onToggleAnchor}
          />
        </div>
      ))}
    </div>
  ),
};

/** Kitchen sink: long name, multi-type, selected, anchored, drop-off-only, grouped departures. */
const kitchenSinkData = createStopWithContext({
  stop: longNameStop,
  routeTypes: [0, 3],
  stopServiceState: 'drop-off-only',
  agencies: [agency, agency2],
  routes: [busRoute, busRoute2, tramRoute],
  departures: [
    createEntry({ departureMinutes: 870, route: busRoute, headsign: '大塚駅前' }),
    createEntry({ departureMinutes: 872, route: busRoute2, headsign: '日暮里駅前' }),
    createEntry({ departureMinutes: 875, route: tramRoute, headsign: '早稲田' }),
    createEntry({ departureMinutes: 880, route: busRoute, headsign: '' }),
    createEntry({
      departureMinutes: 885,
      route: busRoute,
      headsign: '北大路BT・下鴨神社・出町柳駅',
      stopHeadsign: '出町柳駅',
    }),
  ],
});

export const KitchenSink: Story = {
  args: {
    data: kitchenSinkData,
    isSelected: true,
    isAnchor: true,
    infoLevel: 'detailed',
    viewId: 'route-headsign',
  },
};
