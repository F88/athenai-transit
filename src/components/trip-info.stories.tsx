import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RouteDirection } from '../types/app/transit-composed';
import type { Agency, Route } from '../types/app/transit';
import { TripInfo } from './trip-info';

const baseRoute: Route = {
  route_id: 'route-001',
  route_short_name: '渋64',
  route_long_name: '渋谷駅〜中野駅',
  route_names: {},
  route_type: 3 as const,
  route_color: '1976D2',
  route_text_color: 'FFFFFF',
  agency_id: 'agency-001',
};

const longRoute: Route = {
  ...baseRoute,
  route_id: 'toaran:SA',
  route_short_name: '',
  route_long_name: '東京さくらトラム（都電荒川線）',
  route_type: 0 as const,
  route_color: 'E60012',
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

const longAgency: Agency = {
  ...agency,
  agency_id: 'agency-002',
  agency_name: '京都市交通局',
  agency_short_name: '京都市バス',
  agency_colors: [{ bg: '009f40', text: 'FFFFFF' }],
};

const shortRd: RouteDirection = {
  route: baseRoute,
  tripHeadsign: { name: '中野駅', names: {} },
};

const shortRdWithNames: RouteDirection = {
  route: baseRoute,
  tripHeadsign: {
    name: '新橋駅前',
    names: { ja: '新橋駅前', 'ja-Hrkt': 'しんばしえきまえ', en: 'Shimbashi Sta.' },
  },
};

const longRd: RouteDirection = {
  route: longRoute,
  tripHeadsign: {
    name: '三ノ輪橋',
    names: { 'ja-Hrkt': 'みのわばし', en: 'Minowabashi' },
  },
};

const longRdKyoto: RouteDirection = {
  route: longRoute,
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
  route: baseRoute,
  tripHeadsign: { name: '', names: {} },
  stopHeadsign: { name: '武蔵小金井駅南口', names: {} },
};

/** stop overrides trip — mid-trip headsign changes to shorter destination. */
const stopOverridesTripRd: RouteDirection = {
  route: longRoute,
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
    lang: 'ja',
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

export const ShortWithTranslations: Story = {
  args: { routeDirection: shortRdWithNames },
};

export const LongRoute: Story = {
  args: { routeDirection: longRd, agency: longAgency },
};

export const LongRouteKyoto: Story = {
  args: { routeDirection: longRdKyoto, agency: longAgency },
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

/** trip empty + stop present — effective shows stop_headsign. */
export const TripEmptyStopPresent: Story = {
  args: { routeDirection: tripEmptyStopRd },
};

/** stop overrides trip — subNames should include trip_headsign as context. */
export const StopOverridesTrip: Story = {
  args: { routeDirection: stopOverridesTripRd, agency: longAgency },
};

/** stop overrides trip — verbose shows both headsign data. */
export const StopOverridesTripVerbose: Story = {
  args: { routeDirection: stopOverridesTripRd, agency: longAgency, infoLevel: 'verbose' },
};

// --- All elements (short data) ---

export const AllElementsShortInfoLevelSimple: Story = {
  args: {
    routeDirection: shortRdWithNames,
    isTerminal: true,
    isPickupUnavailable: true,
    infoLevel: 'simple',
  },
};

export const AllElementsShortInfoLevelNormal: Story = {
  args: {
    routeDirection: shortRdWithNames,
    isTerminal: true,
    isPickupUnavailable: true,
    infoLevel: 'normal',
  },
};

export const AllElementsShortInfoLevelDetailed: Story = {
  args: {
    routeDirection: shortRdWithNames,
    isTerminal: true,
    isPickupUnavailable: true,
    infoLevel: 'detailed',
  },
};

// --- All elements (long data) ---

export const AllElementsLongInfoLevelSimple: Story = {
  args: {
    routeDirection: longRdKyoto,
    agency: longAgency,
    isTerminal: true,
    isPickupUnavailable: true,
    infoLevel: 'simple',
  },
};

export const AllElementsLongInfoLevelNormal: Story = {
  args: {
    routeDirection: longRdKyoto,
    agency: longAgency,
    isTerminal: true,
    isPickupUnavailable: true,
    infoLevel: 'normal',
  },
};

export const AllElementsLongInfoLevelDetailed: Story = {
  args: {
    routeDirection: longRdKyoto,
    agency: longAgency,
    isTerminal: true,
    isPickupUnavailable: true,
    infoLevel: 'detailed',
  },
};

// --- Info levels ---

export const KitchenSinkInfoLevelSimple: Story = {
  args: { routeDirection: longRd, agency: longAgency, infoLevel: 'simple', isTerminal: true },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { routeDirection: longRd, agency: longAgency, infoLevel: 'normal', isTerminal: true },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { routeDirection: longRd, agency: longAgency, infoLevel: 'detailed', isTerminal: true },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { routeDirection: longRd, agency: longAgency, infoLevel: 'verbose', isTerminal: true },
};
