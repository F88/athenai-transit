import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Agency, Route, TimetableEntryAttributes } from '../types/app/transit';
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
  agency_long_name: '都営バス',
  agency_short_name: '都営',
  agency_names: {},
  agency_long_names: {},
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
  agency_long_name: '京都市交通局',
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

const emptyAttributes: TimetableEntryAttributes = {
  isTerminal: false,
  isOrigin: false,
  isPickupUnavailable: false,
  isDropOffUnavailable: false,
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
    attributes: emptyAttributes,
    size: 'default',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    showRouteTypeIcon: { control: 'boolean' },
    size: { control: 'inline-radio', options: ['sm', 'default'] },
    attributes: { control: 'object' },
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

// --- Attributes ---

/** Terminal stop — gray label ("終点"). */
export const Terminal: Story = {
  args: { attributes: { ...emptyAttributes, isTerminal: true } },
};

/** Origin stop — blue label ("始発"). */
export const Origin: Story = {
  args: { attributes: { ...emptyAttributes, isOrigin: true } },
};

/** Pickup unavailable — red "乗×" label. */
export const PickupUnavailable: Story = {
  args: { attributes: { ...emptyAttributes, isPickupUnavailable: true } },
};

/** Drop-off unavailable — red "降×" label. */
export const DropOffUnavailable: Story = {
  args: { attributes: { ...emptyAttributes, isDropOffUnavailable: true } },
};

/** All four attributes set — every label renders. */
export const AllAttributes: Story = {
  args: {
    attributes: {
      isTerminal: true,
      isOrigin: true,
      isPickupUnavailable: true,
      isDropOffUnavailable: true,
    },
  },
};

/**
 * Side-by-side comparison of each `TimetableEntryAttributes` state
 * against the baseline (no attributes), using the default size.
 */
export const TimetableEntryAttributesComparison: Story = {
  render: (args) => {
    const cases: Array<{ label: string; attributes: TimetableEntryAttributes }> = [
      { label: 'none', attributes: emptyAttributes },
      { label: 'terminal', attributes: { ...emptyAttributes, isTerminal: true } },
      { label: 'origin', attributes: { ...emptyAttributes, isOrigin: true } },
      {
        label: 'pickup unavailable',
        attributes: { ...emptyAttributes, isPickupUnavailable: true },
      },
      {
        label: 'drop-off unavailable',
        attributes: { ...emptyAttributes, isDropOffUnavailable: true },
      },
      {
        label: 'all four',
        attributes: {
          isTerminal: true,
          isOrigin: true,
          isPickupUnavailable: true,
          isDropOffUnavailable: true,
        },
      },
    ];
    return (
      <div className="flex flex-col gap-3">
        {cases.map(({ label, attributes }) => (
          <div key={label}>
            <span className="mb-0.5 block text-[10px] text-gray-400">{label}</span>
            <TripInfo
              routeDirection={args.routeDirection}
              infoLevel={args.infoLevel}
              dataLang={args.dataLang}
              showRouteTypeIcon={args.showRouteTypeIcon}
              agency={args.agency}
              attributes={attributes}
              size={args.size}
            />
          </div>
        ))}
      </div>
    );
  },
};

/**
 * Size comparison — `sm` (compact, used in StopSummary popovers) vs
 * `default` (used in DepartureItem / FlatDepartureItem). Labels scale
 * correspondingly via BaseLabelSize.
 */
export const SizeComparison: Story = {
  args: {
    attributes: {
      isTerminal: true,
      isOrigin: false,
      isPickupUnavailable: true,
      isDropOffUnavailable: false,
    },
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['sm', 'default'] as const).map((size) => (
        <div key={size}>
          <span className="mb-0.5 block text-[10px] text-gray-400">size: {size}</span>
          <TripInfo
            routeDirection={args.routeDirection}
            infoLevel={args.infoLevel}
            dataLang={args.dataLang}
            showRouteTypeIcon={args.showRouteTypeIcon}
            agency={args.agency}
            attributes={args.attributes}
            size={size}
          />
        </div>
      ))}
    </div>
  ),
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

/**
 * KitchenSink — maximum-information composition for visual regression.
 *
 * - `stopOverridesTripRd` for rich multi-language route names and
 *   both trip/stop headsigns (verbose mode renders both).
 * - `kyotoAgency` matches `kyotoBusRoute.agency_id` so the agency
 *   badge resolves correctly.
 * - All four `TimetableEntryAttributes` flags enabled so every
 *   per-entry label (Terminal / Origin / PickupUnavailable /
 *   DropOffUnavailable) renders.
 * - `infoLevel: 'verbose'` to surface all available verbose data.
 */
export const KitchenSink: Story = {
  args: {
    routeDirection: stopOverridesTripRd,
    agency: kyotoAgency,
    infoLevel: 'verbose',
    attributes: {
      isTerminal: true,
      isOrigin: true,
      isPickupUnavailable: true,
      isDropOffUnavailable: true,
    },
  },
};
