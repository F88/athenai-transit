import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  busRoute,
  busRoute2,
  createRouteDirection,
  tramRoute,
  noColorRoute,
  emptyHeadsign,
  headsignKyotoLongShortJa,
  headsignOtsukaEkimae,
  headsignShinjuku,
  routeLong,
  stopHeadsignDemachiyanagi,
  stopHeadsignLong,
  stopHeadsignMusashiKoganeiSouth,
  tripHeadsignLong,
} from '../../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../../stories/lang-comparison';
import { HeadsignBadge } from './headsign-badge';

/** Default routeDirection fixture for stories. */
const defaultRouteDirection = createRouteDirection({
  route: busRoute,
  tripHeadsign: headsignOtsukaEkimae,
});

const meta = {
  title: 'Badge/HeadsignBadge',
  component: HeadsignBadge,
  args: {
    routeDirection: defaultRouteDirection,
    infoLevel: 'normal',
    dataLang: ['ja'],
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
  args: {
    routeDirection: createRouteDirection({
      ...defaultRouteDirection,
      tripHeadsign: headsignShinjuku,
    }),
  },
};

/** Long headsign. */
export const Long: Story = {
  args: {
    routeDirection: createRouteDirection({
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    }),
  },
};

/** Empty headsign — caller should handle fallback. */
export const Empty: Story = {
  args: {
    routeDirection: createRouteDirection({ ...defaultRouteDirection, tripHeadsign: emptyHeadsign }),
  },
};

// --- Truncation ---

/** Truncated to 5 characters. */
export const Truncated: Story = {
  args: {
    routeDirection: createRouteDirection({
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    }),
    maxLength: 5,
  },
};

// --- Route color variants ---

/** Bus route with blue color. */
export const BusRoute: Story = {
  args: { routeDirection: createRouteDirection({ ...defaultRouteDirection, route: busRoute }) },
};

/** Bus route with green color. */
export const BusRoute2: Story = {
  args: { routeDirection: createRouteDirection({ ...defaultRouteDirection, route: busRoute2 }) },
};

/** Tram route with red color. */
export const TramRoute: Story = {
  args: { routeDirection: createRouteDirection({ ...defaultRouteDirection, route: tramRoute }) },
};

/** Route without color — uses fallback styling. */
export const NoColor: Story = {
  args: { routeDirection: createRouteDirection({ ...defaultRouteDirection, route: noColorRoute }) },
};

// --- Info levels ---

/** Verbose with truncation — shows truncation info in dump. */
export const VerboseTruncated: Story = {
  args: {
    routeDirection: createRouteDirection({
      ...defaultRouteDirection,
      tripHeadsign: { name: '東京都立産業技術研究センター前', names: {} },
    }),
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
    routeDirection: createRouteDirection({
      route: busRoute,
      tripHeadsign: emptyHeadsign,
      stopHeadsign: stopHeadsignMusashiKoganeiSouth,
    }),
  },
};

/**
 * trip_headsign and stop_headsign both present but different.
 * Effective headsign = stop_headsign ("出町柳駅").
 * trip_headsign is available separately via `tripName` in HeadsignDisplayNames.
 */
export const StopOverridesTrip: Story = {
  args: {
    routeDirection: createRouteDirection({
      route: busRoute2,
      tripHeadsign: headsignKyotoLongShortJa,
      stopHeadsign: stopHeadsignDemachiyanagi,
    }),
    infoLevel: 'normal',
  },
};

/** With direction_id — badge may display direction context. */
export const WithDirection: Story = {
  args: {
    routeDirection: createRouteDirection({ ...defaultRouteDirection, direction: 0 }),
    infoLevel: 'verbose',
  },
};

// --- infoLevel comparison ---

/** Logical long-form fixture for comparison stories. */
const logicalLongRd = createRouteDirection({
  route: routeLong,
  tripHeadsign: tripHeadsignLong,
  stopHeadsign: stopHeadsignLong,
});

/**
 * Side-by-side comparison of all `infoLevel` values against the
 * logical long-form fixtures (`routeLong`, `tripHeadsignLong`,
 * `stopHeadsignLong`). Place-name-independent — exercises the full
 * info-level rendering range without being tied to specific
 * real-world data.
 */
export const LogicalLongInfoLevelComparison: Story = {
  args: { routeDirection: logicalLongRd },
  render: (args) => {
    const levels = ['simple', 'normal', 'detailed', 'verbose'] as const;
    return (
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <div key={level} className="space-y-1">
            <span className="block text-[10px] text-gray-400">infoLevel: {level}</span>
            <HeadsignBadge
              routeDirection={args.routeDirection}
              infoLevel={level}
              dataLang={args.dataLang}
              size={args.size}
            />
          </div>
        ))}
      </div>
    );
  },
};

// --- i18n: lang resolution ---

/** All supported languages, one unsupported language, and no language. */
export const LangComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-20 text-[10px] text-gray-400">{label}</span>
          <HeadsignBadge
            routeDirection={args.routeDirection}
            infoLevel={args.infoLevel}
            dataLang={dataLang}
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
    routeDirection: createRouteDirection({
      route: busRoute2,
      tripHeadsign: headsignKyotoLongShortJa,
      stopHeadsign: stopHeadsignDemachiyanagi,
    }),
    dataLang: ['en'],
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
        dataLang={args.dataLang}
        size="xs"
      />
      <HeadsignBadge
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        dataLang={args.dataLang}
        size="sm"
      />
      <HeadsignBadge
        routeDirection={args.routeDirection}
        infoLevel={args.infoLevel}
        dataLang={args.dataLang}
        size="default"
      />
    </div>
  ),
};

// --- Kitchen sink: single headsign, all info levels ---

export const KitchenSink: Story = {
  args: { infoLevel: 'detailed' },
};

// --- Kitchen sink: stop_headsign patterns ---

/** trip_headsign empty + stop_headsign present — verbose shows stop_headsign data. */
export const KitchenSinkTripEmptyStopVerbose: Story = {
  args: {
    routeDirection: createRouteDirection({
      route: busRoute,
      tripHeadsign: emptyHeadsign,
      stopHeadsign: stopHeadsignMusashiKoganeiSouth,
    }),
    infoLevel: 'verbose',
  },
};

/** stop_headsign overrides trip_headsign — verbose shows both headsign data. */
export const KitchenSinkStopOverridesVerbose: Story = {
  args: {
    routeDirection: createRouteDirection({
      route: busRoute2,
      tripHeadsign: headsignKyotoLongShortJa,
      stopHeadsign: stopHeadsignDemachiyanagi,
    }),
    infoLevel: 'verbose',
  },
};
