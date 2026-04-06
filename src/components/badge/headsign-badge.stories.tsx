import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RouteDirection } from '../../types/app/transit-composed';
import { busRoute, busRoute2, tramRoute, noColorRoute } from '../../stories/fixtures';
import { HeadsignBadge } from './headsign-badge';

/** Default routeDirection fixture for stories. */
const defaultRouteDirection: RouteDirection = {
  route: busRoute,
  tripHeadsign: {
    name: '大塚駅前',
    names: {
      ja: '大塚駅前',
      'ja-Hrkt': 'おおつかえきまえ',
      en: 'Otsuka Sta.',
      ko: '오쓰카역앞',
    },
  },
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
  args: { infoLevel: 'verbose' },
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
 * trip_headsign is available separately via `tripName` in HeadsignDisplayNames.
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

/** With direction_id — badge may display direction context. */
export const WithDirection: Story = {
  args: {
    routeDirection: {
      ...defaultRouteDirection,
      direction: 0,
    },
    infoLevel: 'verbose',
  },
};

// --- i18n: lang resolution ---

/** All languages side by side: ja, en, ko, de (missing), "" (no lang). */
export const LangComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {(
        [
          { lang: 'ja', label: 'ja' },
          { lang: 'en', label: 'en' },
          { lang: 'ko', label: 'ko' },
          { lang: 'de', label: 'de (missing)' },
          { lang: '', label: '(none)' },
        ] as const
      ).map(({ lang, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-20 text-[10px] text-gray-400">{label}</span>
          <HeadsignBadge
            routeDirection={args.routeDirection}
            infoLevel={args.infoLevel}
            lang={lang}
            size={args.size}
          />
        </div>
      ))}
    </div>
  ),
};

/**
 * lang=en with stop_headsign override.
 * stopHeadsign has en translation, tripHeadsign also has en.
 * Effective name should be stopHeadsign resolved in English.
 */
export const LangEnStopOverride: Story = {
  args: {
    routeDirection: {
      route: busRoute2,
      tripHeadsign: {
        name: '北大路バスターミナル・下鴨神社・出町柳駅',
        names: { en: 'Demachiyanagi Sta. via Kitaoji BT and Shimogamo-jinja' },
      },
      stopHeadsign: {
        name: '出町柳駅',
        names: { en: 'Demachiyanagi Sta.', 'ja-Hrkt': 'でまちやなぎえき' },
      },
    },
    lang: 'en',
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
