import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RouteDirection } from '../types/app/transit-composed';
import type { Agency, Route } from '../types/app/transit';
import { TripInfo } from './trip-info';

const busRoute: Route = {
  route_id: 'route-001',
  route_short_name: '渋64',
  route_long_name: '渋谷駅〜中野駅',
  route_names: {},
  route_type: 3 as const,
  route_color: '1976D2',
  route_text_color: 'FFFFFF',
  agency_id: 'agency-001',
};

const tramRoute: Route = {
  ...busRoute,
  route_id: 'toaran:SA',
  route_short_name: '',
  route_long_name: '東京さくらトラム（都電荒川線）',
  route_type: 0 as const,
  route_color: 'E60012',
};

const kyotoBusRoute: Route = {
  ...busRoute,
  route_id: 'kyoto:205',
  route_short_name: '205',
  route_long_name: '河原町通・北大路バスターミナル',
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

const shortRd: RouteDirection = {
  route: busRoute,
  tripHeadsign: {
    name: '中野駅',
    names: { ja: '中野駅', 'ja-Hrkt': 'なかのえき', en: 'Nakano Sta.', ko: '나카노역' },
  },
};

const tramRd: RouteDirection = {
  route: tramRoute,
  tripHeadsign: {
    name: '三ノ輪橋',
    names: { 'ja-Hrkt': 'みのわばし', en: 'Minowabashi' },
  },
};

const kyotoBusRd: RouteDirection = {
  route: kyotoBusRoute,
  tripHeadsign: {
    name: '北大路バスターミナル・下鴨神社・出町柳駅',
    names: {
      ja: '北大路バスターミナル・下鴨神社・出町柳駅',
      'ja-Hrkt': 'きたおおじバスターミナル・しもがもじんじゃ・でまちやなぎえき',
      en: 'Kitaoji Bus Terminal via Shimogamo Shrine & Demachiyanagi Sta.',
      ko: '기타오지 버스 터미널・시모가모 신사・데마치야나기역',
      'zh-Hans': '北大路公交总站・下鸭神社・出町柳站',
      'zh-Hant': '北大路公交總站・下鴨神社・出町柳站',
    },
  },
};

/** trip empty + stop present (keio-bus pattern). */
const tripEmptyStopRd: RouteDirection = {
  route: busRoute,
  tripHeadsign: { name: '', names: {} },
  stopHeadsign: { name: '武蔵小金井駅南口', names: {} },
};

/** stop overrides trip — mid-trip headsign changes to shorter destination. */
const stopOverridesTripRd: RouteDirection = {
  route: kyotoBusRoute,
  tripHeadsign: {
    name: '北大路バスターミナル・下鴨神社・出町柳駅',
    names: {
      ja: '北大路バスターミナル・下鴨神社・出町柳駅',
      en: 'Demachiyanagi Sta. via Kitaoji BT and Shimogamo-jinja',
    },
  },
  stopHeadsign: {
    name: '出町柳駅',
    names: {
      ja: '出町柳駅',
      'ja-Hrkt': 'でまちやなぎえき',
      en: 'Demachiyanagi Sta.',
    },
  },
};

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
  args: { routeDirection: { ...shortRd, tripHeadsign: { name: '', names: {} } } },
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
      {[
        { dataLang: ['ja'] as string[], label: 'ja' },
        { dataLang: ['en'] as string[], label: 'en' },
        { dataLang: ['ko'] as string[], label: 'ko' },
        { dataLang: ['zh-Hans'] as string[], label: 'zh-Hans' },
        { dataLang: ['de'] as string[], label: 'de (missing)' },
        { dataLang: [] as string[], label: '(none)' },
      ].map(({ dataLang, label }) => (
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
