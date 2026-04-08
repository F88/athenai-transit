import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Agency, Route } from '../types/app/transit';
import {
  createRouteDirection,
  emptyHeadsign,
  headsignKyotoLong,
  headsignKyotoLongShortJa,
  headsignMinowabashi,
  headsignNakano,
  stopHeadsignDemachiyanagi,
  stopHeadsignMusashiKoganeiSouth,
} from '../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison';
import { TripInfo } from './trip-info';

const busRoute: Route = {
  route_id: 'route-001',
  route_short_name: '渋64',
  route_short_names: {},
  route_long_name: '渋谷駅〜中野駅',
  route_long_names: {},
  route_type: 3 as const,
  route_color: '1976D2',
  route_text_color: 'FFFFFF',
  agency_id: 'agency-001',
};

const tramRoute: Route = {
  ...busRoute,
  route_id: 'toaran:SA',
  route_short_name: '',
  route_short_names: {},
  route_long_name: '東京さくらトラム（都電荒川線）',
  route_type: 0 as const,
  route_color: 'E60012',
};

const kyotoBusRoute: Route = {
  ...busRoute,
  route_id: 'kyoto:205',
  route_short_name: '205',
  route_short_names: {
    ja: '市バス205',
    en: '205 City Bus',
    ko: '205번 시영버스',
    'zh-Hans': '市营巴士205路',
    'zh-Hant': '市營巴士205路',
  },
  route_long_name: '河原町通・北大路バスターミナル',
  route_long_names: {
    ja: '河原町通・北大路バスターミナル',
    en: 'Kawaramachi St. / Kitaoji Bus Terminal',
    ko: '가와라마치도리・기타오지 버스 터미널',
    'zh-Hans': '河原町通・北大路公交总站',
    'zh-Hant': '河原町通・北大路公交總站',
  },
  route_type: 3 as const,
  route_color: '009f40',
  agency_id: 'agency-002',
};

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

const kyotoAgency: Agency = {
  ...agency,
  agency_id: 'agency-002',
  agency_name: '京都市交通局',
  agency_short_name: '京都市バス',
  agency_colors: [{ bg: '009f40', text: 'FFFFFF' }],
};

const shortRd = createRouteDirection({ route: busRoute, tripHeadsign: headsignNakano });

const tramRd = createRouteDirection({ route: tramRoute, tripHeadsign: headsignMinowabashi });

const kyotoBusRd = createRouteDirection({ route: kyotoBusRoute, tripHeadsign: headsignKyotoLong });

/** trip empty + stop present (keio-bus pattern). */
const tripEmptyStopRd = createRouteDirection({
  route: busRoute,
  tripHeadsign: emptyHeadsign,
  stopHeadsign: stopHeadsignMusashiKoganeiSouth,
});

/** stop overrides trip — mid-trip headsign changes to shorter destination. */
const stopOverridesTripRd = createRouteDirection({
  route: kyotoBusRoute,
  tripHeadsign: headsignKyotoLongShortJa,
  stopHeadsign: stopHeadsignDemachiyanagi,
});

const meta = {
  title: 'Departure/TripInfo',
  component: TripInfo,
  args: {
    routeDirection: shortRd,
    infoLevel: 'normal',
    dataLang: ['ja'],
    showRouteTypeIcon: true,
    agency,
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    showRouteTypeIcon: { control: 'boolean' },
    isTerminal: { control: 'boolean' },
    isPickupUnavailable: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TripInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const TramRoute: Story = {
  args: { routeDirection: tramRd },
};

export const KyotoBusRoute: Story = {
  args: { routeDirection: kyotoBusRd, agency: kyotoAgency },
};

export const Terminal: Story = {
  args: { isTerminal: true },
};

export const PickupUnavailable: Story = {
  args: { isPickupUnavailable: true },
};

export const EmptyHeadsign: Story = {
  args: { routeDirection: createRouteDirection({ ...shortRd, tripHeadsign: emptyHeadsign }) },
};

// --- stop_headsign ---

/** trip empty + stop present — effective shows stop_headsign. */
export const TripEmptyStopPresent: Story = {
  args: { routeDirection: tripEmptyStopRd },
};

/**
 * stop overrides trip — effective headsign is stop_headsign.
 * trip_headsign is available separately via `tripName` in HeadsignDisplayNames.
 */
export const StopOverridesTrip: Story = {
  args: { routeDirection: stopOverridesTripRd, agency: kyotoAgency },
};

/** stop overrides trip — verbose shows both headsign data. */
export const StopOverridesTripVerbose: Story = {
  args: { routeDirection: stopOverridesTripRd, agency: kyotoAgency, infoLevel: 'verbose' },
};

// --- i18n: lang resolution ---

/** All languages side by side. */
export const LangComparison: Story = {
  args: { routeDirection: kyotoBusRd, agency: kyotoAgency },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label}>
          <span className="mb-0.5 block text-[10px] text-gray-400">{label}</span>
          <TripInfo
            routeDirection={args.routeDirection}
            infoLevel={args.infoLevel}
            dataLang={dataLang}
            showRouteTypeIcon={args.showRouteTypeIcon}
            agency={args.agency}
          />
        </div>
      ))}
    </div>
  ),
};

export const KitchenSink: Story = {
  args: { routeDirection: tramRd, agency: kyotoAgency, infoLevel: 'verbose', isTerminal: true },
};
