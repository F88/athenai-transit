import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RouteDirection } from '../../types/app/transit-composed';
import { busRoute, busRoute2, tramRoute, noColorRoute } from '../../stories/fixtures';
import { HeadsignBadge } from './headsign-badge';

/** Default routeDirection fixture for stories. */
const defaultRouteDirection: RouteDirection = {
  route: busRoute,
  tripHeadsign: { name: '大塚駅前', names: {} },
};

const meta = {
  title: 'Badge/HeadsignBadge',
  component: HeadsignBadge,
  args: {
    routeDirection: defaultRouteDirection,
    infoLevel: 'normal',
    lang: 'ja',
    size: 'default',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['default', 'sm', 'xs'] },
  },
} satisfies Meta<typeof HeadsignBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Size variants ---

export const SizeDefault: Story = {
  args: { size: 'default' },
};

export const SizeSm: Story = {
  args: { size: 'sm' },
};

export const SizeXs: Story = {
  args: { size: 'xs' },
};

// --- Headsign variants ---

/** Short headsign. */
export const Short: Story = {
  args: { routeDirection: { ...defaultRouteDirection, tripHeadsign: { name: '新宿', names: {} } } },
};

/** Long headsign. */
export const Long: Story = {
  args: {
    routeDirection: {
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    },
  },
};

/** Empty headsign — caller should handle fallback. */
export const Empty: Story = {
  args: { routeDirection: { ...defaultRouteDirection, tripHeadsign: { name: '', names: {} } } },
};

// --- Truncation ---

/** Truncated to 5 characters. */
export const Truncated: Story = {
  args: {
    routeDirection: {
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    },
    maxLength: 5,
  },
};

/** maxLength larger than headsign — no truncation. */
export const NoTruncation: Story = {
  args: { maxLength: 10 },
};

// --- Route color variants ---

/** Bus route with blue color. */
export const BusRoute: Story = {
  args: { routeDirection: { ...defaultRouteDirection, route: busRoute } },
};

/** Bus route with green color. */
export const BusRoute2: Story = {
  args: { routeDirection: { ...defaultRouteDirection, route: busRoute2 } },
};

/** Tram route with red color. */
export const TramRoute: Story = {
  args: { routeDirection: { ...defaultRouteDirection, route: tramRoute } },
};

/** Route without color — uses fallback styling. */
export const NoColor: Story = {
  args: { routeDirection: { ...defaultRouteDirection, route: noColorRoute } },
};

// --- Info levels ---

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

export const Normal: Story = {
  args: { infoLevel: 'normal' },
};

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

/** Verbose with truncation — shows truncation info in dump. */
export const VerboseTruncated: Story = {
  args: {
    routeDirection: {
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    },
    maxLength: 5,
    infoLevel: 'verbose',
  },
};

/** With headsign translations — shows sub-names in verbose. */
export const WithTranslations: Story = {
  args: {
    routeDirection: {
      ...defaultRouteDirection,
      tripHeadsign: {
        name: '新橋駅前',
        names: {
          ja: '新橋駅前',
          'ja-Hrkt': 'しんばしえきまえ',
          en: 'Shimbashi Sta.',
        },
      },
    },
    infoLevel: 'verbose',
  },
};

// --- stop_headsign variants ---

/**
 * trip_headsign empty + stop_headsign present.
 * Effective headsign = stop_headsign ("武蔵小金井駅南口").
 */
export const TripEmptyStopPresent: Story = {
  args: {
    routeDirection: {
      route: busRoute,
      tripHeadsign: { name: '', names: {} },
      stopHeadsign: { name: '武蔵小金井駅南口', names: {} },
    },
  },
};

/**
 * trip_headsign and stop_headsign both present but different.
 * Effective headsign = stop_headsign ("出町柳駅").
 * trip_headsign ("北大路BT・下鴨神社・出町柳駅") appears in subNames as context.
 */
export const StopOverridesTrip: Story = {
  args: {
    routeDirection: {
      route: busRoute2,
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
    },
    infoLevel: 'normal',
  },
};

// --- Comparisons ---

/** All sizes side by side. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <HeadsignBadge
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        lang={args.lang}
        size="xs"
      />
      <HeadsignBadge
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        lang={args.lang}
        size="sm"
      />
      <HeadsignBadge
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        lang={args.lang}
        size="default"
      />
    </div>
  ),
};

// --- Kitchen sink: single headsign, all info levels ---

export const KitchenSinkInfoLevelSimple: Story = {
  args: { infoLevel: 'simple' },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { infoLevel: 'normal' },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Kitchen sink: stop_headsign patterns ---

/** trip_headsign empty + stop_headsign present — verbose shows stop_headsign data. */
export const KitchenSinkTripEmptyStopVerbose: Story = {
  args: {
    routeDirection: {
      route: busRoute,
      tripHeadsign: { name: '', names: {} },
      stopHeadsign: { name: '武蔵小金井駅南口', names: {} },
    },
    infoLevel: 'verbose',
  },
};

/** stop_headsign overrides trip_headsign — verbose shows both headsign data. */
export const KitchenSinkStopOverridesVerbose: Story = {
  args: {
    routeDirection: {
      route: busRoute2,
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
    },
    infoLevel: 'verbose',
  },
};
