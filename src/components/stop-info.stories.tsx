import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Agency, RouteType, Stop } from '../types/app/transit';
import { StopInfo } from './stop-info';

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
  agency_colors: [{ bg: '#00A850', text: '#FFFFFF' }],
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
  agency_colors: [{ bg: '#E60012', text: '#FFFFFF' }],
};

const baseStop: Stop = {
  stop_id: 'stop-001',
  stop_name: '錦糸町駅前',
  stop_names: {
    ja: '錦糸町駅前',
    'ja-Hrkt': 'きんしちょうえきまえ',
    en: 'Kinshichō Sta.',
  },
  stop_lat: 35.6955,
  stop_lon: 139.8135,
  location_type: 0,
  agency_id: 'agency-001',
};

/** Long stop name with 6-language support (matching Kyoto City Bus GTFS coverage). */
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

/** Map center ~70m west of the stop. */
const mapCenter = { lat: 35.6955, lng: 139.8127 };

// --- Meta ---

const meta = {
  title: 'StopInfo/StopInfo',
  component: StopInfo,
  args: {
    stop: baseStop,
    routeTypes: [3] as RouteType[],
    agencies: [agency],
    mapCenter,
    infoLevel: 'normal',
    isDropOffOnly: false,
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    isDropOffOnly: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-lg bg-[#f5f7fa] px-3 pt-2.5 pb-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const DropOffOnly: Story = {
  args: { isDropOffOnly: true },
};

// --- Distance & direction ---

export const Near: Story = {
  args: { mapCenter: { lat: 35.6955, lng: 139.8134 } },
};

export const Far: Story = {
  args: { mapCenter: { lat: 35.691, lng: 139.805 } },
};

export const NoMapCenter: Story = {
  args: { mapCenter: null },
};

// --- Route types ---

export const Bus: Story = {
  args: { routeTypes: [3] as RouteType[] },
};

export const Tram: Story = {
  args: { routeTypes: [0] as RouteType[] },
};

export const MultiType: Story = {
  args: { routeTypes: [0, 3] as RouteType[], agencies: [agency, agency2] },
};

export const MultiTypeDropOff: Story = {
  args: {
    routeTypes: [0, 3] as RouteType[],
    agencies: [agency, agency2],
    isDropOffOnly: true,
  },
};

// --- Info levels ---

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Long name ---

export const LongName: Story = {
  args: { stop: longNameStop },
};

export const LongNameDropOff: Story = {
  args: { stop: longNameStop, isDropOffOnly: true },
};

export const LongNameMultiType: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as RouteType[],
    agencies: [agency, agency2],
  },
};

export const LongNameFull: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as RouteType[],
    agencies: [agency, agency2],
    isDropOffOnly: true,
  },
};

/** Long name with verbose info level — shows ID, all subNames, and all badges. */
export const LongNameVerbose: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as RouteType[],
    agencies: [agency, agency2],
    isDropOffOnly: true,
    infoLevel: 'verbose',
  },
};
